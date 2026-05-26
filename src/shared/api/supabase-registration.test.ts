import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FIELD_KEY_VERSION } from '@/shared/types/crypto.types'
import type { RegistrationResult, RecoveryData } from '@/shared/types/crypto.types'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: vi.fn().mockReturnValue({ from: mockFrom }),
}))

import { uploadRegistrationData } from '@/shared/api/supabase-registration'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

const USER_ID = 'user-123'

function makeRegistrationResult(): RegistrationResult {
  const recoveryData: RecoveryData = {
    recoverySalt: mockBytes(16, 0xaa),
    wrappedMasterKey: mockBytes(48, 0xbb),
    recoveryIV: mockBytes(12, 0xcc),
  }

  return {
    authHash: 'a'.repeat(64),
    authSalt: mockBytes(16, 0x01),
    keySalt: mockBytes(16, 0x02),
    masterKey: mockBytes(32, 0x03),
    kek: mockBytes(32, 0x04),
    fieldKeys: new Map([
      ['note', mockBytes(32, 0x10)],
      ['website', mockBytes(32, 0x20)],
      ['email', mockBytes(32, 0x30)],
    ]),
    wrappedMasterKey: mockBytes(48, 0x05),
    masterKeyIV: mockBytes(12, 0x06),
    wrappedFieldKeys: [
      { fieldName: 'note', version: FIELD_KEY_VERSION, wrappedKey: mockBytes(48, 0x10), iv: mockBytes(12, 0x11) },
      { fieldName: 'website', version: FIELD_KEY_VERSION, wrappedKey: mockBytes(48, 0x20), iv: mockBytes(12, 0x21) },
      { fieldName: 'email', version: FIELD_KEY_VERSION, wrappedKey: mockBytes(48, 0x30), iv: mockBytes(12, 0x31) },
    ],
    recoveryData,
    mnemonic: 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11',
  }
}

describe('uploadRegistrationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('inserts into keys table with hex-encoded values', async () => {
    const data = makeRegistrationResult()
    await uploadRegistrationData(data, USER_ID)

    expect(mockFrom).toHaveBeenCalledWith('keys')

    expect(mockInsert).toHaveBeenCalledTimes(3)

    const keysRow = mockInsert.mock.calls[0][0]
    expect(keysRow.user_id).toBe(USER_ID)
    expect(keysRow.auth_salt).toHaveLength(32)
    expect(keysRow.key_salt).toHaveLength(32)
    expect(keysRow.wrapped_master_key).toHaveLength(96)
    expect(keysRow.master_key_iv).toHaveLength(24)
  })

  it('inserts 3 field_keys rows with correct field names', async () => {
    const data = makeRegistrationResult()
    await uploadRegistrationData(data, USER_ID)

    expect(mockFrom).toHaveBeenCalledWith('field_keys')

    const fieldKeysRows = mockInsert.mock.calls[1][0]
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

    expect(mockFrom).toHaveBeenCalledWith('recovery')

    const recoveryRow = mockInsert.mock.calls[2][0]
    expect(recoveryRow.user_id).toBe(USER_ID)
    expect(recoveryRow.recovery_salt).toHaveLength(32)
    expect(recoveryRow.wrapped_master_key).toHaveLength(96)
    expect(recoveryRow.recovery_iv).toHaveLength(24)
  })

  it('throws on keys insert error', async () => {
    mockInsert.mockResolvedValueOnce({ error: new Error('keys insert failed') })
    const data = makeRegistrationResult()

    await expect(uploadRegistrationData(data, USER_ID)).rejects.toThrow('keys insert failed')
  })

  it('throws on field_keys insert error', async () => {
    mockInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('field_keys insert failed') })
    const data = makeRegistrationResult()

    await expect(uploadRegistrationData(data, USER_ID)).rejects.toThrow('field_keys insert failed')
  })

  it('throws on recovery insert error', async () => {
    mockInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('recovery insert failed') })
    const data = makeRegistrationResult()

    await expect(uploadRegistrationData(data, USER_ID)).rejects.toThrow('recovery insert failed')
  })
})
