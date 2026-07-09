import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Smartphone, Tablet, LogOut, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Spinner } from '@/shared/ui/Spinner'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { getCurrentSessionId } from '@/shared/auth/session-utils'
import { parseUserAgent, formatIP } from '@/features/settings/lib/parse-user-agent'
import { useActiveSessions, useRevokeSession, useRevokeOtherSessions } from '@/features/settings/model/use-session'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
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
  const { t } = useTranslation('settings')
  const parsed = parseUserAgent(userAgent)

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {parsed.deviceType === 'mobile' ? (
          <Smartphone className="text-muted-foreground size-4" />
        ) : parsed.deviceType === 'tablet' ? (
          <Tablet className="text-muted-foreground size-4" />
        ) : (
          <Monitor className="text-muted-foreground size-4" />
        )}
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
          <div className="text-muted-foreground text-xs">
            {parsed.os} · {formatIP(ip)} · {t('session.lastActive', { time: formatRelativeTime(updatedAt) })}
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
          data-testid={`session-revoke-${sessionId}`}
        >
          {isRevoking ? <Spinner size="sm" /> : <LogOut className="size-4" />}
        </Button>
      )}
    </div>
  )
}

function SessionSection() {
  const { t } = useTranslation('settings')
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null)
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false)

  const accessToken = useAuthStore((s) => s.session?.accessToken)
  const currentSessionId = accessToken ? getCurrentSessionId(accessToken) : null

  const { data: sessions, isLoading } = useActiveSessions()
  const revokeSessionMutation = useRevokeSession()
  const revokeOtherSessionsMutation = useRevokeOtherSessions()

  const otherSessions = (sessions ?? []).filter((s) => s.id !== currentSessionId)

  function handleRevokeSession(sessionId: string) {
    setRevokeTargetId(sessionId)
  }

  function confirmRevokeSession() {
    if (!revokeTargetId) return
    revokeSessionMutation.mutate(revokeTargetId, {
      onSuccess: (deleted) => {
        if (deleted) {
          toast.success(t('session.revokeSuccess'))
        } else {
          toast.error(t('session.revokeFailed'))
        }
      },
      onError: () => {
        toast.error(t('session.revokeFailed'))
      },
      onSettled: () => {
        setRevokeTargetId(null)
      },
    })
  }

  function confirmRevokeAll() {
    revokeOtherSessionsMutation.mutate(undefined, {
      onSuccess: (count) => {
        toast.success(t('session.revokeAllSuccess', { count }))
      },
      onError: () => {
        toast.error(t('session.revokeAllFailed'))
      },
      onSettled: () => {
        setShowRevokeAllDialog(false)
      },
    })
  }

  const revokeTarget = (sessions ?? []).find((s) => s.id === revokeTargetId)
  const revokeTargetInfo = revokeTarget ? parseUserAgent(revokeTarget.user_agent) : null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('session.title')}</CardTitle>
          <CardDescription>{t('session.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">{t('session.noSessions')}</p>
          ) : (
            <>
              {sessions.map((session, i) => (
                <div key={session.id}>
                  {i > 0 && <Separator />}
                  <SessionRow
                    sessionId={session.id}
                    userAgent={session.user_agent}
                    ip={session.ip}
                    updatedAt={session.updated_at}
                    isCurrent={session.id === currentSessionId}
                    isRevoking={revokeSessionMutation.isPending && revokeSessionMutation.variables === session.id}
                    onRevoke={() => handleRevokeSession(session.id)}
                  />
                </div>
              ))}
              {otherSessions.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">{t('session.revokeAll')}</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revokeOtherSessionsMutation.isPending}
                      onClick={() => setShowRevokeAllDialog(true)}
                      data-testid="session-revoke-all"
                    >
                      {revokeOtherSessionsMutation.isPending ? (
                        <Spinner size="sm" />
                      ) : (
                        <LogOut className="mr-2 size-4" />
                      )}
                      {t('session.revokeAll')}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={revokeTargetId !== null} onOpenChange={(open) => !open && setRevokeTargetId(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('session.revokeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('session.revokeConfirmBody', {
                device: revokeTargetInfo ? `${revokeTargetInfo.browser} on ${revokeTargetInfo.os}` : 'Unknown',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('session.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('session.revokeAllConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('session.revokeAllConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('session.revokeAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export { SessionSection }
