import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { useCryptoStore } from '@/shared/crypto/crypto-store'

import { DashboardPage } from './DashboardPage'

describe('DashboardPage', () => {
  it('renders all three field cards', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows locked state for all fields when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true })
    render(<DashboardPage />)
    const lockedMessages = screen.getAllByText('Unlock vault to view')
    expect(lockedMessages).toHaveLength(3)
  })

  it('shows field editors when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<DashboardPage />)
    expect(screen.getByPlaceholderText('Write your note...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter website URL')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter email address')).toBeInTheDocument()
  })

  it('renders dashboard heading', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
