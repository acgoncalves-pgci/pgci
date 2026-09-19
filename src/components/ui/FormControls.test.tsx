import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Checkbox } from './Checkbox'
import { Dialog } from './Dialog'
import { Input } from './Input'
import { AdvancedSelect, SearchableSelect, Select } from './Select'
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
    const portal = listbox.closest('.ui-select-content') as HTMLElement
    const option = screen.getByRole('option', { name: longOption })

    expect(dialog.contains(listbox)).toBe(false)
    expect(portal.parentElement).toBe(document.body)
    expect(portal.style.zIndex).toBe('120')
    expect(option.querySelector('span')?.className).toContain('whitespace-normal')
    expect(option.querySelector('span')?.className).toContain('break-words')
  })

  it('mantém o select acima de um modal empilhado', () => {
    render(<Dialog title="Modal principal" onClose={() => undefined}><Dialog title="Modal secundário" onClose={() => undefined} stacked><label htmlFor="situacao">Situação</label><Select id="situacao"><option value="analise">Em análise</option></Select></Dialog></Dialog>)

    const stackedDialog = screen.getByRole('dialog', { name: 'Modal secundário' })
    expect(stackedDialog.style.zIndex).toBe('140')
    fireEvent.click(screen.getByRole('combobox', { name: 'Situação' }))
    const portal = screen.getByRole('listbox').closest('.ui-select-content') as HTMLElement
    expect(portal.style.zIndex).toBe('160')
  })

  it('filtra localmente no modo de busca simples ignorando acentos', () => {
    render(<><label htmlFor="setor">Setor</label><SearchableSelect id="setor"><option value="agua">Água e saneamento</option><option value="educacao">Educação</option><option value="financas">Finanças</option></SearchableSelect></>)

    fireEvent.click(screen.getByRole('combobox', { name: 'Setor' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar opções' }), { target: { value: 'educacao' } })

    expect(screen.getByRole('option', { name: 'Educação' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Água e saneamento' })).toBeNull()
  })

  it('busca e pagina opções no servidor no modo avançado', async () => {
    const loadOptions = vi.fn(async ({ query, page }: { query: string; page: number }) => {
      if (query === 'fin')
        return { options: [{ value: 'financeiro', label: 'Financeiro' }], hasMore: false }
      if (page === 2)
        return { options: [{ value: 'compras', label: 'Compras' }], hasMore: false }
      return { options: [{ value: 'protocolo', label: 'Protocolo' }], hasMore: true }
    })
    render(<AdvancedSelect aria-label="Unidade" loadOptions={loadOptions} debounceMs={0} pageSize={25}/>)

    fireEvent.click(screen.getByRole('combobox', { name: 'Unidade' }))
    expect(await screen.findByRole('option', { name: 'Protocolo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(await screen.findByRole('option', { name: 'Compras' })).toBeTruthy()
    expect(loadOptions).toHaveBeenCalledWith(expect.objectContaining({ query: '', page: 2, pageSize: 25 }))

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar opções' }), { target: { value: 'fin' } })
    expect(await screen.findByRole('option', { name: 'Financeiro' })).toBeTruthy()
    await waitFor(() => expect(loadOptions).toHaveBeenCalledWith(expect.objectContaining({ query: 'fin', page: 1, pageSize: 25 })))
    expect(screen.queryByRole('option', { name: 'Protocolo' })).toBeNull()
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
    expect(dialog.parentElement).toBe(document.body)
    expect(dialog.className).toContain('inset-0')
    expect(dialog.getAttribute('data-state')).toBe('open')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar diálogo' }))
    expect(dialog.getAttribute('data-state')).toBe('closed')
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(160) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
