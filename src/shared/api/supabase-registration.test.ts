import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { FIELD_KEY_VERSION } from '@/shared/types/crypto.types'
import type { RegistrationResult } from '@/shared/types/crypto.types'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { FIELD_KEYS_TABLE } from '@/shared/types/supabase-schema'

vi.mock('@/shared/api/supabase-client', () => {
  const insert = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn().mockReturnValue({ insert })
  return {
    getSupabase: vi.fn().mockReturnValue({ from }),
  }
})

import { getSupabase } from '@/shared/api/supabase-client'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

const USER_ID = 'user-123'

function makeRegistrationResult(): RegistrationResult {
  return {
    authHash: 'a'.repeat(64),
    vault: {
      kek: {} as CryptoKey,
      fieldKeys: new Map([
        ['note', {} as CryptoKey],
        ['website', {} as CryptoKey],
        ['email', {} as CryptoKey],
      ]),
    },
    keyEnvelope: {
      authSalt: mockBytes(16, 0x01),
      keySalt: mockBytes(16, 0x02),
      wrappedMasterKey: mockBytes(48, 0x05),
      masterKeyIV: mockBytes(12, 0x06),
    },
    wrappedFieldKeys: [
      { fieldName: 'note', version: FIELD_KEY_VERSION, wrappedKey: mockBytes(48, 0x10), iv: mockBytes(12, 0x11) },
      { fieldName: 'website', version: FIELD_KEY_VERSION, wrappedKey: mockBytes(48, 0x20), iv: mockBytes(12, 0x21) },
      { fieldName: 'email', version: FIELD_KEY_VERSION, wrappedKey: mockBytes(48, 0x30), iv: mockBytes(12, 0x31) },
    ],
    recovery: {
      recoverySalt: mockBytes(16, 0xaa),
      wrappedMasterKey: mockBytes(48, 0xbb),
      recoveryIV: mockBytes(12, 0xcc),
      mnemonic: 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11',
    },
  }
}

function getMockInsert(): Mock {
  return vi.mocked(getSupabase)().from('').insert as Mock
}

describe('uploadRegistrationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const supabase = vi.mocked(getSupabase)()
    ;(supabase.from('').insert as Mock).mockResolvedValue({ error: null })
  })

  it('inserts into keys table with hex-encoded values', async () => {
    const data = makeRegistrationResult()
    await uploadRegistrationData(data, USER_ID)

    const from = vi.mocked(getSupabase)().from
    expect(from).toHaveBeenCalledWith('keys')

    const insert = getMockInsert()
    expect(insert).toHaveBeenCalledTimes(4)

    const keysRow = insert.mock.calls[0][0]
    expect(keysRow.user_id).toBe(USER_ID)
    expect(keysRow.auth_salt).toHaveLength(32)
    expect(keysRow.key_salt).toHaveLength(32)
    expect(keysRow.wrapped_master_key).toHaveLength(96)
    expect(keysRow.master_key_iv).toHaveLength(24)

    const entriesRow = insert.mock.calls[1][0]
    expect(entriesRow.user_id).toBe(USER_ID)
  })

  it('inserts 3 field_keys rows with correct field names', async () => {
    const data = makeRegistrationResult()
    await uploadRegistrationData(data, USER_ID)

    const from = vi.mocked(getSupabase)().from
    expect(from).toHaveBeenCalledWith(FIELD_KEYS_TABLE)

    const insert = getMockInsert()
    const fieldKeysRows = insert.mock.calls[2][0]
    expect(fieldKeysRows).toHaveLength(3)

    const fieldNames = fieldKeysRows.map((row: { field_name: string }) => row.field_name)
    expect(fieldNames).toEqual(['note', 'website', 'email'])

    for (const row of fieldKeysRows) {
      expect(row.user_id).toBe(USER_ID)
      expect(row.version).toBe(FIELD_KEY_VERSION)
      expect(row.wrapped_key).toHaveLength(96)
      expect(row.key_iv).toHaveLength(24)
    }
  })

  it('inserts into recovery table with hex-encoded values', async () => {
    const data = makeRegistrationResult()
    await uploadRegistrationData(data, USER_ID)

    const from = vi.mocked(getSupabase)().from
    expect(from).toHaveBeenCalledWith('recovery')

    const insert = getMockInsert()
    const recoveryRow = insert.mock.calls[3][0]
    expect(recoveryRow.user_id).toBe(USER_ID)
    expect(recoveryRow.recovery_salt).toHaveLength(32)
    expect(recoveryRow.wrapped_master_key).toHaveLength(96)
    expect(recoveryRow.recovery_iv).toHaveLength(24)
  })

  it('throws ApiError on keys insert error', async () => {
    const insert = getMockInsert()
    insert.mockResolvedValueOnce({ error: new Error('keys insert failed') })
    const data = makeRegistrationResult()

    try {
      await uploadRegistrationData(data, USER_ID)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })

  it('throws ApiError on field_keys insert error', async () => {
    const insert = getMockInsert()
    insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('field_keys insert failed') })
    const data = makeRegistrationResult()

    try {
      await uploadRegistrationData(data, USER_ID)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })

  it('throws ApiError on recovery insert error', async () => {
    const insert = getMockInsert()
    insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('recovery insert failed') })
    const data = makeRegistrationResult()

    try {
      await uploadRegistrationData(data, USER_ID)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})
