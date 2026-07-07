import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { User } from 'lucide-react'

import { SettingsItem } from './SettingsItem'

describe('SettingsItem', () => {
  it('renders with icon and label', () => {
    render(<SettingsItem icon={User} label="Username" />)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('renders as button when onClick is provided and calls handler on click', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<SettingsItem icon={User} label="Username" onClick={handleClick} />)

    const button = screen.getByRole('button', { name: /Username/i })
    expect(button).toBeInTheDocument()
    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders as div without onClick', () => {
    render(<SettingsItem icon={User} label="Username" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('button has correct role and accessible name', () => {
    render(<SettingsItem icon={User} label="Change password" onClick={() => {}} />)
    const button = screen.getByRole('button', { name: /Change password/i })
    expect(button).toHaveAttribute('type', 'button')
  })
})
