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
const choose = async (label: string | RegExp, option: string, scope: Pick<typeof screen, 'findByRole'> = screen) => {
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
  it('permite preencher e observar o checklist da movimentação somente após a ciência', async () => {
    localStorage.setItem('fluxo-publico:user', 'usr-bruno')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
    window.history.replaceState({}, '', '/processos/pr-19')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000019' })
    const lockedCheckbox = await screen.findByRole('checkbox', { name: 'Registrar despacho ou resultado' })
    expect(lockedCheckbox.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Dê ciência desta movimentação para preencher o checklist.')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Dar ciência da tramitação' }))
    const confirmation = await screen.findByRole('dialog', { name: 'Confirmar visualização da tramitação?' })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirmar ciência' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmar visualização da tramitação?' })).toBeNull())

    const checkbox = await screen.findByRole('checkbox', { name: 'Registrar despacho ou resultado' }) as HTMLInputElement
    await waitFor(() => expect(checkbox.disabled).toBe(false))
    fireEvent.click(checkbox)
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Registrar despacho ou resultado' }) as HTMLInputElement).checked).toBe(true))

    const observationButton = screen.getByRole('button', { name: 'Adicionar observação em Registrar despacho ou resultado' })
    await waitFor(() => expect(observationButton.hasAttribute('disabled')).toBe(false))
    fireEvent.click(observationButton)
    const firstObservationPopover = await screen.findByRole('dialog', { name: 'Informações do item Registrar despacho ou resultado' })
    expect(firstObservationPopover.parentElement).toBe(document.body)
    await waitFor(() => expect(firstObservationPopover.style.position).toBe('fixed'))

    fireEvent.click(observationButton)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Informações do item Registrar despacho ou resultado' })).toBeNull())
    fireEvent.click(observationButton)
    const observationPopover = await screen.findByRole('dialog', { name: 'Informações do item Registrar despacho ou resultado' })
    await waitFor(() => expect(observationPopover.style.position).toBe('fixed'))
    fireEvent.change(within(observationPopover).getByRole('textbox', { name: 'Observação' }), { target: { value: 'Atividade conferida pela unidade.' } })
    fireEvent.click(within(observationPopover).getByRole('button', { name: 'Salvar e marcar' }))

    expect((await screen.findAllByText('Atividade conferida pela unidade.')).length).toBeGreaterThan(0)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(DATABASE_KEY)!)
      const movement = stored.events.find((event: { protocolId: string; kind: string; assignmentId?: string }) => event.protocolId === 'pr-19' && event.kind === 'TRAMITACAO' && event.assignmentId === 'as-19')
      expect(movement.checklist).toEqual([expect.objectContaining({ questionId: 'q-analysis-result', checked: true, observation: 'Atividade conferida pela unidade.' })])
    })
  })
  it.each(['REQUIRED', 'SUGGESTED'] as const)('mantém o checklist apenas no movimento da etapa em fluxo %s', async (flowMode) => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-19')!
    protocol.flowModeSnapshot = flowMode
    const phaseMovement = db.events.find((event) => event.id === 'ev-phase-analysis-19')!
    phaseMovement.checklist = [{ questionId: 'q-analysis-result', text: 'Registrar despacho ou resultado', checked: false }]
    const followingMovement = db.events.find((event) => event.id === 'ev-move-19')!
    followingMovement.phaseId = 'phase-analysis'
    followingMovement.checklist = [{ questionId: 'q-analysis-result', text: 'Registrar despacho ou resultado', checked: false }]
    saveDb(db)
    localStorage.setItem('fluxo-publico:user', 'usr-bruno')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
    window.history.replaceState({}, '', '/processos/pr-19')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000019' })
    fireEvent.click(screen.getByRole('button', { name: 'Expandir conteúdo de Fase Análise' }))

    expect(screen.getAllByRole('checkbox', { name: 'Registrar despacho ou resultado' })).toHaveLength(1)
  })
  it('anexa o arquivo obrigatório no modal e avança a fase pela tramitação', async () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowSnapshot!.phases.find((phase) => phase.phaseId === protocol.currentPhaseId)!.requiredAttachmentTypes = ['application/pdf']
    const opening = db.events.find((event) => event.id === 'ev-open-1')!
    opening.checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: true }]
    saveDb(db)
    localStorage.setItem('fluxo-publico:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-prot')
    window.history.replaceState({}, '', '/processos/pr-1')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000001' })
    expect(screen.queryByRole('button', { name: 'Avançar fase' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tramitar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tramitar processo' })
    expect(within(dialog).getByRole('combobox', { name: 'Fase *' }).textContent).toContain('Análise')
    expect(within(dialog).getByText('Anexo obrigatório da fase atual')).not.toBeNull()
    fireEvent.change(within(dialog).getByLabelText('Selecionar anexos obrigatórios'), { target: { files: [new File(['parecer'], 'parecer.pdf', { type: 'application/pdf' })] } })
    expect(within(dialog).getByText('parecer.pdf')).not.toBeNull()
    fireEvent.change(within(dialog).getByLabelText('Descrição *'), { target: { value: 'Encaminhar para a próxima fase.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tramitar' }))
    const confirmation = await screen.findByRole('dialog', { name: 'Registrar atividade?' })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Não, apenas continuar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
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
    expect(screen.getByRole('status').textContent).toContain('Administração')
    const overview = screen.getByRole('region', { name: 'Tipo, responsabilidade e etapas do processo' })
    expect(within(overview).getByText('Tipo:').parentElement?.textContent).toContain('Compra de material')
    expect(within(overview).getByRole('list', { name: 'Etapas do fluxo' })).not.toBeNull()

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
    const movementHeader = screen.getByRole('button', { name: 'Recolher conteúdo de Fase Conclusão' })
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
    fireEvent.click(screen.getByRole('option', { name: 'Clara Nunes' }))

    await choose('Unidade organizacional de destino *', 'Administração / Financeiro', within(forwardDialog))
    expect(within(forwardDialog).getByRole('combobox', { name: 'Destinatário' }).textContent).toContain('Enviar para fila sem responsável')
    fireEvent.click(within(forwardDialog).getByRole('combobox', { name: 'Destinatário' }))
    expect(screen.getByRole('option', { name: 'Rafael Reis' })).not.toBeNull()
    expect(screen.queryByRole('option', { name: 'Clara Nunes' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Bruno Lima' })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Rafael Reis' }))

    await choose('Unidade organizacional de destino *', 'Gestão de Processos', within(forwardDialog))
    expect(within(forwardDialog).getByRole('combobox', { name: 'Destinatário' }).textContent).toContain('Enviar para fila sem responsável')
    fireEvent.click(within(forwardDialog).getByRole('combobox', { name: 'Destinatário' }))
    expect(screen.getByRole('option', { name: 'Clara Nunes' })).not.toBeNull()
    expect(screen.queryByRole('option', { name: 'Rafael Reis' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Bruno Lima' })).toBeNull()
  })
  it('permite escolher a fase no fluxo livre e registrar produtividade na tramitação', async () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'NONE'
    protocol.flowSnapshot = undefined
    protocol.currentPhaseId = undefined
    saveDb(db)
    window.history.replaceState({}, '', '/processos/pr-1')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000001' })
    fireEvent.click(screen.getByRole('button', { name: 'Tramitar' }))
    const forwardDialog = await screen.findByRole('dialog', { name: 'Tramitar processo' })
    expect(within(forwardDialog).getByText('Fluxo livre')).not.toBeNull()
    const phaseSelect = within(forwardDialog).getByRole('combobox', { name: 'Fase *' })
    expect(phaseSelect.hasAttribute('disabled')).toBe(false)
    await choose('Fase *', 'Análise', within(forwardDialog))
    await choose('Unidade organizacional de destino *', 'Administração', within(forwardDialog))
    await choose('Destinatário', 'Bruno Lima', within(forwardDialog))
    fireEvent.change(within(forwardDialog).getByLabelText('Descrição *'), { target: { value: 'Encaminhado para análise administrativa.' } })
    fireEvent.click(within(forwardDialog).getByRole('button', { name: 'Tramitar' }))

    const confirmation = await screen.findByRole('dialog', { name: 'Registrar atividade?' })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Sim, registrar' }))
    const activityDialog = await screen.findByRole('dialog', { name: 'Registrar Atividade e Resultado' })
    fireEvent.change(within(activityDialog).getByLabelText('Atividade principal desenvolvida *'), { target: { value: 'Conferência documental' } })
    fireEvent.change(within(activityDialog).getByLabelText('Resultado concreto / produto entregue *'), { target: { value: 'Documentação conferida e encaminhada' } })
    fireEvent.click(within(activityDialog).getByRole('button', { name: 'Salvar e continuar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await screen.findByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Análise$/ })
    const persisted = JSON.parse(localStorage.getItem(DATABASE_KEY)!)
    const movement = persisted.events.filter((event: { protocolId: string; kind: string }) => event.protocolId === 'pr-1' && event.kind === 'TRAMITACAO').at(-1)
    expect(movement).toMatchObject({ phaseId: 'phase-analysis', activity: 'Conferência documental', result: 'Documentação conferida e encaminhada' })
  })

  it('bloqueia fase e destino previamente definidos pelo fluxo sugerido', async () => {
    const db = seedDatabase()
    const protocol = db.protocols.find((item) => item.id === 'pr-1')!
    protocol.flowModeSnapshot = 'SUGGESTED'
    protocol.currentPhaseId = 'phase-triage'
    protocol.flowSnapshot!.phases[1].destinationUnitId = 'u-adm'
    saveDb(db)
    window.history.replaceState({}, '', '/processos/pr-1')
    renderApp()

    await screen.findByRole('heading', { name: 'Processo 2026.000001' })
    fireEvent.click(screen.getByRole('button', { name: 'Tramitar' }))
    const forwardDialog = await screen.findByRole('dialog', { name: 'Tramitar processo' })
    expect(within(forwardDialog).getByText('Fluxo sugerido')).not.toBeNull()
    const phaseSelect = within(forwardDialog).getByRole('combobox', { name: 'Fase *' })
    const destinationSelect = within(forwardDialog).getByRole('combobox', { name: 'Unidade organizacional de destino *' })
    expect(phaseSelect.hasAttribute('disabled')).toBe(true)
    expect(destinationSelect.hasAttribute('disabled')).toBe(true)
    expect(phaseSelect.textContent).toContain('Análise')
    expect(destinationSelect.textContent).toContain('Administração')
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
  it('mascara e persiste o valor monetário em centavos ao abrir um processo', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'Abrir processo' })
    await choose('Tipo de processo *', 'Pagamento de fornecedor')
    await choose('Interessado *', 'Ana Beatriz Costa')
    await choose('Credor *', 'Papelaria Horizonte Ltda.')

    const amount = screen.getByLabelText('Valor (R$) *') as HTMLInputElement
    fireEvent.input(amount, { target: { value: '1234,56' } })
    await waitFor(() => expect(amount.value).toBe('1.234,56'))

    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Pagamento com valor mascarado' } })
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Validação da persistência monetária em centavos.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir processo' }))

    await waitFor(() => {
      const current = JSON.parse(localStorage.getItem(DATABASE_KEY)!)
      const created = current.protocols.find((protocol: { subject: string }) => protocol.subject === 'Pagamento com valor mascarado')
      expect(created?.amountCents).toBe(123456)
    }, { timeout: 3000 })
    await screen.findByRole('heading', { name: 'Pagamento com valor mascarado' })
    const stored = JSON.parse(localStorage.getItem(DATABASE_KEY)!)
    const created = stored.protocols.find((protocol: { subject: string }) => protocol.subject === 'Pagamento com valor mascarado')
    expect(created.amountCents).toBe(123456)
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

    const openingChecklist = screen.getByRole('checkbox', { name: 'Conferir dados de abertura' })
    fireEvent.click(openingChecklist)
    await waitFor(() => expect((openingChecklist as HTMLInputElement).checked).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Tramitar' }))
    const forwardDialog = await screen.findByRole('dialog')
    const forwardScope = within(forwardDialog)
    fireEvent.click(forwardScope.getByRole('combobox', { name: 'Unidade organizacional de destino *' }))
    fireEvent.click(screen.getByRole('option', { name: 'Administração' }))
    fireEvent.click(forwardScope.getByRole('combobox', { name: 'Destinatário' }))
    fireEvent.click(screen.getByRole('option', { name: 'Bruno Lima' }))
    fireEvent.change(within(forwardDialog).getByLabelText('Descrição *'), { target: { value: 'Encaminhado para análise administrativa.' } })
    fireEvent.click(forwardScope.getByRole('button', { name: 'Tramitar' }))
    const activityConfirmation = await screen.findByRole('dialog', { name: 'Registrar atividade?' })
    fireEvent.click(within(activityConfirmation).getByRole('button', { name: 'Não, apenas continuar' }))
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
    const documentEditor = screen.getByRole('textbox', { name: 'Corpo do documento * visual' })
    documentEditor.innerHTML = '<p>Corpo do documento de teste.</p>'
    fireEvent.input(documentEditor)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar documento' }))
    const linkedProcess = await screen.findByRole('link', { name: 'Abrir processo vinculado' })
    await screen.findByText('Corpo do documento de teste.')
    fireEvent.click(linkedProcess)
    fireEvent.click(await screen.findByRole('button', { name: /^Anexos\b/ }))
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(fileInput, { target: { files: [new File(['anexo de teste'], 'jornada.txt', { type: 'text/plain' })] } })
    await screen.findByText('jornada.txt')

    fireEvent.click(screen.getByRole('button', { name: /^Andamento\b/ }))
    const analysisChecklist = await screen.findByRole('checkbox', { name: 'Registrar despacho ou resultado' })
    fireEvent.click(analysisChecklist)
    await waitFor(() => expect((analysisChecklist as HTMLInputElement).checked).toBe(true))
    expect(screen.queryByRole('button', { name: 'Avançar fase' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Devolver fase' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tramitar' }))
    const completionForwardDialog = await screen.findByRole('dialog', { name: 'Tramitar processo' })
    expect(within(completionForwardDialog).getByRole('combobox', { name: 'Fase *' }).textContent).toContain('Conclusão')
    fireEvent.change(within(completionForwardDialog).getByLabelText('Descrição *'), { target: { value: 'Encaminhado para conclusão.' } })
    fireEvent.click(within(completionForwardDialog).getByRole('button', { name: 'Tramitar' }))
    const completionActivityConfirmation = await screen.findByRole('dialog', { name: 'Registrar atividade?' })
    fireEvent.click(within(completionActivityConfirmation).getByRole('button', { name: 'Não, apenas continuar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: 'Assumir e dar ciência' }))
    const concludeButton = await screen.findByRole('button', { name: 'Concluir' })

    fireEvent.click(concludeButton)
    const completeDialog = await screen.findByRole('dialog')
    fireEvent.change(within(completeDialog).getByLabelText('Resultado da conclusão *'), { target: { value: 'Jornada concluída com sucesso.' } })
    fireEvent.click(within(completeDialog).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    cleanup()
    renderApp()
    await screen.findByRole('heading', { name: 'Fluxo integrado de teste' })
    const phaseRows = screen.getAllByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase / })
    expect(phaseRows).toHaveLength(4)
    expect(screen.getAllByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Triagem$/ }).some((row) => within(row).queryByText('Cadastrado'))).toBe(true)
    expect(screen.getAllByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Análise$/ }).some((row) => within(row).queryByText('Em tramitação'))).toBe(true)
    expect(screen.getAllByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Conclusão$/ }).some((row) => within(row).queryByText('Concluído'))).toBe(true)
    expect(screen.getAllByText('Concluído').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /^Documentos\b/ }))
    expect(await screen.findByText('Memorando da jornada')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Anexos\b/ }))
    expect(await screen.findByText('jornada.txt')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(DATABASE_KEY)!).protocols.some((protocol: { subject: string; status: string }) => protocol.subject === 'Fluxo integrado de teste' && protocol.status === 'CONCLUIDO')).toBe(true)
  }, 15_000)
})
