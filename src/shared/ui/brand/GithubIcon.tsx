import { cn } from '@/shared/lib/utils'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-5', className)}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3-0.5 6-2.5 6-6a4.7 4.7 0 0 0-1-3.2 3.5 3.5 0 0 0-0.5-2.5s-1-0.3-3 1.2a10.3 10.3 0 0 0-5.5 0c-2-1.5-3-1.2-3-1.2a3.5 3.5 0 0 0-0.5 2.5A4.7 4.7 0 0 0 3 8.5c0 3.5 3 5.5 6 6a4.8 4.8 0 0 0-1 3.5v4" />
      <path d="M9 22c-2.5 0-4-1-4.5-2" />
    </svg>
  )
}

export { GithubIcon }
