import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from '@/shared/lib/use-debounced-value'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial value immediately without delay', () => {
    const { result } = renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'hello' },
    })

    expect(result.current).toBe('hello')
  })

  it('debounces subsequent value changes', () => {
    const { result, rerender } = renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })

    expect(result.current).toBe('a')

    rerender({ value: 'b' })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('returns the latest value after the delay', () => {
    const { result, rerender } = renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    rerender({ value: 'c' })

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('c')
  })

  it('cancels the previous timer when value changes during debounce', () => {
    const { result, rerender } = renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(150)
    })

    rerender({ value: 'c' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('c')
  })
})
