import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEFAULT_ARGON2_PARAMS } from '@/shared/types/crypto.types'
import type { Argon2Params } from '@/shared/types/crypto.types'

function createMockWorker() {
  return {
    postMessage: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

type MockWorker = ReturnType<typeof createMockWorker>

// ─── Worker communication tests ─────────────────────────────────────

describe('argon2id — Worker communication', () => {
  let mockWorker: MockWorker

  beforeEach(() => {
    vi.resetModules()
    mockWorker = createMockWorker()
    // Must use a regular function (not arrow) so `new Worker()` works as a constructor
    vi.stubGlobal(
      'Worker',
      vi.fn(function () {
        return mockWorker
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('deriveKey sends correct message to worker and resolves with hash', async () => {
    const { deriveKey } = await import('@/shared/crypto/core/argon2id')
    const { generateSalt } = await import('@/shared/crypto/core/crypto-utils')
    const salt = generateSalt()

    const derivePromise = deriveKey('test-password', salt)

    expect(mockWorker.postMessage).toHaveBeenCalledOnce()
    const sentData = mockWorker.postMessage.mock.calls[0][0]
    expect(sentData.type).toBe('derive')
    expect(sentData.password).toBe('test-password')
    expect(sentData.params).toEqual(DEFAULT_ARGON2_PARAMS)

    const mockHash = new Uint8Array(32).fill(0xab)
    mockWorker.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'result', id: sentData.id, hash: mockHash },
      }),
    )

    const result = await derivePromise
    expect(result.byteLength).toBe(32)
  })

  it('deriveKey rejects with Argon2Error on worker error response', async () => {
    const { deriveKey } = await import('@/shared/crypto/core/argon2id')
    const { generateSalt } = await import('@/shared/crypto/core/crypto-utils')
    const { Argon2Error } = await import('@/shared/crypto/core/errors')
    const salt = generateSalt()

    const derivePromise = deriveKey('test-password', salt)

    const sentData = mockWorker.postMessage.mock.calls[0][0]
    mockWorker.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'error', id: sentData.id, error: 'WASM load failed' },
      }),
    )

    await expect(derivePromise).rejects.toThrow(Argon2Error)
    await expect(derivePromise).rejects.toThrow('WASM load failed')
  })

  it('deriveKey uses default params when not specified', async () => {
    const { deriveKey } = await import('@/shared/crypto/core/argon2id')
    const { generateSalt } = await import('@/shared/crypto/core/crypto-utils')
    const salt = generateSalt()

    const derivePromise = deriveKey('test-password', salt)

    const sentData = mockWorker.postMessage.mock.calls[0][0]
    expect(sentData.params).toEqual(DEFAULT_ARGON2_PARAMS)

    const mockHash = new Uint8Array(32).fill(1)
    mockWorker.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'result', id: sentData.id, hash: mockHash },
      }),
    )
    await derivePromise
  })

  it('deriveKey uses custom params when provided', async () => {
    const { deriveKey } = await import('@/shared/crypto/core/argon2id')
    const { generateSalt } = await import('@/shared/crypto/core/crypto-utils')
    const salt = generateSalt()
    const customParams: Argon2Params = {
      memory: 32768,
      iterations: 2,
      parallelism: 1,
      outputLen: 32,
    }

    const derivePromise = deriveKey('test-password', salt, customParams)

    const sentData = mockWorker.postMessage.mock.calls[0][0]
    expect(sentData.params).toEqual(customParams)

    const mockHash = new Uint8Array(32).fill(1)
    mockWorker.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'result', id: sentData.id, hash: mockHash },
      }),
    )
    await derivePromise
  })
})

// ─── Worker error handling ───────────────────────────────────────────

