import { Moon, Sun, Monitor } from 'lucide-react'

import { useTheme } from '@/shared/lib/theme-provider'

import { SegmentedControl } from '@/shared/ui/SegmentedControl'

type Theme = 'dark' | 'light' | 'system'

const THEME_CYCLE: Theme[] = ['dark', 'light', 'system']

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  dark: <Sun className="size-4" />,
  light: <Moon className="size-4" />,
  system: <Monitor className="size-4" />,
}

const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

const THEME_ITEMS = THEME_CYCLE.map((theme) => ({
  value: theme,
  label: THEME_LABELS[theme],
  icon: THEME_ICONS[theme],
}))

interface ThemeSwitcherProps {
  variant?: 'compact' | 'full'
}

function ThemeSwitcher({ variant = 'compact' }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()

  if (variant === 'full') {
    return <SegmentedControl items={THEME_ITEMS} value={theme} onChange={(v) => setTheme(v as Theme)} />
  }

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(theme)
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length
    setTheme(THEME_CYCLE[nextIndex])
  }

  const nextThemeIndex = (THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length
  const nextTheme = THEME_CYCLE[nextThemeIndex]

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="hover:bg-muted inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
      aria-label={`Switch to ${THEME_LABELS[nextTheme].toLowerCase()} theme`}
    >
      {THEME_ICONS[theme]}
      <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
    </button>
  )
}

export { ThemeSwitcher }
