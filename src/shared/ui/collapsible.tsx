import { Collapsible } from '@base-ui/react/collapsible'

import { cn } from '@/shared/lib/utils'

function CollapsibleRoot({ className, ...props }: Collapsible.Root.Props) {
  return <Collapsible.Root data-slot="collapsible" className={cn(className)} {...props} />
}

function CollapsibleTrigger({ className, ...props }: Collapsible.Trigger.Props) {
  return <Collapsible.Trigger data-slot="collapsible-trigger" className={cn('cursor-pointer', className)} {...props} />
}

function CollapsiblePanel({ className, keepMounted, ...props }: Collapsible.Panel.Props & { keepMounted?: boolean }) {
  return (
    <Collapsible.Panel
      data-slot="collapsible-panel"
      keepMounted={keepMounted}
      className={cn(
        'h-0 overflow-hidden transition-[height] duration-200 ease-out data-[open]:h-[var(--collapsible-panel-height)]',
        className,
      )}
      {...props}
    />
  )
}

export { CollapsibleRoot, CollapsibleTrigger, CollapsiblePanel }
