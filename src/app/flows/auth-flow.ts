import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { getLoginSalts, getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode, zeroFill } from '@/shared/crypto/crypto-utils'
import { decrypt, importKey } from '@/shared/crypto/aes-gcm'
import { keyVault } from '@/features/encryption/model/key-vault'
import type { CachedVaultEnvelope, ServerFieldKey } from '@/shared/types/api.types'
import { DecryptionError } from '@/shared/crypto/errors'
import { unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import { deriveAuthHash, derivePasswordKey, terminateWorker } from '@/shared/crypto/argon2id'

/**
 * Registers a new user: derives keys, signs up on the server, uploads encrypted
 * key material, and populates the auth and crypto stores. Returns the BIP-39
 * mnemonic for the recovery dialog.
 *
 * On failure after signup, attempts best-effort cleanup via logout.
 */
export async function signUpUser(username: string, password: string): Promise<string> {
  const authStore = useAuthStore.getState()
  authStore.setLoading(true)

  try {
    const regResult = await deriveRegistrationKeys(password)
    const authResult = await authAdapter.signup(username, regResult.authHash)

    try {
      await uploadRegistrationData(regResult, authResult.user.id)
    } catch (error) {
      // Signup succeeded but upload failed — best-effort cleanup
      try {
        await authAdapter.logout()
      } catch {
        // Server signOut may fail — ignore
      }
      throw error
    }

    authStore.setAuth(authResult.user, authResult.session)

    // Store KEK and field keys in the vault (non-extractable CryptoKeys)
    keyVault.storeFieldKeys(regResult.kek, regResult.fieldKeys)

    useCryptoStore.getState().setCachedEnvelope({
      authSalt: hexEncode(regResult.authSalt),
      keySalt: hexEncode(regResult.keySalt),
      wrappedMasterKey: hexEncode(regResult.wrappedMasterKey),
      masterKeyIV: hexEncode(regResult.masterKeyIV),
      fieldKeys: regResult.wrappedFieldKeys.map((fk) => ({
        fieldName: fk.fieldName,
        version: fk.version,
        wrappedKey: hexEncode(fk.wrappedKey),
        keyIV: hexEncode(fk.iv),
      })),
    })

    return regResult.mnemonic
  } finally {
    authStore.setLoading(false)
  }
}

/**
 * Logs in an existing user (salts are fetched pre-auth).
 */
export async function loginUser(username: string, password: string) {
  const authStore = useAuthStore.getState()
  authStore.setLoading(true)

  try {
    // Fetch salts (pre-auth) → derive credentials → authenticate
    const { authSalt } = await getLoginSalts(username)
    const authHash = await deriveAuthHash(password, hexDecode(authSalt))
    const authResult = await authAdapter.login(username, authHash)

    // Fetch wrapped keys (post-auth) → derive KEK → unwrap and store field keys
    const envelope = await fetchFreshEnvelope(authResult.user.id)
    const kek = await deriveKekFromEnvelope(password, envelope)
    await storeFieldKeys(kek, envelope.fieldKeys)

    authStore.setAuth(authResult.user, authResult.session)
  } finally {
    authStore.setLoading(false)
  }
}

function logoutCleanup() {
  keyVault.clearVault()
  useAuthStore.getState().reset()
  terminateWorker()
}

export async function logoutUser() {
  const store = useAuthStore.getState()
  store.setLoading(true)

  try {
    await authAdapter.logout()
  } catch {
    // Server signOut may fail (no session, network error) - clear local state regardless
  } finally {
    logoutCleanup()
  }
}

let restoring = false

/**
 * Restores the existing user session on app boot, guards against concurrent calls,
 * and marks session restoration as complete.
 */
export async function restoreSession(): Promise<void> {
  if (restoring) return
  const { isRestoringSession } = useAuthStore.getState()
  if (!isRestoringSession) return

  restoring = true

  try {
    const result = await authAdapter.getSession()
    if (result) {
      useAuthStore.getState().setAuth(result.user, result.session)
    }
  } catch {
    // getSession failed — proceed as unauthenticated
  } finally {
    useAuthStore.getState().setRestoringSession(false)
    restoring = false
  }
}

/**
 * Subscribes to auth state changes from the adapter and syncs the
 * current user/session into the auth store.
 *
 * @remarks The underlying Supabase listener broadcasts auth events across
 * browser tabs, so a logout (or login) in one tab is reflected in all others.
 *
 * @returns A function to unsubscribe from auth state changes.
 */
export function subscribeToAuthChanges(): () => void {
  return authAdapter.onAuthStateChange((result) => {
    if (result) {
      useAuthStore.getState().setAuth(result.user, result.session)
    } else {
      logoutCleanup()
    }
  })
}

export async function unlockVault(password: string): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user) {
    throw new Error('Cannot unlock vault: no authenticated user')
  }

  let staleCache = false
  const cachedEnvelope = useCryptoStore.getState().cachedEnvelope
  if (cachedEnvelope) {
    try {
      const kek = await deriveKekFromEnvelope(password, cachedEnvelope)
      await storeFieldKeys(kek, cachedEnvelope.fieldKeys)
    } catch (error) {
      if (error instanceof DecryptionError) {
        // Cached envelope may be stale (password changed in another session).
        // Clear the stale cache and retry the full network + derivation path.
        keyVault.clearVault()
        staleCache = true
      } else {
        throw error
      }
    }
  }

  if (!cachedEnvelope || staleCache) {
    const freshEnvelope = await fetchFreshEnvelope(user.id)
    const kek = await deriveKekFromEnvelope(password, freshEnvelope)
    await storeFieldKeys(kek, freshEnvelope.fieldKeys)
  }
}

async function fetchFreshEnvelope(userId: string): Promise<CachedVaultEnvelope> {
  // Sequential: both calls require an active auth session;
  // parallel requests can race on session initialization
  const masterKeyEnvelope = await getMasterKeyEnvelope(userId)
  const serverFieldKeys = await getFieldKeys(userId)
  const freshEnvelope = { ...masterKeyEnvelope, fieldKeys: serverFieldKeys }
  useCryptoStore.getState().setCachedEnvelope(freshEnvelope)
  return freshEnvelope
}

async function deriveKekFromEnvelope(password: string, envelope: CachedVaultEnvelope): Promise<CryptoKey> {
  // Derive password key
  const passwordKey = await derivePasswordKey(password, hexDecode(envelope.keySalt))
  const cryptoPasswordKey = await importKey(passwordKey)

  // Unwrap master key → derive KEK
  const wrappedMasterKey = hexDecode(envelope.wrappedMasterKey)
  const masterKey = await decrypt(wrappedMasterKey, cryptoPasswordKey, {
    iv: hexDecode(envelope.masterKeyIV),
    aad: MASTER_KEY_PASSWORD_AAD,
  })
  const kekBytes = await deriveKEK(masterKey)
  const kek = await importKey(kekBytes)
  zeroFill(masterKey)
  return kek
}

async function storeFieldKeys(kek: CryptoKey, fieldKeys: ServerFieldKey[]): Promise<void> {
  // Unwrap field keys with KEK (verifies AAD = fieldName + version)
  const unwrappedFieldKeys = await unwrapFieldKeys(fieldKeys, kek)

  // Store KEK and field keys in the vault (non-extractable CryptoKeys)
  keyVault.storeFieldKeys(kek, unwrappedFieldKeys)
}
