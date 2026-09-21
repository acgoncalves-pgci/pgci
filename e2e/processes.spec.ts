import { expect, test } from '@playwright/test'

test('lista, filtros rápidos e filtro avançado de processos', async ({ page }) => {
  await page.goto('/processos?tab=all')

  await expect(page.getByRole('heading', { name: 'Processos' })).toBeVisible()
  const quickFilters = page.getByLabel('Filtros rápidos').getByRole('button')
  await expect(quickFilters).toHaveCount(5)
  await expect(page.getByRole('button', { name: /Para mim/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Gerados por mim/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Minha Unidade/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Já participei/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Todos/ }).first()).toBeVisible()
  await expect(page.locator('.process-card')).toHaveCount(10)

  await page.getByLabel('Buscar processos').fill('2026.000002')
  await expect(page.locator('.process-card')).toHaveCount(1)
  await expect(page.locator('.process-card')).toContainText('Pagamento de fornecimento de água')
  await expect(page.locator('.process-card')).toContainText('Em tramitação')
  await page.waitForTimeout(250)
  await expect(page.getByRole('status', { name: 'Carregando tela' })).toHaveCount(0)

  await page.getByRole('button', { name: /Filtro avançado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Pesquisar processos' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Tipo de processo' }).click()
  await page.getByRole('option', { name: 'Pagamento de fornecedor' }).click()
  await dialog.getByRole('combobox', { name: 'Credor' }).click()
  await page.getByRole('option', { name: 'Água Clara Serviços Ltda.' }).click()
  await dialog.getByRole('button', { name: 'Em tramitação' }).click()
  await dialog.getByRole('button', { name: 'Sem anexos' }).click()
  await dialog.getByRole('button', { name: 'Buscar' }).click()

  await expect(page).toHaveURL(/typeId=pt-pay/)
  await expect(page).toHaveURL(/creditorId=p-9/)
  await expect(page).toHaveURL(/situation=situation-processing/)
  await expect(page.getByRole('status', { name: 'Carregando tela' })).toHaveCount(0)
  await expect(page.locator('.process-card')).toHaveCount(1)
  await expect(page.locator('.process-card')).toHaveAttribute('data-status', 'EM_ANDAMENTO')
  await expect(page.locator('.process-card')).toHaveAttribute('data-situation', 'situation-processing')
  await page.locator('.process-card').click()
  await expect(page).toHaveURL(/\/processos\/pr-2$/)
})

