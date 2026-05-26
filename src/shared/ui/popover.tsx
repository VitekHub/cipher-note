import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/shared/lib/utils'

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverPortal({ ...props }: PopoverPrimitive.Portal.Props) {
  return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />
}

function PopoverPositioner({ ...props }: PopoverPrimitive.Positioner.Props) {
  return <PopoverPrimitive.Positioner data-slot="popover-positioner" {...props} />
}

function PopoverContent({ className, children, ...props }: PopoverPrimitive.Popup.Props) {
  return (
    <PopoverPrimitive.Portal data-slot="popover-portal">
      <PopoverPrimitive.Positioner sideOffset={8}>
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 z-50 rounded-lg p-3 shadow-md ring-1 ring-black/10 outline-none',
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />
}

function PopoverArrow({ className, ...props }: PopoverPrimitive.Arrow.Props) {
  return (
    <PopoverPrimitive.Arrow
      data-slot="popover-arrow"
      className={cn(
        'bg-popover border-border size-3 rotate-45 data-[side=bottom]:-top-1.5 data-[side=left]:-right-1.5 data-[side=right]:-left-1.5 data-[side=top]:-bottom-1.5',
        'data-[side=right]:border-t-0 data-[side=right]:border-r-0 data-[side=right]:border-b data-[side=right]:border-l',
        'data-[side=left]:border-t data-[side=left]:border-r data-[side=left]:border-b-0 data-[side=left]:border-l-0',
        'data-[side=bottom]:border-t data-[side=bottom]:border-r-0 data-[side=bottom]:border-b-0 data-[side=bottom]:border-l',
        'data-[side=top]:border-t-0 data-[side=top]:border-r data-[side=top]:border-b data-[side=top]:border-l-0',
        className,
      )}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('font-heading text-sm font-medium', className)}
      {...props}
    />
  )
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverPortal,
  PopoverPositioner,
  PopoverTitle,
  PopoverTrigger,
}
