import { describe, it, expect, vi } from 'vitest'
import * as cryptoUtils from '@/shared/crypto/core/crypto-utils'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { encrypt, decrypt, importKey } from '@/shared/crypto/core/aes-gcm'
import { generateMasterKey } from '@/shared/crypto/keys/master-key'
import { deriveKEK } from '@/shared/crypto/core/hkdf'
import { rotateFieldKeyCrypto } from '@/shared/crypto/keys/key-rotation'
import { FIELD_KEY_VERSION } from '@/shared/types/crypto.types'
import type { FieldName } from '@/shared/types/entities/field.types'

const FIELD_NAME: FieldName = 'note'

async function setupKek() {
  const masterKey = generateMasterKey()
  const kekBytes = await deriveKEK(masterKey)
  const kek = await importKey(kekBytes)
  return { kek }
}

async function makeOldFieldKey() {
  const rawKey = cryptoUtils.generateKey()
  const fieldKey = await importKey(rawKey)
  return { fieldKey, rawKey }
}

function toBytes(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
}

async function encryptContent(plaintext: string, fieldKey: CryptoKey) {
  const contentAad = cryptoUtils.encodeAAD(FIELD_NAME, FIELD_KEY_VERSION)
  const iv = cryptoUtils.generateIV()
  const ciphertext = await encrypt(toBytes(plaintext), fieldKey, { iv, aad: contentAad })
  return { ciphertext: cryptoUtils.hexEncode(ciphertext), ciphertextIv: cryptoUtils.hexEncode(iv) }
}

async function decryptContent(ciphertext: string, ciphertextIv: string, fieldKey: CryptoKey) {
  const contentAad = cryptoUtils.encodeAAD(FIELD_NAME, FIELD_KEY_VERSION)
  const plaintext = await decrypt(cryptoUtils.hexDecode(ciphertext), fieldKey, {
    iv: cryptoUtils.hexDecode(ciphertextIv),
    aad: contentAad,
  })
  return new TextDecoder().decode(plaintext)
}

