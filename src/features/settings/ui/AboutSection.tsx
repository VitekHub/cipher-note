import { useTranslation } from 'react-i18next'
import { Info, Scale } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { CipherNoteIcon } from '@/shared/ui/brand/CipherNoteIcon'
import { GithubIcon } from '@/shared/ui/brand/GithubIcon'

function AboutSection() {
  const { t } = useTranslation(['settings', 'common'])

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <CipherNoteIcon className="size-10" />
        <CardTitle>{t('settings:about.title')}</CardTitle>
        <CardDescription>{t('settings:about.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        <div className="flex items-center justify-between py-2">
          <span className="flex items-center gap-3 text-sm">
            <Info className="size-4" />
            {t('settings:about.version')}
          </span>
          <span className="text-sm font-medium">{t('common:app.version')}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <span className="flex items-center gap-3 text-sm">
            <Scale className="size-4" />
            {t('settings:about.license')}
          </span>
          <span className="text-sm font-medium">{t('common:app.license')}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <span className="flex items-center gap-3 text-sm">
            <GithubIcon className="size-4" />
            {t('settings:about.sourceCode')}
          </span>
          <a
            href={t('common:app.githubUrl')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm font-medium hover:underline"
          >
            GitHub
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

export { AboutSection }
