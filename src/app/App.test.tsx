import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  await act(async () => {
    fireEvent.click(trigger)
    await Promise.resolve()
  })
  const optionElement = screen.getByRole('option', { name: option })
  await act(async () => {
    fireEvent.click(optionElement)
    await Promise.resolve()
  })
}

describe('jornada principal da interface', () => {
  beforeEach(() => {
    localStorage.clear()
    saveDb(seedDatabase())
    window.history.replaceState({}, '', '/processos/novo')
  })
  afterEach(() => cleanup())

  it('apresenta a visão geral e o header no novo padrão', async () => {
    window.history.replaceState({}, '', '/dashboard')
    renderApp()

    expect(screen.getByText('PGCI')).not.toBeNull()
    await screen.findByRole('heading', { name: 'Meus Processos' })
    expect(screen.getByRole('textbox', { name: 'Buscar processo' })).not.toBeNull()
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
  it('mostra os dados do perfil e a estrutura ao trocar o usuário', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'Abrir processo' })
    const trigger = screen.getByRole('button', { name: 'Abrir menu do perfil' })
    expect(trigger.textContent).toContain('Clara Nunes')
    expect(trigger.textContent).toContain('Gestão de Processos')

    fireEvent.click(trigger)
    const menu = screen.getByRole('dialog', { name: 'Menu do perfil' })
    expect(within(menu).getByText('clara.nunes@example.com')).not.toBeNull()

    fireEvent.click(within(menu).getByRole('button', { name: 'Meu perfil' }))
    expect(within(menu).getByText('Operador')).not.toBeNull()

    fireEvent.click(within(menu).getByRole('button', { name: 'Voltar' }))
    fireEvent.click(within(menu).getByRole('button', { name: 'Trocar usuário' }))
    expect(within(menu).getByRole('button', { name: /Trocar para Bruno Lima — Administração/ })).not.toBeNull()
    expect(within(menu).getByRole('button', { name: /Trocar para Rafael Reis — Administração \/ Financeiro/ })).not.toBeNull()

    fireEvent.click(within(menu).getByRole('button', { name: /Trocar para Bruno Lima/ }))
    await waitFor(() => expect(trigger.textContent).toContain('Bruno Lima'))
    expect(trigger.textContent).toContain('Administração')
  })

  it('mantém processo já tramitado visível somente para consulta fora da unidade atual', async () => {
    localStorage.setItem('fluxo-publico:user', 'usr-bruno')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
    window.history.replaceState({}, '', '/processos/pr-5')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000005' })
    expect(screen.getByText('Somente leitura')).not.toBeNull()
    expect(screen.getByText(/Como você já participou dele/)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Alterar para/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ações' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tramitar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dossiê' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Escolher outro responsável' })).toBeNull()
  })
  it('anexa o arquivo obrigatório no modal e avança a fase na mesma ação', async () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowSnapshot!.phases.find((phase) => phase.phaseId === protocol.currentPhaseId)!.requiredAttachmentTypes = ['application/pdf']
    saveDb(db)
    localStorage.setItem('fluxo-publico:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-prot')
    window.history.replaceState({}, '', '/processos/pr-1')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000001' })
    fireEvent.click(screen.getByRole('button', { name: 'Avançar fase' }))
    const dialog = await screen.findByRole('dialog', { name: 'Avançar fase: Triagem' })
    expect(within(dialog).getByText('Anexo obrigatório')).not.toBeNull()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Conferir dados de abertura' }))
    fireEvent.change(within(dialog).getByLabelText('Selecionar anexos obrigatórios'), { target: { files: [new File(['parecer'], 'parecer.pdf', { type: 'application/pdf' })] } })
    expect(within(dialog).getByText('parecer.pdf')).not.toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Avançar fase' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Avançar fase: Triagem' })).toBeNull())
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(DATABASE_KEY)!)
      expect(stored.protocols.find((item: { id: string }) => item.id === 'pr-1').currentPhaseId).toBe('phase-analysis')
      expect(stored.attachments).toContainEqual(expect.objectContaining({ protocolId: 'pr-1', filename: 'parecer.pdf', mimeType: 'application/pdf' }))
    })
  })
  it('troca para a unidade do processo quando o usuário possui vínculo e mantém a unidade principal', async () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-18')!
    const assignment = db.assignments.find((item) => item.id === protocol.currentAssignmentId)!
    protocol.currentUnitId = 'u-adm'
    protocol.currentAssigneeId = 'usr-admin'
    assignment.unitId = 'u-adm'
    assignment.assigneeId = 'usr-admin'
    assignment.receivedAt = new Date().toISOString()
    assignment.receivedById = 'usr-admin'
    db.events.push({
      id: 'ev-assign-admin-18',
      protocolId: protocol.id,
      kind: 'ATRIBUICAO',
      actorUserId: 'usr-admin',
      actorUnitId: 'u-adm',
      toUnitId: 'u-adm',
      toUserId: 'usr-admin',
      assignmentId: assignment.id,
      createdAt: new Date().toISOString(),
    })
    saveDb(db)
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-edu')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-edu')
    window.history.replaceState({}, '', '/processos/pr-18')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000018' })
    expect(screen.getByText('Troque a unidade para continuar')).not.toBeNull()
    const unitIndicator = screen.getByText('Unidade atual:').parentElement
    expect(unitIndicator?.textContent).toContain('Administração')

    fireEvent.click(screen.getByRole('button', { name: 'Alterar para Administração' }))

    await screen.findByRole('button', { name: 'Tramitar' })
    await waitFor(() => {
      expect(localStorage.getItem('fluxo-publico:unit')).toBe('u-adm')
      expect(localStorage.getItem('fluxo-publico:scope-unit')).toBe('u-adm')
    })
    expect(screen.queryByText('Troque a unidade para continuar')).toBeNull()
    expect(JSON.parse(localStorage.getItem(DATABASE_KEY)!).users.find((user: { id: string }) => user.id === 'usr-admin').unitId).toBe('u-prot')
  })
  it('mostra o nome e o ícone da unidade quando a tramitação não possui destinatário', async () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-18')!
    const assignment = db.assignments.find((item) => item.id === protocol.currentAssignmentId)!
    protocol.currentUnitId = 'u-fin'
    protocol.currentAssigneeId = undefined
    protocol.status = 'EM_ANDAMENTO'
    assignment.unitId = 'u-fin'
    assignment.assigneeId = undefined
    assignment.receivedAt = undefined
    assignment.receivedById = undefined
    db.events.push({
      id: 'ev-forward-financeiro-sem-destinatario',
      protocolId: protocol.id,
      kind: 'TRAMITACAO',
      actorUserId: 'usr-admin',
      actorUnitId: 'u-edu',
      fromUnitId: 'u-edu',
      toUnitId: 'u-fin',
      fromUserId: 'usr-admin',
      assignmentId: assignment.id,
      message: 'Encaminhado para a fila do financeiro.',
      previousStatus: 'CADASTRADO',
      nextStatus: 'EM_ANDAMENTO',
      createdAt: new Date().toISOString(),
    })
    saveDb(db)
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-fin')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-fin')
    window.history.replaceState({}, '', '/processos/pr-18')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000018' })
    expect(screen.getByText('Está com:').parentElement?.textContent).toContain('Financeiro')
    const movementHeader = screen.getByRole('button', { name: 'Recolher conteúdo de Tramitado' })
    const movementCard = movementHeader.closest('section')!
    expect(within(movementCard).getByText('Financeiro')).not.toBeNull()
    expect(within(movementCard).queryByText('FIN')).toBeNull()
    const destinationIcon = within(movementCard).getByLabelText('Unidade de destino')
    expect(destinationIcon.querySelector('svg')).not.toBeNull()
  })
  it('abre processo pela unidade secundária e mantém a unidade principal do usuário', async () => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
    renderApp()

    await screen.findByRole('heading', { name: 'Abrir processo' })
    expect(screen.queryByText('Para abrir processo, selecione sua unidade de vínculo.')).toBeNull()
    await choose('Tipo de processo *', 'Pedido de informação')
    await choose('Interessado *', 'Ana Beatriz Costa')

    const responsible = screen.getByRole('combobox', { name: 'Responsável *' })
    fireEvent.click(responsible)
    expect(screen.getByRole('option', { name: 'Marina Duarte' })).not.toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Marina Duarte' }))

    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Operação por unidade secundária' } })
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Processo criado sem alterar a unidade principal.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir processo' }))

    await screen.findByRole('heading', { name: 'Operação por unidade secundária' })
    const stored = JSON.parse(localStorage.getItem(DATABASE_KEY)!)
    const created = stored.protocols.find((protocol: { subject: string }) => protocol.subject === 'Operação por unidade secundária')
    expect(created).toMatchObject({ originUnitId: 'u-adm', currentUnitId: 'u-adm', currentAssigneeId: 'usr-admin' })
    expect(stored.users.find((user: { id: string }) => user.id === 'usr-admin').unitId).toBe('u-prot')
  })

  it('lista vínculos secundários na tramitação e na designação de responsável', async () => {
    const db = seedDatabase()
    db.memberships.push({
      id: 'membership-clara-adm',
      userId: 'usr-clara',
      unitId: 'u-adm',
      role: 'OPERADOR',
      title: 'Apoio administrativo',
      startsAt: new Date(Date.now() - 1000).toISOString(),
      active: true,
    })
    const protocol = db.protocols.find((item) => item.id === 'pr-6')!
    const assignment = db.assignments.find((item) => item.id === protocol.currentAssignmentId)!
    protocol.currentAssigneeId = 'usr-admin'
    assignment.assigneeId = 'usr-admin'
    assignment.receivedAt = new Date().toISOString()
    assignment.receivedById = 'usr-admin'
    saveDb(db)
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
    window.history.replaceState({}, '', '/processos/pr-6')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000006' })
    fireEvent.click(screen.getByRole('button', { name: 'Escolher outro responsável' }))
    const assignDialog = await screen.findByRole('dialog')
    fireEvent.click(within(assignDialog).getByRole('combobox', { name: 'Responsável *' }))
    expect(screen.getByRole('option', { name: 'Clara Nunes' })).not.toBeNull()
    fireEvent.click(within(assignDialog).getByRole('button', { name: 'Cancelar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Tramitar' }))
    const forwardDialog = await screen.findByRole('dialog')
    fireEvent.click(within(forwardDialog).getByRole('combobox', { name: 'Destinatário' }))
    expect(screen.getByRole('option', { name: 'Clara Nunes' })).not.toBeNull()
  })
  it('revela somente os campos pedidos pelo tipo de processo selecionado', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'Abrir processo' })
    expect(screen.getByLabelText('Data/hora')).not.toBeNull()
    expect(screen.getByText('Selecione o tipo de processo para ver os campos disponíveis.')).not.toBeNull()
    expect(screen.queryByLabelText('Assunto *')).toBeNull()
    expect(screen.queryByLabelText('Descrição *')).toBeNull()

    await choose('Tipo de processo *', 'Pagamento de fornecedor')
    expect(screen.getByRole('combobox', { name: 'Interessado *' })).not.toBeNull()
    expect(screen.getByRole('combobox', { name: 'Credor *' })).not.toBeNull()
    expect(screen.getByLabelText('Valor (R$) *')).not.toBeNull()
    expect(screen.getByLabelText('Assunto *')).not.toBeNull()
    expect(screen.getByLabelText('Descrição *')).not.toBeNull()
    expect(screen.getByLabelText('Observações')).not.toBeNull()

    await choose('Tipo de processo *', 'Pedido de informação')
    expect(screen.getByRole('combobox', { name: 'Interessado *' })).not.toBeNull()
    expect(screen.getByRole('combobox', { name: 'Responsável *' })).not.toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Credor *' })).toBeNull()
    expect(screen.queryByLabelText('Valor (R$) *')).toBeNull()
  })
  it('abre, tramita, dá ciência, cria documento e anexo, conclui e mantém o resultado após recarga', async () => {
    renderApp()

    await choose('Tipo de processo *', 'Solicitação administrativa')
    expect(screen.getByRole('combobox', { name: 'Tipo de processo *' }).textContent).toContain('Solicitação administrativa')
    await choose(/Interessado/, 'Ana Beatriz Costa')
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Fluxo integrado de teste' } })
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Descrição para validar a jornada completa.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir processo' }))
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

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu do perfil' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trocar usuário' }))
    fireEvent.click(screen.getByRole('button', { name: /Trocar para Bruno Lima/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Dar ciência da tramitação' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar ciência' }))
    await screen.findByRole('button', { name: 'Tramitar' })

    fireEvent.click(screen.getByRole('button', { name: /^Documentos\b/ }))
    fireEvent.click(await screen.findByRole('link', { name: 'Redigir documento' }))
    await choose('Tipo de documento *', 'Memorando')
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Memorando da jornada' } })
    fireEvent.change(screen.getByLabelText('Corpo do documento *'), { target: { value: 'Corpo do documento de teste.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar documento' }))
    await screen.findByText('Corpo do documento de teste.')

    fireEvent.click(screen.getByRole('link', { name: 'Abrir processo vinculado' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Anexos\b/ }))
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
    const phaseRows = screen.getAllByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase / })
    expect(phaseRows).toHaveLength(3)
    expect(within(screen.getByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Triagem$/ })).getByText('Cadastrado')).not.toBeNull()
    expect(within(screen.getByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Análise$/ })).getByText('Em tramitação')).not.toBeNull()
    expect(within(screen.getByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Conclusão$/ })).getByText('Concluído')).not.toBeNull()
    expect(screen.getAllByText('Concluído').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /^Documentos\b/ }))
    expect(await screen.findByText('Memorando da jornada')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Anexos\b/ }))
    expect(await screen.findByText('jornada.txt')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(DATABASE_KEY)!).protocols.some((protocol: { subject: string; status: string }) => protocol.subject === 'Fluxo integrado de teste' && protocol.status === 'CONCLUIDO')).toBe(true)
  })
})