test('cards e filtro avançado usam a situação configurada na fase atual', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('fluxo-publico:database:v1') !== null)

  await page.evaluate(() => {
    const key = 'fluxo-publico:database:v1'
    const database = JSON.parse(localStorage.getItem(key)!)
    database.situations.push({
      id: 'situation-awaiting-review-e2e',
      name: 'Aguardando parecer',
      category: 'EM_TRAMITACAO',
      color: '#2563EB',
      icon: 'Clock3',
      observation: 'Situação criada para validar a fase atual.',
      system: false,
      active: true,
    })
    const protocol = database.protocols.find((item: { id: string }) => item.id === 'pr-2')
    const phase = protocol.flowSnapshot.phases.find((item: { phaseId: string }) => item.phaseId === protocol.currentPhaseId)
    phase.situationType = {
      id: 'situation-awaiting-review-e2e',
      name: 'Aguardando parecer',
      category: 'EM_TRAMITACAO',
      color: '#2563EB',
      icon: 'Clock3',
    }
    localStorage.setItem(key, JSON.stringify(database))
  })

  await page.goto('/processos?tab=all&search=2026.000002')
  const card = page.locator('.process-card')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Aguardando parecer')
  await expect(card).not.toContainText('Em andamento')
  await expect(card).toHaveAttribute('data-situation', 'situation-awaiting-review-e2e')

  await page.getByRole('button', { name: /Filtro avançado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Pesquisar processos' })
  await expect(dialog.getByRole('button', { name: 'Aguardando parecer' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Aguardando parecer' }).click()
  await dialog.getByRole('button', { name: 'Buscar' }).click()

  await expect(page).toHaveURL(/situation=situation-awaiting-review-e2e/)
  await expect(page.locator('.process-card')).toHaveCount(1)
  await expect(page.locator('.process-card')).toContainText('Aguardando parecer')
})
test('processo já tramitado abre somente para consulta fora da unidade atual', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-bruno')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
  })
  await page.goto('/processos/pr-5')

  await expect(page.getByRole('heading', { name: 'Processo 2026.000005' })).toBeVisible()
  await expect(page.getByText('Somente leitura')).toBeVisible()
  await expect(page.getByText(/Como você já participou dele/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Alterar para/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ações', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tramitar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dossiê' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Escolher outro responsável' })).toHaveCount(0)
})
test('dados de demonstração apresentam fila multiunidade com todas as fases', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-prot')
  })
  await page.goto('/processos/pr-18')

  await expect(page.getByRole('heading', { name: 'Processo 2026.000018' })).toBeVisible()
  await expect(page.getByText('Troque a unidade para continuar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alterar para Financeiro' })).toBeVisible()
  const overview = page.getByRole('region', { name: 'Tipo, responsabilidade e etapas do processo' })
  await expect(overview.getByText('Tipo:').locator('..')).toContainText('Compra de material')
  const phaseTrack = overview.getByRole('list', { name: 'Etapas do fluxo' })
  await expect(phaseTrack).toContainText('Triagem')
  await expect(phaseTrack).toContainText('Análise')
  await expect(phaseTrack).toContainText('Conclusão')
  await expect(page.getByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Triagem$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Análise$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Conclusão$/ })).toBeVisible()

  const movementCard = page.getByRole('button', { name: 'Recolher conteúdo de Fase Conclusão' }).locator('xpath=ancestor::section[1]')
  await expect(movementCard.getByText('Financeiro', { exact: true })).toBeVisible()
  await expect(movementCard.getByLabel('Unidade de destino').locator('svg')).toBeVisible()

  await page.getByRole('button', { name: 'Alterar para Financeiro' }).click()
  await expect(page.getByRole('button', { name: 'Assumir e dar ciência' })).toBeVisible()
  const movementToggles = page.locator('button[aria-controls^="timeline-content-"]')
  const movementCount = await movementToggles.count()
  await page.getByRole('button', { name: 'Assumir e dar ciência' }).click()

  await expect(page.getByRole('button', { name: 'Tramitar' })).toBeVisible()
  await expect(movementToggles).toHaveCount(movementCount)
  const responsible = movementCard.getByLabel('Responsável pela movimentação').locator('..')
  await expect(responsible).toContainText('Marina Duarte')
  await expect(movementCard.getByRole('checkbox', { name: 'Registrar resultado final' })).toBeEnabled()
})
test('detalhe preserva rolagem vertical e alinha os indicadores de fase', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-prot')
  })
  const viewport = page.viewportSize()!
  await page.setViewportSize({ width: viewport.width, height: 600 })
  await page.goto('/processos/pr-18')

  const markers = page.locator('.process-phase-marker')
  const connectors = page.locator('.process-phase-connector')
  await expect(markers).toHaveCount(3)
  await expect(connectors).toHaveCount(2)
  const markerCenters = await markers.evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }))
  const connectorCenters = await connectors.evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect()
    return box.y + box.height / 2
  }))

  expect(Math.abs((markerCenters[1].x - markerCenters[0].x) - (markerCenters[2].x - markerCenters[1].x))).toBeLessThan(4)
  expect(Math.max(...markerCenters.map((item) => item.y)) - Math.min(...markerCenters.map((item) => item.y))).toBeLessThan(1)
  connectorCenters.forEach((center) => expect(Math.abs(center - markerCenters[0].y)).toBeLessThan(1))

  const hasVerticalOverflow = await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight)
  expect(hasVerticalOverflow).toBe(true)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
})
test('permite trocar para a unidade do processo quando o usuário possui vínculo', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-edu')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-edu')
  })
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('fluxo-publico:database:v1') !== null)
  await page.evaluate(() => {
    const key = 'fluxo-publico:database:v1'
    const database = JSON.parse(localStorage.getItem(key)!)
    const protocol = database.protocols.find((item: { id: string }) => item.id === 'pr-18')
    const assignment = database.assignments.find((item: { id: string }) => item.id === protocol.currentAssignmentId)
    protocol.currentUnitId = 'u-adm'
    protocol.currentAssigneeId = 'usr-admin'
    assignment.unitId = 'u-adm'
    assignment.assigneeId = 'usr-admin'
    assignment.receivedAt = new Date().toISOString()
    assignment.receivedById = 'usr-admin'
    database.events.push({
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
    localStorage.setItem(key, JSON.stringify(database))
  })

  await page.goto('/processos/pr-18')
  await expect(page.getByText('Troque a unidade para continuar')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Administração')

  await page.getByRole('button', { name: 'Alterar para Administração' }).click()

  await expect(page.getByRole('button', { name: 'Tramitar' })).toBeVisible()
  await expect(page.getByText('Troque a unidade para continuar')).toHaveCount(0)
  const context = await page.evaluate(() => ({
    activeUnitId: localStorage.getItem('fluxo-publico:unit'),
    scopeUnitId: localStorage.getItem('fluxo-publico:scope-unit'),
    primaryUnitId: JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!).users.find((user: { id: string }) => user.id === 'usr-admin').unitId,
  }))
  expect(context).toEqual({
    activeUnitId: 'u-adm',
    scopeUnitId: 'u-adm',
    primaryUnitId: 'u-prot',
  })
})
test('mostra nome e ícone de unidade na tramitação sem destinatário', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-fin')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-fin')
  })
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('fluxo-publico:database:v1') !== null)
  await page.evaluate(() => {
    const key = 'fluxo-publico:database:v1'
    const database = JSON.parse(localStorage.getItem(key)!)
    const protocol = database.protocols.find((item: { id: string }) => item.id === 'pr-18')
    const assignment = database.assignments.find((item: { id: string }) => item.id === protocol.currentAssignmentId)
    protocol.currentUnitId = 'u-fin'
    protocol.currentAssigneeId = undefined
    protocol.status = 'EM_ANDAMENTO'
    assignment.unitId = 'u-fin'
    assignment.assigneeId = undefined
    assignment.receivedAt = undefined
    assignment.receivedById = undefined
    database.events.push({
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
    localStorage.setItem(key, JSON.stringify(database))
  })

  await page.goto('/processos/pr-18')
  await expect(page.getByText('Está com:').locator('..')).toContainText('Financeiro')
  const movementCard = page.getByRole('button', { name: 'Recolher conteúdo de Fase Conclusão' }).locator('xpath=ancestor::section[1]')
  await expect(movementCard.getByText('Financeiro', { exact: true })).toBeVisible()
  await expect(movementCard.getByText('FIN', { exact: true })).toHaveCount(0)
  await expect(movementCard.getByLabel('Unidade de destino').locator('svg')).toBeVisible()
})
test('andamento identifica fase, nome e situação configurada', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
  await page.goto('/processos/pr-1')

  const phaseRow = page.getByRole('button', { name: /^(Expandir|Recolher) conteúdo de Fase Triagem$/ })
  await expect(phaseRow).toBeVisible()
  await expect(phaseRow).toContainText('Fase')
  await expect(phaseRow).toContainText('Triagem')
  await expect(phaseRow).toContainText('Cadastrado')
})
test('abre processo pela unidade secundária sem alterar a unidade principal', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
  })
  await page.goto('/processos/novo')

  await expect(page.getByRole('heading', { name: 'Abrir processo' })).toBeVisible()
  await expect(page.getByText('Para abrir processo, selecione sua unidade de vínculo.')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Tipo de processo *' }).click()
  await page.getByRole('option', { name: 'Pedido de informação' }).click()
  await page.getByRole('combobox', { name: 'Interessado *' }).click()
  await page.getByRole('option', { name: 'Ana Beatriz Costa' }).click()
  await page.getByRole('combobox', { name: 'Responsável *' }).click()
  await expect(page.getByRole('option', { name: 'Marina Duarte' })).toBeVisible()
  await page.getByRole('option', { name: 'Marina Duarte' }).click()
  await page.getByLabel('Assunto *').fill('Operação E2E por unidade secundária')
  await page.getByLabel('Descrição *').fill('Validação da unidade ativa baseada no vínculo.')
  await page.getByRole('button', { name: 'Abrir processo' }).click()

  await expect(page.getByRole('heading', { name: 'Operação E2E por unidade secundária' })).toBeVisible()
  const stored = await page.evaluate(() => {
    const database = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!)
    const protocol = database.protocols.find((item: { subject: string }) => item.subject === 'Operação E2E por unidade secundária')
    return {
      originUnitId: protocol.originUnitId,
      currentUnitId: protocol.currentUnitId,
      currentAssigneeId: protocol.currentAssigneeId,
      primaryUnitId: database.users.find((user: { id: string }) => user.id === 'usr-admin').unitId,
    }
  })
  expect(stored).toEqual({
    originUnitId: 'u-adm',
    currentUnitId: 'u-adm',
    currentAssigneeId: 'usr-admin',
    primaryUnitId: 'u-prot',
  })
})
test('abertura revela e valida os campos configurados pelo tipo de processo', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
  await page.goto('/processos/novo')

  await expect(page.getByText('Selecione o tipo de processo para ver os campos disponíveis.')).toBeVisible()
  await expect(page.getByLabel('Assunto *')).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Tipo de processo *' }).click()
  await page.getByRole('option', { name: 'Pedido de informação' }).click()

  await expect(page.getByRole('combobox', { name: 'Interessado *' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Responsável *' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Credor *' })).toHaveCount(0)
  await expect(page.getByLabel('Valor (R$) *')).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Interessado *' }).click()
  await page.getByRole('option', { name: 'Ana Beatriz Costa' }).click()
  await page.getByRole('combobox', { name: 'Responsável *' }).click()
  await page.getByRole('option', { name: 'Clara Nunes' }).click()
  await page.getByLabel('Assunto *').fill('Pedido progressivo de teste')
  await page.getByLabel('Descrição *').fill('Descrição criada conforme a configuração do tipo.')
  await page.getByLabel('Observações').fill('Observação preservada na abertura.')
  await page.getByRole('button', { name: 'Abrir processo' }).click()

  await expect(page.getByRole('heading', { name: 'Pedido progressivo de teste' })).toBeVisible()
  await page.getByRole('button', { name: 'Resumo' }).click()
  await expect(page.getByText('Observação preservada na abertura.')).toBeVisible()
})

