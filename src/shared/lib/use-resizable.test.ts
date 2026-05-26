import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizable } from './use-resizable'

describe('useResizable', () => {
  let onWidthChange: ReturnType<typeof vi.fn<(width: number) => void>>

  beforeEach(() => {
    onWidthChange = vi.fn<(width: number) => void>()
  })

  it('returns stored width initially', () => {
    const { result } = renderHook(() => useResizable({ storedWidth: 240, onWidthChange }))
    expect(result.current.width).toBe(240)
    expect(result.current.isDragging).toBe(false)
  })

  it('syncs width when storedWidth changes', () => {
    const { result, rerender } = renderHook(
      ({ storedWidth }: { storedWidth: number }) => useResizable({ storedWidth, onWidthChange }),
      { initialProps: { storedWidth: 240 } },
    )

    rerender({ storedWidth: 300 })
    expect(result.current.width).toBe(300)
  })

  it('sets isDragging during drag and commits on pointerup', () => {
    const { result } = renderHook(() => useResizable({ storedWidth: 240, onWidthChange }))

    const handle = result.current.handleProps

    act(() => {
      handle.onPointerDown(new PointerEvent('pointerdown', { clientX: 100 }) as unknown as React.PointerEvent)
    })

    expect(result.current.isDragging).toBe(true)

    const moveEvent = new PointerEvent('pointermove', { clientX: 150 })
    act(() => {
      document.dispatchEvent(moveEvent)
    })

    expect(result.current.width).toBe(290) // 240 + (150 - 100)

    const upEvent = new PointerEvent('pointerup')
    act(() => {
      document.dispatchEvent(upEvent)
    })

    expect(result.current.isDragging).toBe(false)
    expect(onWidthChange).toHaveBeenCalledWith(290)
  })

  it('clamps width to minWidth', () => {
    const { result } = renderHook(() => useResizable({ storedWidth: 240, onWidthChange, minWidth: 200 }))

    act(() => {
      result.current.handleProps.onPointerDown(new PointerEvent('pointerdown', { clientX: 300 }) as unknown as React.PointerEvent)
    })

    act(() => {
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 })) // delta = -200
    })

    expect(result.current.width).toBe(200) // clamped from 40
  })

  it('clamps width to maxWidth', () => {
    const { result } = renderHook(() => useResizable({ storedWidth: 240, onWidthChange, maxWidth: 400 }))

    act(() => {
      result.current.handleProps.onPointerDown(new PointerEvent('pointerdown', { clientX: 100 }) as unknown as React.PointerEvent)
    })

    act(() => {
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 400 })) // delta = +300
    })

    expect(result.current.width).toBe(400) // clamped from 540
  })

  it('respects custom min/max bounds', () => {
    const { result } = renderHook(() => useResizable({ storedWidth: 250, onWidthChange, minWidth: 150, maxWidth: 500 }))

    act(() => {
      result.current.handleProps.onPointerDown(new PointerEvent('pointerdown', { clientX: 0 }) as unknown as React.PointerEvent)
    })

    act(() => {
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 400 }))
    })

    expect(result.current.width).toBe(500) // clamped from 650
  })

  it('cleans up document listeners on pointerup', () => {
    const { result } = renderHook(() => useResizable({ storedWidth: 240, onWidthChange }))

    const removeSpy = vi.spyOn(document, 'removeEventListener')

    act(() => {
      result.current.handleProps.onPointerDown(new PointerEvent('pointerdown', { clientX: 100 }) as unknown as React.PointerEvent)
    })

    act(() => {
      document.dispatchEvent(new PointerEvent('pointerup'))
    })

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('pointerup', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('sets and clears body cursor during drag', () => {
    const { result } = renderHook(() => useResizable({ storedWidth: 240, onWidthChange }))

    act(() => {
      result.current.handleProps.onPointerDown(new PointerEvent('pointerdown', { clientX: 100 }) as unknown as React.PointerEvent)
    })

    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')

    act(() => {
      document.dispatchEvent(new PointerEvent('pointerup'))
    })

    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })
})
