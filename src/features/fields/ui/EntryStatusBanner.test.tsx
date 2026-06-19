import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { EntryStatusBanner } from './EntryStatusBanner'
import { ENTRY_STATUS } from '@/features/fields/model/entry-status'

describe('EntryStatusBanner', () => {
  it('renders null for LOADING status', () => {
    const { container } = render(<EntryStatusBanner status={ENTRY_STATUS.LOADING} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null for VALID status', () => {
    const { container } = render(<EntryStatusBanner status={ENTRY_STATUS.VALID} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders "Note not found" message for NOT_FOUND status', () => {
    render(<EntryStatusBanner status={ENTRY_STATUS.NOT_FOUND} />)
    expect(screen.getByRole('status')).toHaveTextContent('Note not found')
  })

  it('renders "This note was deleted" message for DELETED status', () => {
    render(<EntryStatusBanner status={ENTRY_STATUS.DELETED} />)
    expect(screen.getByRole('status')).toHaveTextContent("This note was deleted. Changes won't be saved")
  })

  it('applies rose color classes for NOT_FOUND', () => {
    render(<EntryStatusBanner status={ENTRY_STATUS.NOT_FOUND} />)
    const banner = screen.getByRole('status')
    expect(banner.className).toContain('border-rose-200')
    expect(banner.className).toContain('bg-rose-50')
    expect(banner.className).toContain('text-rose-800')
  })

  it('applies amber color classes for DELETED', () => {
    render(<EntryStatusBanner status={ENTRY_STATUS.DELETED} />)
    const banner = screen.getByRole('status')
    expect(banner.className).toContain('border-amber-200')
    expect(banner.className).toContain('bg-amber-50')
    expect(banner.className).toContain('text-amber-800')
  })

  it('applies animate-fade-in-up class', () => {
    render(<EntryStatusBanner status={ENTRY_STATUS.NOT_FOUND} />)
    expect(screen.getByRole('status').className).toContain('animate-fade-in-up')
  })

  it('has role="status" and aria-live="polite"', () => {
    render(<EntryStatusBanner status={ENTRY_STATUS.NOT_FOUND} />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })
})
