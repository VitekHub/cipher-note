import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { FieldCard } from './FieldCard'

describe('FieldCard', () => {
  it('renders locked state with lock icon and locked message', () => {
    render(
      <FieldCard fieldName="note" isLocked={true}>
        <div>unlocked content</div>
      </FieldCard>,
    )
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Unlock vault to view')).toBeInTheDocument()
    expect(screen.queryByText('unlocked content')).not.toBeInTheDocument()
  })

  it('renders unlock button in locked state when onUnlock is provided', () => {
    render(
      <FieldCard fieldName="note" isLocked={true} onUnlock={() => {}}>
        <div>unlocked content</div>
      </FieldCard>,
    )
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
  })

  it('does not render unlock button when onUnlock is not provided', () => {
    render(
      <FieldCard fieldName="note" isLocked={true}>
        <div>unlocked content</div>
      </FieldCard>,
    )
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument()
  })

  it('renders unlocked state with children', () => {
    render(
      <FieldCard fieldName="note" isLocked={false}>
        <div>unlocked content</div>
      </FieldCard>,
    )
    expect(screen.getByText('unlocked content')).toBeInTheDocument()
    expect(screen.queryByText('Unlock vault to view')).not.toBeInTheDocument()
  })

  it('renders correct i18n labels for each field name', () => {
    const { rerender } = render(
      <FieldCard fieldName="note" isLocked={true}>
        <div>content</div>
      </FieldCard>,
    )
    expect(screen.getByText('Note')).toBeInTheDocument()

    rerender(
      <FieldCard fieldName="website" isLocked={true}>
        <div>content</div>
      </FieldCard>,
    )
    expect(screen.getByText('Website')).toBeInTheDocument()

    rerender(
      <FieldCard fieldName="email" isLocked={true}>
        <div>content</div>
      </FieldCard>,
    )
    expect(screen.getByText('Email')).toBeInTheDocument()
  })
})
