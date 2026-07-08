import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppErrorBoundary } from '@/app/AppErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

describe('AppErrorBoundary', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    })
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('renders children when no error', () => {
    render(
      <AppErrorBoundary>
        <span>ok content</span>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('ok content')).toBeInTheDocument()
  })

  it('renders fallback when a child throws', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByText('ok content')).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('reloads the page when the reload button is clicked', async () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })
})
