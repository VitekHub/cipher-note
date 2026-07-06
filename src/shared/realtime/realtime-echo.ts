import type { FieldName } from '@/shared/types/entities/field.types'

// --- Echo detection (module-scoped, no store dependency) ---

/** Maps "entryId:fieldName" → updatedAt timestamp from local save. */
const localSaveTimestamps = new Map<string, string>()

/** Maps fieldName → the wrapped-key version we just rotated to locally. */
const localKeyRotations = new Map<string, number>()

/** Timer IDs for auto-clearing 'remote-update' status. */
const remoteUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>()

function echoKey(entryId: string, fieldName: FieldName): string {
  return `${entryId}:${fieldName}`
}

/** Store the updatedAt timestamp from a local save so we can detect echoes. */
export function markLocalSave(entryId: string, fieldName: FieldName, updatedAt: string): void {
  localSaveTimestamps.set(echoKey(entryId, fieldName), updatedAt)
}

/**
 * Check whether a realtime event is an echo of our own save.
 * If the updatedAt matches, it's an echo — removes the entry and returns true.
 */
export function isLocalSaveEcho(entryId: string, fieldName: FieldName, updatedAt: string): boolean {
  const key = echoKey(entryId, fieldName)
  const localTs = localSaveTimestamps.get(key)
  if (localTs === updatedAt) {
    localSaveTimestamps.delete(key)
    return true
  }
  // Timestamp didn't match (or wasn't found) — not an echo.
  // Don't delete on mismatch: a stale marker from a different save might still
  // be overwritten by the next local save's markLocalSave call.
  return false
}

/** Clear all echo markers and remote-update timers (for logout/vault lock). */
export function clearEchoMarkers(): void {
  localSaveTimestamps.clear()
  localKeyRotations.clear()
  for (const timer of remoteUpdateTimers.values()) {
    clearTimeout(timer)
  }
  remoteUpdateTimers.clear()
}

/**
 * Schedule auto-clear of 'remote-update' status after 3 seconds.
 * The caller provides an onTimeout callback that runs when the timer fires,
 * so this module stays independent of any particular store.
 */
export function scheduleRemoteUpdateClear(entryId: string, fieldName: FieldName, onTimeout: () => void): void {
  const key = echoKey(entryId, fieldName)
  // Clear any existing timer for this field
  const existing = remoteUpdateTimers.get(key)
  if (existing !== undefined) {
    clearTimeout(existing)
  }
  const timer = setTimeout(() => {
    onTimeout()
    remoteUpdateTimers.delete(key)
  }, 3000)
  remoteUpdateTimers.set(key, timer)
}

/** Record a local key rotation so the echo can be suppressed. Call before the rotation RPC. */
export function markLocalKeyRotation(fieldName: FieldName, version: number): void {
  localKeyRotations.set(fieldName, version)
}

/**
 * True if an `onKeyRotation` event matches a rotation we initiated locally.
 * Consumes the marker on a match so it only suppresses the first matching echo.
 */
export function isLocalKeyRotationEcho(fieldName: FieldName, version: number): boolean {
  const marked = localKeyRotations.get(fieldName)
  if (marked === version) {
    localKeyRotations.delete(fieldName)
    return true
  }
  return false
}
