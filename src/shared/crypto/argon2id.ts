import type { Argon2Params } from '@/shared/types/crypto.types'
import { DEFAULT_ARGON2_PARAMS } from '@/shared/types/crypto.types'
import type { Argon2DeriveRequest, Argon2WorkerResponse } from '@/shared/types/argon2-worker.types'
import { Argon2Error } from '@/shared/crypto/errors'
import { CRYPTO_SALT_LENGTH } from '@/shared/crypto/constants'
import { hexEncode } from '@/shared/crypto/memory'

interface PendingRequest {
  resolve: (value: Uint8Array<ArrayBuffer>) => void
  reject: (reason: Error) => void
}

let worker: Worker | null = null
let nextRequestId = 0
const pendingRequests = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./argon2id.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = handleWorkerMessage
    worker.onerror = handleWorkerError
  }
  return worker
}

function handleWorkerMessage(event: MessageEvent): void {
  const data = event.data as Argon2WorkerResponse
  const request = pendingRequests.get(data.id)
  if (!request) return

  pendingRequests.delete(data.id)
  if (data.type === 'result') {
    request.resolve(new Uint8Array(data.hash) as Uint8Array<ArrayBuffer>)
  } else {
    request.reject(new Argon2Error(data.error))
  }
}

function cleanupWorker(rejectWith: Error): void {
  for (const request of pendingRequests.values()) {
    request.reject(rejectWith)
  }
  pendingRequests.clear()
  nextRequestId = 0
  worker?.terminate()
  worker = null
}

function handleWorkerError(event: ErrorEvent): void {
  cleanupWorker(new Argon2Error(event.message || 'Worker error'))
}

/** Terminate the Web Worker and reject all pending requests. */
export function terminateWorker(): void {
  cleanupWorker(new Argon2Error('Worker terminated'))
}

/**
 * Derive a key using Argon2id. Runs in a Web Worker to avoid blocking the UI.
 * @param password - The password to derive the key from
 * @param salt - The salt (16+ bytes recommended)
 * @param params - Argon2id parameters (defaults to m=47104, t=3, p=1, outputLen=32)
 */
export function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++
    pendingRequests.set(id, { resolve, reject })
    try {
      getWorker().postMessage({ type: 'derive', id, password, salt, params } satisfies Argon2DeriveRequest)
    } catch (err) {
      pendingRequests.delete(id)
      reject(new Argon2Error(err instanceof Error ? err.message : 'Failed to send message to worker'))
    }
  })
}

/**
 * Derive an auth hash for Supabase Auth verification.
 * Returns a 64-character hex string suitable for use as a "password" in Supabase Auth.
 */
export async function deriveAuthHash(password: string, authSalt: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await deriveKey(password, authSalt)
  return hexEncode(hash)
}

/**
 * Derive a password key for wrapping the master key.
 * Returns a 32-byte Uint8Array for use in AES-256-GCM key wrapping.
 */
export async function derivePasswordKey(
  password: string,
  keySalt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return deriveKey(password, keySalt)
}

/** Generate a cryptographically random salt. */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_SALT_LENGTH)) as Uint8Array<ArrayBuffer>
}

export type { Argon2DeriveRequest as WorkerDeriveRequest, Argon2WorkerResponse as WorkerResponse }
