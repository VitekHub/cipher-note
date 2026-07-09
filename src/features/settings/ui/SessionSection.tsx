import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
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
import { parseUserAgent } from '@/features/settings/lib/parse-user-agent'
import { useActiveSessions, useRevokeSession, useRevokeOtherSessions } from '@/features/settings/model/use-session'
import { SessionRow } from '@/features/settings/ui/SessionRow'

type RevokeMode = { type: 'single'; sessionId: string } | { type: 'all' }

function SessionSection() {
  const { t } = useTranslation('settings')
  const [revokeMode, setRevokeMode] = useState<RevokeMode | null>(null)

  const accessToken = useAuthStore((s) => s.session?.accessToken)
  const currentSessionId = accessToken ? getCurrentSessionId(accessToken) : null

  const { data: sessions, isLoading } = useActiveSessions()
  const revokeSessionMutation = useRevokeSession()
  const revokeOtherSessionsMutation = useRevokeOtherSessions()

  const otherSessions = (sessions ?? []).filter((s) => s.id !== currentSessionId)

  function confirmRevoke() {
    if (!revokeMode) return
    if (revokeMode.type === 'single') {
      revokeSessionMutation.mutate(revokeMode.sessionId, {
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
          setRevokeMode(null)
        },
      })
    } else {
      revokeOtherSessionsMutation.mutate(undefined, {
        onSuccess: (count) => {
          toast.success(t('session.revokeAllSuccess', { count }))
        },
        onError: () => {
          toast.error(t('session.revokeAllFailed'))
        },
        onSettled: () => {
          setRevokeMode(null)
        },
      })
    }
  }

  const isOpen = revokeMode !== null
  const revokeTarget =
    revokeMode?.type === 'single' ? (sessions ?? []).find((s) => s.id === revokeMode.sessionId) : null
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
                    onRevoke={() => setRevokeMode({ type: 'single', sessionId: session.id })}
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
                      onClick={() => setRevokeMode({ type: 'all' })}
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

      <AlertDialog open={isOpen} onOpenChange={(open) => !open && setRevokeMode(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revokeMode?.type === 'all' ? t('session.revokeAllConfirmTitle') : t('session.revokeConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeMode?.type === 'all'
                ? t('session.revokeAllConfirmBody')
                : t('session.revokeConfirmBody', {
                    device: revokeTargetInfo
                      ? t('session.device', { browser: revokeTargetInfo.browser, os: revokeTargetInfo.os })
                      : t('session.revokeConfirmBody_unknownDevice'),
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeMode?.type === 'all' ? t('session.revokeAll') : t('session.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export { SessionSection }
