import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { SessionProvider } from './session'
import { ToastProvider } from '../components/ui/ToastProvider'
import { seedDatabase } from '../mocks/seed'
import { DATABASE_KEY, saveDb } from '../storage/database'

vi.mock('../storage/database', async () => {
  const actual = await vi.importActual<typeof import('../storage/database')>('../storage/database')
  return { ...actual, cleanupOrphanedBlobs: vi.fn().mockResolvedValue(undefined), deleteBlob: vi.fn().mockResolvedValue(undefined), getBlob: vi.fn().mockResolvedValue(undefined), putBlob: vi.fn().mockResolvedValue(undefined) }
})

const renderApp = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><SessionProvider><App/></SessionProvider></ToastProvider></QueryClientProvider>)
}
const choose = async (label: string | RegExp, option: string, scope = screen) => {
  const trigger = await scope.findByRole('combobox', { name: label })
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('option', { name: option }))
}

describe('jornada principal da interface', () => {
  beforeEach(() => {
    localStorage.clear()
    saveDb(seedDatabase())
    window.history.replaceState({}, '', '/protocolos/novo')
  })
  afterEach(() => cleanup())

  it('apresenta a visão geral e o header no novo padrão', async () => {
    window.history.replaceState({}, '', '/dashboard')
    renderApp()

    expect(screen.getByText('PGCI')).not.toBeNull()
    await screen.findByRole('heading', { name: 'Meus Processos' })
    expect(screen.getByRole('textbox', { name: 'Buscar protocolo' })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Na minha caixa/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Prazo vencido/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Vence em 24h/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Sem ciência/ })).not.toBeNull()
  })
  it('mostra o indicador com o SVG durante uma troca de tela', async () => {
    window.history.replaceState({}, '', '/dashboard')
    renderApp()

    fireEvent.click(screen.getByRole('link', { name: 'Documentos' }))
    const loading = await screen.findByRole('status', { name: 'Carregando tela' })
    expect(loading.querySelector('img')?.getAttribute('src')).toBe('/assets/file-sync.svg')
  })
  it('abre, tramita, dá ciência, cria documento e anexo, conclui e mantém o resultado após recarga', async () => {
    renderApp()

    await choose('Tipo de protocolo *', 'Solicitação administrativa')
    expect(screen.getByRole('combobox', { name: 'Tipo de protocolo *' }).textContent).toContain('Solicitação administrativa')
    await choose(/Interessado/, 'Ana Beatriz Costa')
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Fluxo integrado de teste' } })
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Descrição para validar a jornada completa.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir protocolo' }))
    await screen.findByRole('heading', { name: 'Fluxo integrado de teste' })

    fireEvent.click(screen.getByRole('button', { name: 'Tramitar' }))
    const forwardDialog = await screen.findByRole('dialog')
    const forwardScope = within(forwardDialog)
    fireEvent.click(forwardScope.getByRole('combobox', { name: 'Unidade destino *' }))
    fireEvent.click(screen.getByRole('option', { name: 'Administração' }))
    fireEvent.click(forwardScope.getByRole('combobox', { name: 'Destinatário' }))
    fireEvent.click(screen.getByRole('option', { name: 'Bruno Lima' }))
    fireEvent.change(within(forwardDialog).getByLabelText('Despacho *'), { target: { value: 'Encaminhado para análise administrativa.' } })
    fireEvent.click(forwardScope.getByRole('button', { name: 'Tramitar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await choose('Usuário de demonstração', 'Bruno Lima')
    fireEvent.click(await screen.findByRole('button', { name: 'Dar ciência' }))
    await screen.findByRole('button', { name: 'Tramitar' })

    fireEvent.click(screen.getByRole('button', { name: 'Documentos' }))
    fireEvent.click(await screen.findByRole('link', { name: 'Redigir documento' }))
    await choose('Tipo de documento *', 'Memorando')
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Memorando da jornada' } })
    fireEvent.change(screen.getByLabelText('Corpo do documento *'), { target: { value: 'Corpo do documento de teste.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar documento' }))
    await screen.findByText('Corpo do documento de teste.')

    fireEvent.click(screen.getByRole('link', { name: 'Abrir protocolo vinculado' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Anexos' }))
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(fileInput, { target: { files: [new File(['anexo de teste'], 'jornada.txt', { type: 'text/plain' })] } })
    await screen.findByText('jornada.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Avançar fase' }))
    const firstPhaseDialog = await screen.findByRole('dialog')
    fireEvent.click(within(firstPhaseDialog).getByRole('checkbox', { name: 'Conferir dados de abertura' }))
    fireEvent.click(within(firstPhaseDialog).getByRole('button', { name: 'Avançar fase' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await screen.findByText('Análise')

    fireEvent.click(await screen.findByRole('button', { name: 'Avançar fase' }))
    const secondPhaseDialog = await screen.findByRole('dialog')
    fireEvent.click(within(secondPhaseDialog).getByRole('checkbox', { name: 'Registrar despacho ou resultado' }))
    fireEvent.click(within(secondPhaseDialog).getByRole('button', { name: 'Avançar fase' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await screen.findByText('Conclusão')

    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    const completeDialog = await screen.findByRole('dialog')
    fireEvent.change(within(completeDialog).getByLabelText('Resultado da conclusão *'), { target: { value: 'Jornada concluída com sucesso.' } })
    fireEvent.click(within(completeDialog).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    cleanup()
    renderApp()
    await screen.findByRole('heading', { name: 'Fluxo integrado de teste' })
    expect(screen.getAllByText('Concluído').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Documentos' }))
    expect(await screen.findByText('Memorando da jornada')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Anexos' }))
    expect(await screen.findByText('jornada.txt')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(DATABASE_KEY)!).protocols.some((protocol: { subject: string; status: string }) => protocol.subject === 'Fluxo integrado de teste' && protocol.status === 'CONCLUIDO')).toBe(true)
  })
})




