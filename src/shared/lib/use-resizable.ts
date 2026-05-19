import { useCallback, useRef, useState } from 'react'

interface UseResizableOptions {
  storedWidth: number
  onWidthChange: (width: number) => void
  minWidth?: number
  maxWidth?: number
}

interface UseResizableReturn {
  width: number
  isDragging: boolean
  handleProps: { onPointerDown: (e: React.PointerEvent) => void }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function useResizable({
  storedWidth,
  onWidthChange,
  minWidth = 150,
  maxWidth = 1000,
}: UseResizableOptions): UseResizableReturn {
  const [localWidth, setLocalWidth] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startWidth: 0 })
  const width = localWidth ?? storedWidth

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startWidth: width }
      setIsDragging(true)

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onPointerMove = (event: PointerEvent) => {
        const delta = event.clientX - dragRef.current.startX
        const next = clamp(dragRef.current.startWidth + delta, minWidth, maxWidth)
        setLocalWidth(next)
      }

      const onPointerUp = () => {
        setIsDragging(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)

        setLocalWidth((current) => {
          onWidthChange(current!)
          return null
        })
      }

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    },
    [width, minWidth, maxWidth, onWidthChange],
  )

  return { width, isDragging, handleProps: { onPointerDown: handlePointerDown } }
}

export { useResizable }
export type { UseResizableOptions, UseResizableReturn }
