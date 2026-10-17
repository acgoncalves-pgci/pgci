import { expect, test } from '@playwright/test'

const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user', 'usr-clara')
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:unit', 'u-prot')
  })
  await page.goto('/saomateusdomaranhao/processos/pr-1')
  await expect(page.getByRole('heading', { name: /^Processo / })).toBeVisible({ timeout: 15_000 })
  await page.evaluate((databaseKey) => {
    const db = JSON.parse(localStorage.getItem(databaseKey)!)
    const protocol = db.protocols.find((item: { id: string }) => item.id === 'pr-1')
    protocol.flowModeSnapshot = 'SUGGESTED'
    protocol.flowSnapshot.phases[0].requiresAttachment = true
    protocol.flowSnapshot.phases[0].requiredAttachmentTypes = ['application/pdf']
    protocol.flowSnapshot.phases[1].destinationUnitId = 'u-adm'
    protocol.flowSnapshot.phases[1].eligibleUnitIds = ['u-adm']
    db.events.find((event: { id: string }) => event.id === 'ev-open-1').checklist = []
    localStorage.setItem(databaseKey, JSON.stringify(db))
  }, key)
  await page.reload()
})

test('sugere o caminho e permite desviar de fase e unidade com pendências', async ({ page }, testInfo) => {
  await expect(page.getByText(/Fluxo sugerido · Etapa recomendada: Análise/)).toBeVisible()
  await page.locator('.page-title').getByRole('button', { name: 'Tramitar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tramitar processo', exact: true })
  const phase = dialog.getByRole('combobox', { name: 'Fase *', exact: true })
  const unit = dialog.getByRole('combobox', { name: 'Unidade organizacional de destino *', exact: true })
  await expect(phase).toBeEnabled()
  await expect(phase).toContainText('Análise')
  await expect(unit).toBeEnabled()
  await expect(unit).toContainText('Administração')
  await expect(dialog.getByText(/Você pode escolher outra fase e outra unidade/)).toBeVisible()
  await expect(dialog.getByText('Anexo obrigatório da fase atual')).toHaveCount(0)
  await phase.click()
  await page.getByRole('option', { name: 'Conferência para pagamento', exact: true }).click()
  await unit.click()
  await page.getByRole('option', { name: /Financeiro/ }).click()
  await dialog.getByLabel('Descrição *').fill('Encaminhado livremente para conferência financeira.')
  await dialog.screenshot({ path: testInfo.outputPath('suggested-forward.png') })
  await dialog.getByRole('button', { name: 'Tramitar', exact: true }).click()
  await page.getByRole('button', { name: 'Não, apenas continuar', exact: true }).click()
  await expect(dialog).toBeHidden()
  const persisted = await page.evaluate((databaseKey) => JSON.parse(localStorage.getItem(databaseKey)!).protocols.find((item: { id: string }) => item.id === 'pr-1'), key)
  expect(persisted.currentUnitId).toBe('u-fin')
  expect(persisted.currentPhaseId).toBe('phase-payment-review')
  expect(persisted.flowSnapshot.phases).toHaveLength(3)
  await expect(page.getByText(/Etapa recomendada: Análise/)).toBeVisible()
  await expect(page.getByText(/Fase atual: Conferência para pagamento \(fora do fluxo sugerido\)/)).toBeVisible()
})

test('permite concluir antes da etapa final sugerida', async ({ page }) => {
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Concluir processo' })
  await dialog.getByRole('textbox').fill('Solicitação resolvida sem necessidade das demais etapas recomendadas.')
  await dialog.getByRole('button', { name: 'Concluir', exact: true }).click()
  await expect(dialog).toBeHidden()
  const status = await page.evaluate((databaseKey) => JSON.parse(localStorage.getItem(databaseKey)!).protocols.find((item: { id: string }) => item.id === 'pr-1').status, key)
  expect(status).toBe('CONCLUIDO')
})
