import { Moon, Sun, Monitor } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { useTheme } from '@/shared/lib/theme-provider'

const THEME_CYCLE = ['dark', 'light', 'system'] as const
type Theme = (typeof THEME_CYCLE)[number]

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  dark: <Sun className="size-4" />,
  light: <Moon className="size-4" />,
  system: <Monitor className="size-4" />,
}

const THEME_LABELS: Record<Theme, string> = {
  dark: 'Switch to light theme',
  light: 'Switch to system theme',
  system: 'Switch to dark theme',
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(theme as Theme)
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length
    setTheme(THEME_CYCLE[nextIndex])
  }

  return (
    <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label={THEME_LABELS[theme as Theme]}>
      {THEME_ICONS[theme as Theme]}
    </Button>
  )
}

export { ThemeToggle }
