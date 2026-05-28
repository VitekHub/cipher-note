import { cn } from '@/shared/lib/utils'

interface SegmentedControlItem {
  value: string
  label: string
  icon?: React.ReactNode
}

interface SegmentedControlProps {
  items: SegmentedControlItem[]
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}

function SegmentedControl({ items, value, onChange, ariaLabel }: SegmentedControlProps) {
  return (
    <div className="bg-muted inline-flex rounded-lg p-1" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
            value === item.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          role="tab"
          aria-pressed={value === item.value}
        >
          {item.icon}
          <span className="hidden sm:inline">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

export { SegmentedControl }
export type { SegmentedControlItem }
