import { useTranslation } from 'react-i18next'
import { Monitor, Smartphone, Tablet, LogOut, ShieldCheck, type LucideIcon } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/Spinner'
import { parseUserAgent, formatIP } from '@/features/settings/lib/parse-user-agent'

const DEVICE_ICONS: Record<string, LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
}

function formatRelativeTime(dateString: string, language: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })

  if (diffSecs < 60) return rtf.format(-diffSecs, 'second')
  if (diffMins < 60) return rtf.format(-diffMins, 'minute')
  if (diffHours < 24) return rtf.format(-diffHours, 'hour')
  if (diffDays < 7) return rtf.format(-diffDays, 'day')
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(dateString))
}

function formatFullDate(dateString: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateString))
}

function SessionRow({
  sessionId,
  userAgent,
  ip,
  updatedAt,
  isCurrent,
  isRevoking,
  onRevoke,
}: {
  sessionId: string
  userAgent: string | null
  ip: string | null
  updatedAt: string
  isCurrent: boolean
  isRevoking: boolean
  onRevoke: () => void
}) {
  const { t, i18n } = useTranslation('settings')
  const parsed = parseUserAgent(userAgent)
  const DeviceIcon = DEVICE_ICONS[parsed.deviceType] ?? Monitor

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <DeviceIcon className="text-muted-foreground size-4" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{parsed.browser}</span>
            {isCurrent && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <ShieldCheck className="size-3" />
                {t('session.currentDevice')}
              </span>
            )}
          </div>
          <div className="text-muted-foreground text-xs" title={formatFullDate(updatedAt, i18n.language)}>
            {parsed.os} · {formatIP(ip)} · {t('session.lastActive', { time: formatRelativeTime(updatedAt, i18n.language) })}
          </div>
        </div>
      </div>
      {isCurrent ? (
        <span className="text-muted-foreground text-xs">{t('session.currentDevice')}</span>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={isRevoking}
          onClick={onRevoke}
          title={t('session.revoke')}
          data-testid={`session-revoke-${sessionId}`}
        >
          {isRevoking ? <Spinner size="sm" /> : <LogOut className="size-4" />}
        </Button>
      )}
    </div>
  )
}

export { SessionRow }