test('formata e persiste valores monetários em reais na abertura', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
  await page.goto('/processos/novo')

  await page.getByRole('combobox', { name: 'Tipo de processo *' }).click()
  await page.getByRole('option', { name: 'Pagamento de fornecedor' }).click()
  await page.getByRole('combobox', { name: 'Interessado *' }).click()
  await page.getByRole('option', { name: 'Ana Beatriz Costa' }).click()
  await page.getByRole('combobox', { name: 'Credor *' }).click()
  await page.getByRole('option', { name: 'Papelaria Horizonte Ltda.' }).click()

  const amount = page.getByLabel('Valor (R$) *')
  await amount.fill('1234,56')
  await expect(amount).toHaveValue('1.234,56')

  await page.getByLabel('Assunto *').fill('Pagamento monetário E2E')
  await page.getByLabel('Descrição *').fill('Validação do valor monetário mascarado no navegador.')
  await page.getByRole('button', { name: 'Abrir processo' }).click()

  await expect(page.getByRole('heading', { name: 'Pagamento monetário E2E' })).toBeVisible()
  const amountCents = await page.evaluate(() => {
    const database = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!)
    return database.protocols.find((item: { subject: string }) => item.subject === 'Pagamento monetário E2E').amountCents
  })
  expect(amountCents).toBe(123456)
})

