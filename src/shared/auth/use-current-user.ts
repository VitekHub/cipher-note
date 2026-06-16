import { useAuth } from '@/shared/auth/auth-context'

/** Returns the current user object, or null if not authenticated. */
function useCurrentUser() {
  return useAuth().user
}

/** Returns the current user's ID. Throws if not authenticated. */
function useRequiredUserId(): string {
  const user = useAuth().user
  if (!user) {
    throw new Error('useRequiredUserId requires an authenticated user')
  }
  return user.id
}

export { useCurrentUser, useRequiredUserId }
