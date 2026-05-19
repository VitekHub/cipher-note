import { cn } from '@/shared/lib/utils'

interface ResizeHandleProps {
  isDragging: boolean
  handleProps: { onPointerDown: (e: React.PointerEvent) => void }
}

function ResizeHandle({ isDragging, handleProps }: ResizeHandleProps) {
  return (
    <div
      {...handleProps}
      data-slot="resize-handle"
      className={cn(
        'group relative hidden cursor-col-resize select-none md:flex',
        'hover:bg-sidebar-primary/20 active:bg-sidebar-primary/30',
        'transition-colors duration-150',
        isDragging && 'bg-sidebar-primary/30',
      )}
      role="separator"
      aria-orientation="vertical"
      tabIndex={-1}
    >
      <div className="absolute inset-y-0 -left-1 w-3" />
      <div className="mx-[2px] flex flex-col items-center justify-center gap-[3px] self-center">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-[3px]">
            {Array.from({ length: 2 }, (_, j) => (
              <span
                key={`${i}-${j}`}
                className="bg-sidebar-foreground/25 group-hover:bg-sidebar-foreground/50 size-0.5 rounded-full transition-colors"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export { ResizeHandle }
