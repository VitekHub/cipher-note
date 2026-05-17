import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/i18n/config'
import '@/app/styles/globals.css'
import { AppProviders } from '@/app/providers'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
)
