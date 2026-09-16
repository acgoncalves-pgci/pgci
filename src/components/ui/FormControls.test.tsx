import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Checkbox } from './Checkbox'
import { Dialog } from './Dialog'
import { Input } from './Input'
import { Select } from './Select'
import { Switch } from './Switch'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('controles de formulário', () => {
  it('mantém atributos nativos, estados inválidos e valores controlados', () => {
    render(<form><label htmlFor="assunto">Assunto</label><Input id="assunto" aria-invalid="true" defaultValue="Inicial"/><label htmlFor="tipo">Tipo</label><Select id="tipo" defaultValue="memo"><option value="memo">Memorando</option><option value="oficio">Ofício</option></Select></form>)

    const input = screen.getByLabelText('Assunto') as HTMLInputElement
    expect(input.value).toBe('Inicial')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.className).toContain('ui-input')
    const select = screen.getByRole('combobox', { name: 'Tipo' })
    expect(select.textContent).toContain('Memorando')
    fireEvent.click(select)
    fireEvent.click(screen.getByRole('option', { name: 'Ofício' }))
    expect(select.textContent).toContain('Ofício')
  })

  it('porta a lista para fora do modal e preserva opções longas', () => {
    const longOption = 'Unidade de acompanhamento orçamentário e financeiro'
    render(<Dialog title="Editar unidade" onClose={() => undefined}><label htmlFor="unidade">Unidade superior</label><Select id="unidade"><option value="">Selecione</option><option value="financeiro">{longOption}</option></Select></Dialog>)

    fireEvent.click(screen.getByRole('combobox', { name: 'Unidade superior' }))
    const dialog = screen.getByRole('dialog')
    const listbox = screen.getByRole('listbox')
    const option = screen.getByRole('option', { name: longOption })

    expect(dialog.contains(listbox)).toBe(false)
    expect(listbox.parentElement).toBe(document.body)
    expect(option.querySelector('span')?.className).toContain('whitespace-normal')
    expect(option.querySelector('span')?.className).toContain('break-words')
  })
  it('alterna checkbox e switch usando os papéis acessíveis corretos', () => {
    render(<><label><Checkbox/> Interessado</label><label><Switch/> Registro ativo</label></>)

    const checkbox = screen.getByRole('checkbox', { name: 'Interessado' }) as HTMLInputElement
    const switchControl = screen.getByRole('switch', { name: 'Registro ativo' }) as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.click(switchControl)
    expect(checkbox.checked).toBe(true)
    expect(switchControl.getAttribute('aria-checked')).toBe('true')
    expect(switchControl.className).toContain('ui-switch')
  })
})

describe('Dialog', () => {
  it('expõe o estado de fechamento antes de chamar o controlador externo', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Dialog title="Confirmar ação" onClose={onClose}><button type="button">Confirmar</button></Dialog>)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('data-state')).toBe('open')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar diálogo' }))
    expect(dialog.getAttribute('data-state')).toBe('closed')
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(160) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
