import { useAuthStore } from '@/features/auth/model/auth-store'

function useCurrentUser() {
  return useAuthStore((s) => s.user)
}

export { useCurrentUser }
