import { Link, type LinkComponentProps } from '@tanstack/react-router'
import { cn } from '@/shared/lib/utils'

const navLinkClassName =
  'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-md flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium outline-none md:min-h-0'

function NavLink({ className, ...props }: LinkComponentProps) {
  return <Link className={cn(navLinkClassName, className)} {...props} />
}

export { NavLink }
