import { keyVault } from '@/shared/crypto/key-vault'
import { fetchField, saveField as saveFieldToServer } from '@/shared/api/supabase-fields'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import { encryptField, decryptField, toEncryptedFieldData, toSaveFieldData } from '@/features/fields/model/field-crypto'

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
  async loadField(userId: string, fieldName: FieldName): Promise<string | null> {
    if (!userId) throw new Error('userId is required')
    const fieldKey = this.getFieldKey(fieldName)

    const serverField = await fetchField(userId, fieldName)
    if (!serverField) return null

    const encryptedData = toEncryptedFieldData(serverField)
    return decryptField(encryptedData, fieldKey, fieldName)
  }

  /**
   * Encrypt and save a field's content to the server.
   * Uses upsert — will create or update the field.
   */
  async saveField(userId: string, fieldName: FieldName, plaintext: string): Promise<void> {
    if (!userId) throw new Error('userId is required')
    const fieldKey = this.getFieldKey(fieldName)

    const encryptedData = await encryptField(plaintext, fieldKey, fieldName)
    const saveData = toSaveFieldData(encryptedData)
    await saveFieldToServer(userId, fieldName, saveData)
  }

  /**
   * Load and decrypt all three fields (note, website, email) in parallel.
   * Returns a Record mapping field names to their plaintext content (or null if never saved).
   */
  async loadAllFields(userId: string): Promise<Record<FieldName, string | null>> {
    if (!userId) throw new Error('userId is required')
    const results = await Promise.all(
      FIELD_NAMES.map(async (name) => [name, await this.loadField(userId, name)] as const),
    )
    return Object.fromEntries(results) as Record<FieldName, string | null>
  }
}

export const fieldService = new FieldService()
