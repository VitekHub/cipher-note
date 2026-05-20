import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { FieldCard } from './FieldCard'

describe('FieldCard', () => {
  it('renders locked state with lock icon and locked message', () => {
    render(
      <FieldCard fieldName="note" isLocked={true}>
        {() => <div>unlocked content</div>}
      </FieldCard>,
    )
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Unlock vault to view')).toBeInTheDocument()
    expect(screen.queryByText('unlocked content')).not.toBeInTheDocument()
  })

  it('renders unlock button in locked state when onUnlock is provided', () => {
    const onUnlock = vi.fn()
    render(
      <FieldCard fieldName="note" isLocked={true} onUnlock={onUnlock}>
        {() => <div>unlocked content</div>}
      </FieldCard>,
    )
    const button = screen.getByRole('button', { name: 'Unlock' })
    expect(button).toBeInTheDocument()
  })

  it('calls onUnlock when unlock button is clicked', async () => {
    const onUnlock = vi.fn()
    const user = userEvent.setup()
    render(
      <FieldCard fieldName="note" isLocked={true} onUnlock={onUnlock}>
        {() => <div>unlocked content</div>}
      </FieldCard>,
    )
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it('does not render unlock button when onUnlock is not provided', () => {
    render(
      <FieldCard fieldName="note" isLocked={true}>
        {() => <div>unlocked content</div>}
      </FieldCard>,
    )
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument()
  })

  it('renders unlocked state with children', () => {
    render(
      <FieldCard fieldName="note" isLocked={false}>
        {() => <div>unlocked content</div>}
      </FieldCard>,
    )
    expect(screen.getByText('unlocked content')).toBeInTheDocument()
    expect(screen.queryByText('Unlock vault to view')).not.toBeInTheDocument()
  })

  it('renders correct i18n labels for each field name', () => {
    const { rerender } = render(
      <FieldCard fieldName="note" isLocked={true}>
        {() => <div>content</div>}
      </FieldCard>,
    )
    expect(screen.getByText('Note')).toBeInTheDocument()

    rerender(
      <FieldCard fieldName="website" isLocked={true}>
        {() => <div>content</div>}
      </FieldCard>,
    )
    expect(screen.getByText('Website')).toBeInTheDocument()

    rerender(
      <FieldCard fieldName="email" isLocked={true}>
        {() => <div>content</div>}
      </FieldCard>,
    )
    expect(screen.getByText('Email')).toBeInTheDocument()
  })
})
