import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Tooltip', () => {
  it('abre por foco, usa portal e fecha com Escape', () => {
    vi.useFakeTimers()
    render(<Tooltip content="Descrição completa" delay={0} tabIndex={0}>Texto resumido</Tooltip>)

    const trigger = screen.getByText('Texto resumido')
    fireEvent.focus(trigger)
    act(() => { vi.runAllTimers() })

    const tooltip = screen.getByRole('tooltip', { hidden: true })
    expect(tooltip.textContent).toBe('Descrição completa')
    expect(tooltip.parentElement).toBe(document.body)
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id)

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})