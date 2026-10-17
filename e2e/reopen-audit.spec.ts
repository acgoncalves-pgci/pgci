import { expect, test } from '@playwright/test'
import { configureDemoSession } from './helpers/session'
import { expectPdfReady } from './helpers/pdf'

configureDemoSession()

for (const status of ['REJEITADO', 'CANCELADO']) {
  test(`reabre processo ${status} pela barra somente após confirmar`, async ({ page }, testInfo) => {
    await page.goto('/processos/pr-1')
    await expect(page.getByRole('group', { name: 'Ações da movimentação' })).toBeVisible()
    await page.evaluate((terminalStatus) => {
      const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'
      const db = JSON.parse(localStorage.getItem(key)!)
      db.protocols.find((item: { id: string }) => item.id === 'pr-1').status = terminalStatus
      localStorage.setItem(key, JSON.stringify(db))
      localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user', 'usr-admin')
    }, status)
    await page.reload()
    await page.getByRole('button', { name: 'Ações', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Reabrir processo', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Ações', exact: true }).click()
    const actions = page.getByRole('group', { name: 'Ações da movimentação' })
    await expect(actions.getByRole('button')).toHaveText(['Reabrir'])
    await expect(page.locator('.page-title').getByRole('button', { name: 'Tramitar', exact: true })).toHaveCount(0)
    await actions.getByRole('button', { name: 'Reabrir', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Reabrir processo', exact: true })
    await expect(form.getByRole('button', { name: 'Reabrir', exact: true })).toBeDisabled()
    await form.getByLabel('Motivo da reabertura *', { exact: true }).fill('Reabertura para revisão da documentação.')
    await form.getByRole('button', { name: 'Reabrir', exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: 'Confirmar reabertura', exact: true })
    await expect(confirmation).toContainText('Gestão de Processos')
    await expect(confirmation).toContainText('Reabertura para revisão da documentação.')
    await confirmation.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(confirmation).toBeHidden()
    const unchanged = await page.evaluate(() => JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!).protocols.find((item: { id: string }) => item.id === 'pr-1').status)
    expect(unchanged).toBe(status)
    await form.getByRole('button', { name: 'Reabrir', exact: true }).click()
    await confirmation.getByRole('button', { name: 'Confirmar reabertura', exact: true }).click()
    await expect(form).toBeHidden()
    await expect(page.getByRole('button', { name: 'Recolher conteúdo de Reabertura do processo', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Tipo, responsabilidade e etapas do processo' })).toContainText('Reaberto')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Recolher conteúdo de Reabertura do processo', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /^Auditoria\b/ }).click()
    const timeline = page.getByRole('region', { name: 'Histórico de auditoria' })
    await expect(timeline).toContainText('Processo reaberto')
    await expect(timeline).toContainText('Reabertura para revisão da documentação.')
    await timeline.screenshot({ path: testInfo.outputPath('audit-reopened.png') })
    const persisted = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!)
      return db.events.filter((item: { protocolId: string; kind: string }) => item.protocolId === 'pr-1' && item.kind === 'REABERTURA')
    })
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({ previousStatus: status, nextStatus: 'EM_ANDAMENTO', actorUserId: 'usr-admin', message: 'Reabertura para revisão da documentação.' })
  })
}

test('barra oculta reabertura sem a permissão específica', async ({ page }) => {
  await page.goto('/processos/pr-1')
  await expect(page.getByRole('group', { name: 'Ações da movimentação' })).toBeVisible()
  await page.evaluate(() => {
    const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'
    const db = JSON.parse(localStorage.getItem(key)!)
    db.protocols.find((item: { id: string }) => item.id === 'pr-1').status = 'CANCELADO'
    localStorage.setItem(key, JSON.stringify(db))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Ações', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Reabrir processo', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Ações da movimentação' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reabrir', exact: true })).toHaveCount(0)
})

test('auditoria abre anexos e documentos e leva à movimentação sem sair do processo', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/processos/pr-1')
  await expect(page.getByRole('group', { name: 'Ações da movimentação' })).toBeVisible()
  const files = await page.evaluate(() => {
    const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'
    const db = JSON.parse(localStorage.getItem(key)!)
    const attachment = db.attachments.find((item: { protocolId: string }) => item.protocolId === 'pr-1')
    const document = db.documents.find((item: { protocolId: string }) => item.protocolId === 'pr-1')
    db.auditEvents.push({ id: 'audit-file-shortcut', protocolId: 'pr-1', action: 'ATTACHMENT_UPDATED', actorUserId: 'usr-clara', actorUnitId: 'u-prot', targetType: 'ATTACHMENT', targetId: attachment.id, details: 'Nome do anexo conferido.', createdAt: new Date().toISOString() })
    db.auditEvents.push({ id: 'audit-document-shortcut', protocolId: 'pr-1', action: 'DOCUMENT_UPDATED', actorUserId: 'usr-clara', actorUnitId: 'u-prot', targetType: 'DOCUMENT', targetId: document.id, details: 'Documento conferido.', createdAt: new Date().toISOString() })
    localStorage.setItem(key, JSON.stringify(db))
    return { attachment, document }
  })
  await page.reload()
  await page.getByRole('button', { name: /^Auditoria\b/ }).click()
  const timeline = page.getByRole('region', { name: 'Histórico de auditoria' })
  await expect(timeline.getByRole('list', { name: 'Eventos de auditoria' })).toBeVisible()
  await timeline.getByRole('button', { name: `Abrir anexo ${files.attachment.filename}`, exact: true }).first().click()
  const attachmentDialog = page.getByRole('dialog', { name: files.attachment.filename, exact: true })
  await expect(attachmentDialog).toBeVisible()
  await attachmentDialog.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(attachmentDialog).toBeHidden()
  await timeline.getByRole('button', { name: `Abrir documento ${files.document.number}`, exact: true }).first().click()
  const documentDialog = page.getByRole('dialog', { name: `${files.document.number}.pdf`, exact: true })
  await expectPdfReady(documentDialog)
  await documentDialog.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(documentDialog).toBeHidden()
  const geometry = await timeline.evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }))
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1)
  await timeline.screenshot({ path: testInfo.outputPath('audit-file-shortcuts.png') })
  await page.evaluate(() => localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:theme', 'dark'))
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: /^Auditoria\b/ }).click()
  await timeline.screenshot({ path: testInfo.outputPath('audit-file-shortcuts-dark.png') })
  await timeline.getByRole('button', { name: 'Ver movimentação', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /^Movimentações/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Histórico de auditoria' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/processos\/pr-1$/)
})
