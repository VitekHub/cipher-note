import type { ReactNode } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { FieldCard } from './FieldCard'
import type { FieldName } from '@/shared/types/entities/field.types'

const baseProps: {
  fieldName: FieldName
  isOfflineAwaitingData: boolean
  children: () => ReactNode
} = {
  fieldName: 'note',
  isOfflineAwaitingData: false,
  children: () => <div data-testid="unlocked-content">unlocked content</div>,
}

describe('FieldCard', () => {
  it('renders children in normal state', () => {
    render(<FieldCard {...baseProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByTestId('unlocked-content')).toBeInTheDocument()
  })

  it('renders offline awaiting data state instead of children', () => {
    render(<FieldCard {...baseProps} isOfflineAwaitingData={true} />)
    expect(screen.getByText('Connect to the internet to load your data')).toBeInTheDocument()
    expect(screen.queryByTestId('unlocked-content')).not.toBeInTheDocument()
  })

  it('renders correct i18n labels for each field name', () => {
    const { rerender } = render(<FieldCard {...baseProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()

    rerender(<FieldCard {...baseProps} fieldName="title" />)
    expect(screen.getByText('Title')).toBeInTheDocument()

    rerender(<FieldCard {...baseProps} fieldName="website" />)
    expect(screen.getByText('Website')).toBeInTheDocument()

    rerender(<FieldCard {...baseProps} fieldName="email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })
})
