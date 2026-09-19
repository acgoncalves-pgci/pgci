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
  await page.waitForTimeout(250)
  await expect(page.getByRole('status', { name: 'Carregando tela' })).toHaveCount(0)

  await page.getByRole('button', { name: /Filtro avançado/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Pesquisar processos' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Tipo de processo' }).click()
  await page.getByRole('option', { name: 'Pagamento de fornecedor' }).click()
  await dialog.getByRole('combobox', { name: 'Credor' }).click()
  await page.getByRole('option', { name: 'Água Clara Serviços Ltda.' }).click()
  await dialog.getByRole('button', { name: 'Em andamento' }).click()
  await dialog.getByRole('button', { name: 'Sem anexos' }).click()
  await dialog.getByRole('button', { name: 'Buscar' }).click()

  await expect(page).toHaveURL(/typeId=pt-pay/)
  await expect(page).toHaveURL(/creditorId=p-9/)
  await expect(page.getByRole('status', { name: 'Carregando tela' })).toHaveCount(0)
  await expect(page.locator('.process-card')).toHaveCount(1)
  await expect(page.locator('.process-card')).toHaveAttribute('data-status', 'EM_ANDAMENTO')
  await page.locator('.process-card').click()
  await expect(page).toHaveURL(/\/processos\/pr-2$/)
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
