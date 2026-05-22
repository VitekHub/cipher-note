import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '@/shared/api/supabase-client'
import { USERNAME_PATTERN } from '@/shared/auth/username-utils'
import { useDebouncedValue } from '@/shared/lib/use-debounced-value'

export type UsernameAvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

interface UseUsernameAvailabilityOptions {
  username: string
  enabled?: boolean
}

interface UseUsernameAvailabilityResult {
  status: UsernameAvailabilityStatus
}

function useUsernameAvailability({
  username,
  enabled = true,
}: UseUsernameAvailabilityOptions): UseUsernameAvailabilityResult {
  const debouncedUsername = useDebouncedValue(username, 1500)
  const formatValid = enabled && username.length > 0 && USERNAME_PATTERN.test(username)

  const shouldQuery = formatValid && debouncedUsername === username

  const { data, isError, isLoading } = useQuery({
    queryKey: ['username-availability', debouncedUsername],
    queryFn: async ({ queryKey }) => {
      const [, name] = queryKey
      const supabase = getSupabase()
      const { data, error } = await supabase.rpc('check_username_availability', {
        p_username: name,
      })
      if (error) throw error
      return data as boolean
    },
    enabled: shouldQuery,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  let status: UsernameAvailabilityStatus = 'idle'

  if (!formatValid) {
    status = 'idle'
  } else if (debouncedUsername !== username) {
    status = 'checking'
  } else if (isLoading) {
    status = 'checking'
  } else if (isError) {
    status = 'error'
  } else if (data === true) {
    status = 'available'
  } else if (data === false) {
    status = 'taken'
  }

  return { status }
}

export { useUsernameAvailability }