test('permite dispensar o fluxo sugerido na abertura e registra essa escolha', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('fluxo-publico:database:v1') !== null)
  await page.evaluate(() => {
    const key = 'fluxo-publico:database:v1'
    const database = JSON.parse(localStorage.getItem(key)!)
    const type = database.protocolTypes.find((item: { id: string }) => item.id === 'pt-admin')
    type.flowMode = 'SUGGESTED'
    localStorage.setItem(key, JSON.stringify(database))
  })

  await page.goto('/processos/novo')
  await page.getByRole('combobox', { name: 'Tipo de processo *' }).click()
  await page.getByRole('option', { name: 'Solicitação administrativa' }).click()

  const suggestedFlow = page.getByRole('switch', { name: 'Aplicar fluxo sugerido' })
  await expect(suggestedFlow).toBeChecked()
  await expect(page.getByLabel('Fases configuradas').getByRole('listitem')).toHaveCount(3)
  await suggestedFlow.click()
  await expect(suggestedFlow).not.toBeChecked()

  await page.getByRole('combobox', { name: 'Interessado *' }).click()
  await page.getByRole('option', { name: 'Ana Beatriz Costa' }).click()
  await page.getByLabel('Assunto *').fill('Solicitação sem fluxo sugerido')
  await page.getByLabel('Descrição *').fill('Processo aberto sem aplicar as fases sugeridas.')
  await page.getByRole('button', { name: 'Abrir processo' }).click()

  await expect(page.getByText('Sugerido não aplicado')).toBeVisible()
  const stored = await page.evaluate(() => {
    const database = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!)
    const protocol = database.protocols.at(-1)
    return {
      flowModeSnapshot: protocol.flowModeSnapshot,
      flowSnapshot: protocol.flowSnapshot,
      currentPhaseId: protocol.currentPhaseId,
    }
  })
  expect(stored).toEqual({
    flowModeSnapshot: 'SUGGESTED',
    flowSnapshot: undefined,
    currentPhaseId: undefined,
  })
})

