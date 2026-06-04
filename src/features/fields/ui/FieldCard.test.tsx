import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { FieldCard } from './FieldCard'
import type { FieldName } from '@/shared/types/entities/field.types'

const baseProps: {
  fieldName: FieldName
  isLocked: boolean
  isOfflineAwaitingData: boolean
  children: () => ReactNode
} = {
  fieldName: 'note',
  isLocked: true,
  isOfflineAwaitingData: false,
  children: () => <div>unlocked content</div>,
}

describe('FieldCard', () => {
  it('renders locked state with lock icon and locked message', () => {
    render(<FieldCard {...baseProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Unlock vault to view')).toBeInTheDocument()
    expect(screen.queryByText('unlocked content')).not.toBeInTheDocument()
  })

  it('renders unlock button in locked state when onUnlock is provided', () => {
    render(<FieldCard {...baseProps} onUnlock={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
  })

  it('calls onUnlock when unlock button is clicked', async () => {
    const onUnlock = vi.fn()
    const user = userEvent.setup()
    render(<FieldCard {...baseProps} onUnlock={onUnlock} />)
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it('does not render unlock button when onUnlock is not provided', () => {
    render(<FieldCard {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument()
  })

  it('renders unlocked state with children', () => {
    render(<FieldCard {...baseProps} isLocked={false} />)
    expect(screen.getByText('unlocked content')).toBeInTheDocument()
    expect(screen.queryByText('Unlock vault to view')).not.toBeInTheDocument()
  })

  it('renders offline awaiting data state instead of children', () => {
    render(<FieldCard {...baseProps} isLocked={false} isOfflineAwaitingData={true} />)
    expect(screen.getByText('Connect to the internet to load your data')).toBeInTheDocument()
    expect(screen.queryByText('unlocked content')).not.toBeInTheDocument()
  })

  it('renders correct i18n labels for each field name', () => {
    const { rerender } = render(<FieldCard {...baseProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()

    rerender(<FieldCard {...baseProps} fieldName="website" />)
    expect(screen.getByText('Website')).toBeInTheDocument()

    rerender(<FieldCard {...baseProps} fieldName="email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })
})
