import { useTranslation } from 'react-i18next'
import { ErrorState } from '@/shared/ui/ErrorState'

function NotFoundPage() {
  const { t } = useTranslation('common')

  return <ErrorState className="mt-8" title={t('status.notFound')} description={t('common:errors.pageNotFound')} />
}

export { NotFoundPage }
