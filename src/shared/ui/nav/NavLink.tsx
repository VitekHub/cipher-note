import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/shared/lib/utils'

const navLinkClassName =
  'hover:bg-muted [&.active]:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-md flex items-center rounded-md px-3 py-2 text-sm font-medium outline-none'

function NavLink({ className, ...props }: LinkProps) {
  return <Link className={cn(navLinkClassName, className)} {...props} />
}

export { NavLink }
