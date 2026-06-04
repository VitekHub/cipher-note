import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@/test/utils'

import { OfflineBanner, BACK_ONLINE_DISPLAY_MS, EXIT_ANIMATION_MS } from './OfflineBanner'

function mockNavigatorOnLine(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    get: () => online,
    configurable: true,
  })
}

function goOffline() {
  mockNavigatorOnLine(false)
  window.dispatchEvent(new Event('offline'))
}

function goOnline() {
  mockNavigatorOnLine(true)
  window.dispatchEvent(new Event('online'))
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockNavigatorOnLine(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    mockNavigatorOnLine(true)
  })

  it('renders nothing when online', () => {
    const { container } = render(<OfflineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows offline banner when offline', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('You are offline')
  })

  it('shows back-online message when coming back online', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('You are offline')

    act(() => {
      goOnline()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Back online')
  })

  it('auto-hides after display period when back online', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)

    act(() => {
      goOnline()
    })

    // Still visible before display period ends
    act(() => {
      vi.advanceTimersByTime(BACK_ONLINE_DISPLAY_MS - 500)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Back online')

    // Start of exit animation after display period
    act(() => {
      vi.advanceTimersByTime(500)
    })
    // Hidden after exit animation
    act(() => {
      vi.advanceTimersByTime(EXIT_ANIMATION_MS)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('cancels auto-hide timer when going offline again', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)

    act(() => {
      goOnline()
    })

    act(() => {
      vi.advanceTimersByTime(BACK_ONLINE_DISPLAY_MS - 1000)
    })

    // Go offline again before display timer expires
    act(() => {
      goOffline()
    })
    expect(screen.getByRole('status')).toHaveTextContent('You are offline')

    // Advance past original display period — banner should still be visible
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('status')).toHaveTextContent('You are offline')
  })

  it('renders WifiOff icon when offline and Wifi icon when back online', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)

    const statusEl = screen.getByRole('status')
    expect(statusEl.querySelector('svg')).toBeInTheDocument()

    act(() => {
      goOnline()
    })
    expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument()
  })

  it('has aria-live="polite" for accessibility', () => {
    mockNavigatorOnLine(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