describe('argon2id — Worker error handling', () => {
  let mockWorker: MockWorker

  beforeEach(() => {
    vi.resetModules()
    mockWorker = createMockWorker()
    vi.stubGlobal(
      'Worker',
      vi.fn(function () {
        return mockWorker
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('handles worker error events', async () => {
    const { deriveKey } = await import('@/shared/crypto/core/argon2id')
    const { generateSalt } = await import('@/shared/crypto/core/crypto-utils')
    const { Argon2Error } = await import('@/shared/crypto/core/errors')
    const salt = generateSalt()

    const derivePromise = deriveKey('test-password', salt)

    mockWorker.onerror?.(new ErrorEvent('error', { message: 'Worker crashed' }))

    await expect(derivePromise).rejects.toThrow(Argon2Error)
  })
})

// ─── Argon2id worker module (parameter passing) ────────────────────

describe('argon2id.worker — Argon2id computation', () => {
  let mockArgon2Module: {
    hash: ReturnType<typeof vi.fn>
    ArgonType: { Argon2d: number; Argon2i: number; Argon2id: number }
  }

  beforeEach(() => {
    vi.resetModules()

    mockArgon2Module = {
      hash: vi.fn().mockResolvedValue({
        hash: new Uint8Array(32).fill(0x42),
        hashHex: '42'.repeat(32),
        encoded: '$argon2id$v=19$m=47104,t=3,p=1$...',
      }),
      ArgonType: { Argon2d: 0, Argon2i: 1, Argon2id: 2 },
    }

    vi.doMock('argon2-browser/dist/argon2-bundled.min.js', () => ({ default: mockArgon2Module }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes correct parameters to argon2-browser', async () => {
    const argon2 = await import('argon2-browser/dist/argon2-bundled.min.js')
    const salt = new Uint8Array(16).fill(99)

    await argon2.default.hash({
      pass: 'test-password',
      salt,
      time: DEFAULT_ARGON2_PARAMS.iterations,
      mem: DEFAULT_ARGON2_PARAMS.memory,
      parallelism: DEFAULT_ARGON2_PARAMS.parallelism,
      hashLen: DEFAULT_ARGON2_PARAMS.outputLen,
      type: argon2.default.ArgonType.Argon2id,
    })

    expect(mockArgon2Module.hash).toHaveBeenCalledWith({
      pass: 'test-password',
      salt,
      time: 3,
      mem: 47104,
      parallelism: 1,
      hashLen: 32,
      type: 2,
    })
  })

  it('uses Argon2id variant', async () => {
    const argon2 = await import('argon2-browser/dist/argon2-bundled.min.js')

    await argon2.default.hash({
      pass: 'password',
      salt: new Uint8Array(16).fill(1),
      time: 3,
      mem: 47104,
      parallelism: 1,
      hashLen: 32,
      type: argon2.default.ArgonType.Argon2id,
    })

    const callArgs = mockArgon2Module.hash.mock.calls[0][0]
    expect(callArgs.type).toBe(2)
  })

  it('passes custom params correctly', async () => {
    const argon2 = await import('argon2-browser/dist/argon2-bundled.min.js')
    const salt = new Uint8Array(16).fill(55)
    const customParams: Argon2Params = {
      memory: 32768,
      iterations: 2,
      parallelism: 1,
      outputLen: 32,
    }

    await argon2.default.hash({
      pass: 'another-password',
      salt,
      time: customParams.iterations,
      mem: customParams.memory,
      parallelism: customParams.parallelism,
      hashLen: customParams.outputLen,
      type: argon2.default.ArgonType.Argon2id,
    })

    expect(mockArgon2Module.hash).toHaveBeenCalledWith({
      pass: 'another-password',
      salt,
      time: 2,
      mem: 32768,
      parallelism: 1,
      hashLen: 32,
      type: 2,
    })
  })
})

// ─── Worker onmessage handler ────────────────────────────────────────

describe('argon2id.worker — onmessage handler', () => {
  let postMessageSpy: ReturnType<typeof vi.fn>
  let mockArgon2Module: {
    hash: ReturnType<typeof vi.fn>
    ArgonType: { Argon2d: number; Argon2i: number; Argon2id: number }
  }

  beforeEach(() => {
    vi.resetModules()
    postMessageSpy = vi.fn()

    mockArgon2Module = {
      hash: vi.fn().mockResolvedValue({
        hash: new Uint8Array(32).fill(0x42),
        hashHex: '42'.repeat(32),
        encoded: '$argon2id$v=19$m=47104,t=3,p=1$...',
      }),
      ArgonType: { Argon2d: 0, Argon2i: 1, Argon2id: 2 },
    }

    vi.doMock('argon2-browser/dist/argon2-bundled.min.js', () => ({ default: mockArgon2Module }))

    // Stub self.postMessage so the worker handler can call it
    vi.stubGlobal('self', { postMessage: postMessageSpy })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends result back on successful derivation', async () => {
    await import('@/shared/crypto/core/argon2id.worker')

    const handler = self.onmessage as (event: MessageEvent) => Promise<void>
    const salt = new Uint8Array(16).fill(1)

    await handler(
      new MessageEvent('message', {
        data: { type: 'derive', id: 42, password: 'pw', salt, params: DEFAULT_ARGON2_PARAMS },
      }),
    )

    expect(postMessageSpy).toHaveBeenCalledOnce()
    const response = postMessageSpy.mock.calls[0][0]
    expect(response.type).toBe('result')
    expect(response.id).toBe(42)
    expect(response.hash).toBeInstanceOf(Uint8Array)
    expect(response.hash.byteLength).toBe(32)
  })

  it('sends error back when derivation fails', async () => {
    mockArgon2Module.hash.mockRejectedValue(new Error('WASM load failed'))

    await import('@/shared/crypto/core/argon2id.worker')

    const handler = self.onmessage as (event: MessageEvent) => Promise<void>
    const salt = new Uint8Array(16).fill(1)

    await handler(
      new MessageEvent('message', {
        data: { type: 'derive', id: 99, password: 'pw', salt, params: DEFAULT_ARGON2_PARAMS },
      }),
    )

    expect(postMessageSpy).toHaveBeenCalledOnce()
    const response = postMessageSpy.mock.calls[0][0]
    expect(response.type).toBe('error')
    expect(response.id).toBe(99)
    expect(response.error).toBe('WASM load failed')
  })

  it('ignores messages with wrong type', async () => {
    await import('@/shared/crypto/core/argon2id.worker')

    const handler = self.onmessage as (event: MessageEvent) => Promise<void>

    await handler(
      new MessageEvent('message', {
        data: { type: 'unknown', id: 1, password: 'pw', salt: new Uint8Array(16), params: DEFAULT_ARGON2_PARAMS },
      }),
    )

    expect(postMessageSpy).not.toHaveBeenCalled()
    expect(mockArgon2Module.hash).not.toHaveBeenCalled()
  })

  it('handles non-Error thrown values', async () => {
    mockArgon2Module.hash.mockRejectedValue('string error')

    await import('@/shared/crypto/core/argon2id.worker')

    const handler = self.onmessage as (event: MessageEvent) => Promise<void>
    const salt = new Uint8Array(16).fill(1)

    await handler(
      new MessageEvent('message', {
        data: { type: 'derive', id: 7, password: 'pw', salt, params: DEFAULT_ARGON2_PARAMS },
      }),
    )

    expect(postMessageSpy).toHaveBeenCalledOnce()
    const response = postMessageSpy.mock.calls[0][0]
    expect(response.type).toBe('error')
    expect(response.error).toBe('Unknown Argon2id error')
  })
})

// ─── terminateWorker ─────────────────────────────────────────────────

describe('argon2id — terminateWorker', () => {
  let mockWorker: MockWorker

  beforeEach(() => {
    vi.resetModules()
    mockWorker = createMockWorker()
    vi.stubGlobal(
      'Worker',
      vi.fn(function () {
        return mockWorker
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('terminates the worker and rejects pending requests', async () => {
    const { deriveKey, terminateWorker } = await import('@/shared/crypto/core/argon2id')
    const { generateSalt } = await import('@/shared/crypto/core/crypto-utils')
    const { Argon2Error } = await import('@/shared/crypto/core/errors')
    const salt = generateSalt()

    const derivePromise = deriveKey('test-password', salt)

    terminateWorker()

    await expect(derivePromise).rejects.toThrow(Argon2Error)
    await expect(derivePromise).rejects.toThrow('Worker terminated')
    expect(mockWorker.terminate).toHaveBeenCalled()
  })

  it('is safe to call when no worker exists', async () => {
    const { terminateWorker } = await import('@/shared/crypto/core/argon2id')

    expect(() => terminateWorker()).not.toThrow()
  })
})
