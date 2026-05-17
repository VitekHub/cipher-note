import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@/shared/i18n/config'
import '@/app/styles/globals.css'
import App from '@/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <App />
    </Suspense>
  </StrictMode>,
)
