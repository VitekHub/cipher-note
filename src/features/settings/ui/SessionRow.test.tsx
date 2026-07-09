import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { SessionRow } from './SessionRow'

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36'
const TABLET_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'

const defaultProps = {
  sessionId: 'session-1',
  userAgent: DESKTOP_UA,
  ip: '192.168.1.42',
  updatedAt: new Date().toISOString(),
  isCurrent: false,
  isRevoking: false,
  onRevoke: vi.fn(),
}

describe('SessionRow', () => {
  it('renders browser name from user agent', () => {
    render(<SessionRow {...defaultProps} />)
    expect(screen.getByText('Chrome')).toBeInTheDocument()
  })

  it('renders OS from user agent', () => {
    render(<SessionRow {...defaultProps} />)
    expect(screen.getByText(/Windows/)).toBeInTheDocument()
  })

  it('renders masked IP address', () => {
    render(<SessionRow {...defaultProps} />)
    expect(screen.getByText(/192\.168\.1\.\*/)).toBeInTheDocument()
  })

  it('renders dash for null IP', () => {
    render(<SessionRow {...defaultProps} ip={null} />)
    expect(screen.getByText(/—/)).toBeInTheDocument()
  })

  it('shows current device indicator when isCurrent is true', () => {
    render(<SessionRow {...defaultProps} isCurrent={true} />)
    // i18next translates session.currentDevice to "Current device"
    expect(screen.getAllByText('Current device').length).toBeGreaterThanOrEqual(1)
  })

  it('does not show revoke button for current device', () => {
    render(<SessionRow {...defaultProps} isCurrent={true} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows revoke button for other devices', () => {
    render(<SessionRow {...defaultProps} isCurrent={false} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('disables revoke button when revoking', () => {
    render(<SessionRow {...defaultProps} isRevoking={true} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onRevoke when revoke button is clicked', async () => {
    const onRevoke = vi.fn()
    const user = userEvent.setup()
    render(<SessionRow {...defaultProps} onRevoke={onRevoke} />)
    await user.click(screen.getByRole('button'))
    expect(onRevoke).toHaveBeenCalledTimes(1)
  })

  it('renders Monitor icon for desktop user agent', () => {
    const { container } = render(<SessionRow {...defaultProps} userAgent={DESKTOP_UA} />)
    const svg = container.querySelector('svg.lucide-monitor')
    expect(svg).toBeInTheDocument()
  })

  it('renders Smartphone icon for mobile user agent', () => {
    const { container } = render(<SessionRow {...defaultProps} userAgent={MOBILE_UA} />)
    const svg = container.querySelector('svg.lucide-smartphone')
    expect(svg).toBeInTheDocument()
  })

  it('renders Tablet icon for tablet user agent', () => {
    const { container } = render(<SessionRow {...defaultProps} userAgent={TABLET_UA} />)
    const svg = container.querySelector('svg.lucide-tablet')
    expect(svg).toBeInTheDocument()
  })

  it('renders Unknown for null user agent', () => {
    render(<SessionRow {...defaultProps} userAgent={null} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('has correct data-testid on revoke button', () => {
    render(<SessionRow {...defaultProps} sessionId="abc-123" />)
    expect(screen.getByTestId('session-revoke-abc-123')).toBeInTheDocument()
  })
})