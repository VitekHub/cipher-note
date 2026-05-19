import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/shared/lib/utils'

const navLinkClassName =
  'hover:bg-muted [&.active]:bg-muted flex items-center rounded-md px-3 py-2 text-sm font-medium'

function NavLink({ className, ...props }: LinkProps) {
  return <Link className={cn(navLinkClassName, className)} {...props} />
}

export { NavLink }