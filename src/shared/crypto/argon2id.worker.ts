import type { Argon2Params } from '@/shared/types/crypto.types'
import type { Argon2DeriveRequest, Argon2DeriveResult, Argon2DeriveError } from '@/shared/types/argon2-worker.types'

interface Argon2HashResult {
  hash: Uint8Array
  hashHex: string
  encoded: string
}

interface Argon2Module {
  hash: (params: {
    pass: string
    salt: string | Uint8Array
    time: number
    mem: number
    hashLen: number
    parallelism: number
    type: number
  }) => Promise<Argon2HashResult>
  ArgonType: { Argon2d: number; Argon2i: number; Argon2id: number }
}

// Cache the load promise to deduplicate concurrent calls
let argon2Promise: Promise<Argon2Module> | null = null

function loadArgon2(): Promise<Argon2Module> {
  if (!argon2Promise) {
    argon2Promise = import('argon2-browser').then((m) => m.default as Argon2Module)
  }
  return argon2Promise
}

async function computeArgon2id(password: string, salt: Uint8Array, params: Argon2Params): Promise<Uint8Array> {
  const argon2 = await loadArgon2()
  const result = await argon2.hash({
    pass: password,
    salt,
    time: params.iterations,
    mem: params.memory,
    parallelism: params.parallelism,
    hashLen: params.outputLen,
    type: argon2.ArgonType.Argon2id,
  })
  return result.hash
}

self.onmessage = async (event: MessageEvent<Argon2DeriveRequest>) => {
  const { type, id, password, salt, params } = event.data

  if (type !== 'derive') return

  try {
    const hash = await computeArgon2id(password, salt, params)
    const response: Argon2DeriveResult = { type: 'result', id, hash }
    self.postMessage(response)
  } catch (err) {
    const response: Argon2DeriveError = {
      type: 'error',
      id,
      error: err instanceof Error ? err.message : 'Unknown Argon2id error',
    }
    self.postMessage(response)
  }
}