describe('key-rotation', () => {
  describe('rotateFieldKeyCrypto', () => {
    it('produces v2 wrapped key and re-encrypted ciphertexts from v1 input', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const originals = [
        { entryId: 'entry-1', plaintext: 'first secret note' },
        { entryId: 'entry-2', plaintext: 'second secret note' },
      ]
      const currentCiphertexts = await Promise.all(
        originals.map(async ({ entryId, plaintext }) => {
          const enc = await encryptContent(plaintext, oldFieldKey)
          return { entryId, ...enc }
        }),
      )

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey,
        fieldName: FIELD_NAME,
        currentVersion: 1,
        currentCiphertexts,
      })

      expect(result.newVersion).toBe(2)
      expect(result.reEncryptedFields).toHaveLength(2)

      // Wrapped key = 32 bytes plaintext + 16-byte GCM tag → 48 bytes → 96 hex chars.
      // IV = 12 bytes → 24 hex chars.
      expect(result.newWrappedFieldKey).toMatch(/^[0-9a-f]{96}$/)
      expect(result.newFieldKeyIv).toMatch(/^[0-9a-f]{24}$/)

      for (const r of result.reEncryptedFields) {
        expect(r.entryId).toBe(originals.find((o) => o.entryId === r.entryId)!.entryId)
        expect(r.ciphertext).toMatch(/^[0-9a-f]+$/)
        expect(r.ciphertextIv).toMatch(/^[0-9a-f]{24}$/)
        expect(r.ciphertext).not.toBe(currentCiphertexts.find((c) => c.entryId === r.entryId)!.ciphertext)
      }
    })

    it('re-encrypted ciphertexts decrypt with the new field key and match the originals', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const originals = [
        { entryId: 'entry-1', plaintext: 'first secret note' },
        { entryId: 'entry-2', plaintext: 'second secret note' },
      ]
      const currentCiphertexts = await Promise.all(
        originals.map(async ({ entryId, plaintext }) => {
          const enc = await encryptContent(plaintext, oldFieldKey)
          return { entryId, ...enc }
        }),
      )

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey,
        fieldName: FIELD_NAME,
        currentVersion: 1,
        currentCiphertexts,
      })

      for (const r of result.reEncryptedFields) {
        const expected = originals.find((o) => o.entryId === r.entryId)!.plaintext
        await expect(decryptContent(r.ciphertext, r.ciphertextIv, result.newCryptoKey)).resolves.toBe(expected)
      }
    })

    it('the old field key fails to decrypt re-encrypted ciphertexts', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const originals = [{ entryId: 'entry-1', plaintext: 'first secret note' }]
      const currentCiphertexts = await Promise.all(
        originals.map(async ({ entryId, plaintext }) => {
          const enc = await encryptContent(plaintext, oldFieldKey)
          return { entryId, ...enc }
        }),
      )

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey,
        fieldName: FIELD_NAME,
        currentVersion: 1,
        currentCiphertexts,
      })

      for (const r of result.reEncryptedFields) {
        await expect(decryptContent(r.ciphertext, r.ciphertextIv, oldFieldKey)).rejects.toThrow(DecryptionError)
      }
    })

    it('the new wrapped key unwraps with the KEK to the new field key', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const currentCiphertexts = [{ entryId: 'entry-1', ...(await encryptContent('first secret note', oldFieldKey)) }]

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey,
        fieldName: FIELD_NAME,
        currentVersion: 1,
        currentCiphertexts,
      })

      const wrapAad = cryptoUtils.encodeAAD(FIELD_NAME, result.newVersion)
      const unwrappedRaw = await decrypt(cryptoUtils.hexDecode(result.newWrappedFieldKey), kek, {
        iv: cryptoUtils.hexDecode(result.newFieldKeyIv),
        aad: wrapAad,
      })
      const unwrappedKey = await importKey(unwrappedRaw)

      // The unwrapped key decrypts the re-encrypted ciphertext to the original plaintext,
      // proving the wrapped key and the in-memory newCryptoKey are the same key.
      const r = result.reEncryptedFields[0]!
      await expect(decryptContent(r.ciphertext, r.ciphertextIv, unwrappedKey)).resolves.toBe('first secret note')
    })

    it('fails to unwrap the new wrapped key with the old version AAD (rollback protection)', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const currentCiphertexts = [{ entryId: 'entry-1', ...(await encryptContent('first secret note', oldFieldKey)) }]

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey,
        fieldName: FIELD_NAME,
        currentVersion: 1,
        currentCiphertexts,
      })

      // Wrapped with encodeAAD(FIELD_NAME, 2); unwrapping with v1 AAD must fail.
      const staleWrapAad = cryptoUtils.encodeAAD(FIELD_NAME, 1)
      await expect(
        decrypt(cryptoUtils.hexDecode(result.newWrappedFieldKey), kek, {
          iv: cryptoUtils.hexDecode(result.newFieldKeyIv),
          aad: staleWrapAad,
        }),
      ).rejects.toThrow(DecryptionError)
    })

    it('sets the new version to currentVersion + 1', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey,
        fieldName: FIELD_NAME,
        currentVersion: 7,
        currentCiphertexts: [],
      })

      expect(result.newVersion).toBe(8)
    })

    it('returns an empty re-encrypted fields array when there are no entries', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey,
        fieldName: FIELD_NAME,
        currentVersion: 1,
        currentCiphertexts: [],
      })

      expect(result.reEncryptedFields).toEqual([])
      expect(result.newWrappedFieldKey).toMatch(/^[0-9a-f]{96}$/)
    })

    it('zero-fills the raw new field key material', async () => {
      const { kek } = await setupKek()
      const { fieldKey: oldFieldKey } = await makeOldFieldKey()

      const rawNewKey = new Uint8Array(32).fill(0xab)
      const generateKeySpy = vi.spyOn(cryptoUtils, 'generateKey').mockReturnValue(rawNewKey)

      try {
        await rotateFieldKeyCrypto({
          kek,
          oldFieldKey,
          fieldName: FIELD_NAME,
          currentVersion: 1,
          currentCiphertexts: [],
        })

        expect(Array.from(rawNewKey)).toEqual(new Array(32).fill(0))
      } finally {
        generateKeySpy.mockRestore()
      }
    })
  })
})
