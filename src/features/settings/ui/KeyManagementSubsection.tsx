import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, KeyRound } from 'lucide-react'

import { CollapsibleRoot, CollapsibleTrigger, CollapsiblePanel } from '@/shared/ui/collapsible'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useRotateFieldKeyDialogStore } from '@/shared/auth/auth-dialogs-store'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'

// Static keys so i18next-parser can discover them (template literals would not be scanned).
const FIELD_LABEL_KEYS: Record<FieldName, string> = {
  title: 'keyRotation.field.title',
  note: 'keyRotation.field.note',
  website: 'keyRotation.field.website',
  email: 'keyRotation.field.email',
}

/** Highest wrapped-key version stored for a field, from the cached envelope. */
function versionFor(fieldKeys: { fieldName: string; version: number }[] | undefined, fieldName: FieldName): number {
  const versions = (fieldKeys ?? []).filter((k) => k.fieldName === fieldName).map((k) => k.version)
  return versions.length > 0 ? Math.max(...versions) : 1
}

function KeyManagementSubsection() {
  const { t } = useTranslation('settings')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const fieldKeys = useCryptoStore((s) => s.cachedEnvelope?.fieldKeys)
  const openDialog = useRotateFieldKeyDialogStore((s) => s.open)

  return (
    <CollapsibleRoot defaultOpen={false}>
      <CollapsibleTrigger className="group hover:bg-muted/50 -mx-1 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-2 text-left">
        <span className="flex items-center gap-3 text-sm">
          <KeyRound className="size-4" />
          {t('security.keyManagement')}
        </span>
        <ChevronRight className="text-muted-foreground size-4 transition-transform duration-200 group-data-panel-open:rotate-90" />
      </CollapsibleTrigger>
      <CollapsiblePanel keepMounted className="flex flex-col gap-0 pl-7">
        <Separator />
        {FIELD_NAMES.map((fieldName, i) => (
          <Fragment key={fieldName}>
            {i > 0 && <Separator />}
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-3 text-sm">
                <span>{t(FIELD_LABEL_KEYS[fieldName])}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {t('keyRotation.version', { version: versionFor(fieldKeys, fieldName) })}
                </span>
              </span>
              <Button variant="outline" size="sm" disabled={isVaultLocked} onClick={() => openDialog({ fieldName })}>
                {t('keyRotation.rotate')}
              </Button>
            </div>
          </Fragment>
        ))}
        <Separator />
        <Button
          variant="default"
          className="mt-2 w-full"
          disabled={isVaultLocked}
          onClick={() => openDialog({ fieldName: null })}
        >
          {t('keyRotation.rotateAll')}
        </Button>
        {isVaultLocked && <p className="text-muted-foreground mt-1 text-center text-xs">{t('keyRotation.locked')}</p>}
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}

export { KeyManagementSubsection }
