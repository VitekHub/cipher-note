import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { z } from 'zod'
import { AuthForm, type AuthFieldConfig } from './AuthForm'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

const testSchema = z.object({
  username: z.string().min(1, 'test.errors.usernameRequired'),
  password: z.string().min(1, 'test.errors.passwordRequired'),
})

type TestFormData = z.infer<typeof testSchema>

const testFields: AuthFieldConfig<TestFormData>[] = [
  { name: 'username', id: 'username', type: 'text', autoComplete: 'username' },
  { name: 'password', id: 'password', type: 'password', autoComplete: 'current-password' },
]

describe('AuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-navigates when onSuccess is not provided', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ user: { id: '1' } })

    render(
      <AuthForm<TestFormData>
        schema={testSchema}
        defaultValues={{ username: '', password: '' }}
        fields={testFields}
        onSubmit={onSubmit}
        i18nPrefix="login"
        successRedirect="/dashboard"
        footer={{ textKey: 'login.noAccount', linkLabelKey: 'login.registerLink', linkTo: '/register' }}
      />,
    )

    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'testpass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('testuser', 'testpass123')
    })
  })

  it('calls onSuccess with result instead of navigating when provided', async () => {
    const user = userEvent.setup()
    const result = { user: { id: '1' }, mnemonic: 'word1 word2' }
    const onSubmit = vi.fn().mockResolvedValue(result)
    const onSuccess = vi.fn()

    render(
      <AuthForm<TestFormData>
        schema={testSchema}
        defaultValues={{ username: '', password: '' }}
        fields={testFields}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
        i18nPrefix="login"
        successRedirect="/dashboard"
        footer={{ textKey: 'login.noAccount', linkLabelKey: 'login.registerLink', linkTo: '/register' }}
      />,
    )

    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'testpass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(result)
    })
  })

  it('renders renderAfterField content after the specified field', () => {
    render(
      <AuthForm<TestFormData>
        schema={testSchema}
        defaultValues={{ username: '', password: '' }}
        fields={testFields}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        renderAfterField={(fieldName) =>
          fieldName === 'password' ? <div data-testid="after-password">Extra content</div> : null
        }
        i18nPrefix="login"
        successRedirect="/dashboard"
        footer={{ textKey: 'login.noAccount', linkLabelKey: 'login.registerLink', linkTo: '/register' }}
      />,
    )

    expect(screen.getByTestId('after-password')).toBeInTheDocument()
  })

  it('passes form values to renderAfterField', () => {
    render(
      <AuthForm<TestFormData>
        schema={testSchema}
        defaultValues={{ username: 'defaultuser', password: '' }}
        fields={testFields}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        renderAfterField={(fieldName, values) =>
          fieldName === 'username' ? <div data-testid="form-values">{JSON.stringify(values)}</div> : null
        }
        i18nPrefix="login"
        successRedirect="/dashboard"
        footer={{ textKey: 'login.noAccount', linkLabelKey: 'login.registerLink', linkTo: '/register' }}
      />,
    )

    expect(screen.getByTestId('form-values')).toHaveTextContent('defaultuser')
  })

  it('shows error toast when onSubmit throws', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Invalid login credentials'))
    const { toast } = await import('sonner')

    render(
      <AuthForm<TestFormData>
        schema={testSchema}
        defaultValues={{ username: '', password: '' }}
        fields={testFields}
        onSubmit={onSubmit}
        i18nPrefix="login"
        successRedirect="/dashboard"
        footer={{ textKey: 'login.noAccount', linkLabelKey: 'login.registerLink', linkTo: '/register' }}
      />,
    )

    await user.type(screen.getByLabelText('Username'), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'testpass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid username or password')
    })
  })
})