test('endereços antigos de protocolos redirecionam para processos', async ({ page }) => {
  await page.goto('/protocolos/pr-5')
  await expect(page).toHaveURL(/\/processos\/pr-5$/)
  await expect(page.getByRole('heading', { name: 'Análise de aditivo contratual' })).toBeVisible()
})


test('cria a primeira etapa reaproveitando um fluxo órfão existente', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
  const typeName = 'Solicitação administrativa sem etapas'
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('fluxo-publico:database:v1') !== null)

  await page.evaluate((name) => {
    const key = 'fluxo-publico:database:v1'
    const database = JSON.parse(localStorage.getItem(key)!)
    const sourceType = database.protocolTypes[0]
    database.protocolTypes.push({
      ...sourceType,
      id: 'pt-empty-e2e',
      name,
      description: 'Tipo preparado para reproduzir o fluxo vazio.',
      flowId: undefined,
      flowMode: 'SUGGESTED',
      fieldsConfig: { ...sourceType.fieldsConfig, tramitacao: { enabled: true } },
    })
    database.flows.push({
      id: 'flow-orphan-e2e',
      name: `Fluxo — ${name}`,
      version: 1,
      active: true,
      startsAt: new Date().toISOString(),
    })
    localStorage.setItem(key, JSON.stringify(database))
  }, typeName)

  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: `Configurar fluxo de ${typeName}: 0 etapa(s)` }).click()
  await expect(page.getByText('Nenhuma etapa configurada. Crie a primeira etapa deste fluxo.')).toBeVisible()
  await page.getByRole('button', { name: 'Nova etapa' }).click()

  const dialog = page.getByRole('dialog', { name: 'Nova etapa do fluxo' })
  await dialog.getByRole('combobox', { name: 'Fase *' }).click()
  await page.getByRole('option', { name: 'Triagem' }).click()
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Nenhuma etapa configurada. Crie a primeira etapa deste fluxo.')).toBeHidden()
  await expect(page.getByText('Já existe um fluxo com esse nome e versão.')).toHaveCount(0)

  const saved = await page.evaluate(() => {
    const database = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!)
    const type = database.protocolTypes.find((item: { id: string }) => item.id === 'pt-empty-e2e')
    const matchingFlows = database.flows.filter((item: { name: string }) => item.name === 'Fluxo — Solicitação administrativa sem etapas')
    return { flowId: type.flowId, matchingFlowIds: matchingFlows.map((item: { id: string }) => item.id) }
  })
  expect(saved.flowId).toBe('flow-orphan-e2e')
  expect(saved.matchingFlowIds).toEqual(['flow-orphan-e2e'])
})
