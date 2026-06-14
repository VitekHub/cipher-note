import { keyVault } from '@/shared/crypto/key-vault'
import { fetchField, fetchAllFields, saveField as saveFieldToServer } from '@/shared/api/supabase-fields'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import { encryptField, decryptField, toEncryptedFieldData, toSaveFieldData } from '@/features/fields/model/field-crypto'

const ENTRY_ID_REQUIRED = 'entryId is required'
const USER_ID_REQUIRED = 'userId is required'

interface SaveFieldParams {
  userId: string
  entryId: string
  fieldName: FieldName
  plaintext: string
}

class FieldService {
  private getFieldKey(fieldName: FieldName): CryptoKey {
    const key = keyVault.getKey(fieldName)
    if (!key) throw new Error(`Field key not available for "${fieldName}" — vault may be locked`)
    return key
  }

  /**
   * Load and decrypt a single field's content from the server.
   * Returns null if the field has never been saved.
   */
  async loadField(entryId: string, fieldName: FieldName): Promise<string | null> {
    if (!entryId) throw new Error(ENTRY_ID_REQUIRED)
    const fieldKey = this.getFieldKey(fieldName)

    const serverField = await fetchField(entryId, fieldName)
    if (!serverField) return null

    const encryptedData = toEncryptedFieldData(serverField)
    return decryptField(encryptedData, fieldKey, fieldName)
  }

  /**
   * Encrypt and save a field's content to the server.
   * Uses upsert — will create or update the field.
   */
  async saveField({ userId, entryId, fieldName, plaintext }: SaveFieldParams): Promise<void> {
    if (!userId) throw new Error(USER_ID_REQUIRED)
    if (!entryId) throw new Error(ENTRY_ID_REQUIRED)
    const fieldKey = this.getFieldKey(fieldName)

    const encryptedData = await encryptField(plaintext, fieldKey, fieldName)
    const saveData = toSaveFieldData(encryptedData, entryId, fieldName)
    await saveFieldToServer(userId, saveData)
  }

  /**
   * Load and decrypt all four fields (title, note, website, email).
   * Returns null for fields that were never saved.
   */
  async loadAllFields(entryId: string): Promise<Record<FieldName, string | null>> {
    if (!entryId) throw new Error(ENTRY_ID_REQUIRED)
    const serverFields = await fetchAllFields(entryId)
    const decryptionResults = await Promise.all(
      serverFields.map(async (serverField) => {
        const fieldKey = this.getFieldKey(serverField.fieldName)
        const encryptedData = toEncryptedFieldData(serverField)
        const plaintext = await decryptField(encryptedData, fieldKey, serverField.fieldName)
        return [serverField.fieldName, plaintext] as const
      }),
    )
    const result = Object.fromEntries(FIELD_NAMES.map((name) => [name, null])) as Record<FieldName, string | null>
    for (const [name, plaintext] of decryptionResults) {
      result[name] = plaintext
    }
    return result
  }
}

export const fieldService = new FieldService()
