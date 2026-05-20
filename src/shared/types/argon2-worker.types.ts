import type { Argon2Params } from '@/shared/types/crypto.types'

export interface Argon2DeriveRequest {
  type: 'derive'
  id: number
  password: string
  salt: Uint8Array
  params: Argon2Params
}

export interface Argon2DeriveResult {
  type: 'result'
  id: number
  hash: Uint8Array
}

export interface Argon2DeriveError {
  type: 'error'
  id: number
  error: string
}

export type Argon2WorkerMessage = Argon2DeriveRequest
export type Argon2WorkerResponse = Argon2DeriveResult | Argon2DeriveError
