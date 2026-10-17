import { expect, test, type Page } from '@playwright/test'
import { downloadPreview, expectPdfReady } from './helpers/pdf'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'

const storageKey = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript((dark) => {
    const prefix = 'fluxo-publico:tenant:prefeitura-saomateus-ma:'
    localStorage.setItem(`${prefix}user`, 'usr-clara')
    localStorage.setItem(`${prefix}unit`, 'u-prot')
    localStorage.setItem(`${prefix}theme`, dark ? 'dark' : 'light')
  }, testInfo.project.name === 'mobile')
  await page.goto('/lotes')
  await expect(page.getByRole('heading', { name: 'Lotes', exact: true })).toBeVisible()
  await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!)
    const template = structuredClone(db.protocols.find((item: { id: string }) => item.id === 'pr-1'))
    db.protocols = ['lot-1', 'lot-2', 'lot-blocked', 'lot-created', 'lot-outsider', 'lot-closed'].map((id, index) => {
      const protocol = { ...structuredClone(template), id, number: `2026.90.01.000${index + 1}`, subject: `Processo de teste ${id}`, typeId: index % 2 ? 'pt-admin' : 'pt-buy', createdById: id === 'lot-outsider' ? 'usr-bruno' : 'usr-clara', currentAssigneeId: id === 'lot-created' ? 'usr-admin' : id === 'lot-outsider' ? 'usr-bruno' : 'usr-clara', currentUnitId: 'u-prot', currentAssignmentId: `assignment-${id}`, status: id === 'lot-closed' ? 'CONCLUIDO' : 'CADASTRADO', version: 1, flowModeSnapshot: id === 'lot-blocked' ? 'REQUIRED' : 'NONE', flowSnapshot: id === 'lot-blocked' ? structuredClone(template.flowSnapshot) : undefined, currentPhaseId: id === 'lot-blocked' ? 'phase-triage' : undefined }
      db.assignments.push({ id: protocol.currentAssignmentId, protocolId: id, unitId: 'u-prot', assigneeId: protocol.currentAssigneeId, startedAt: protocol.createdAt, receivedAt: protocol.createdAt, receivedById: protocol.currentAssigneeId })
      db.events.push({ id: `opening-${id}`, protocolId: id, kind: 'ABERTURA', actorUserId: protocol.createdById, actorUnitId: 'u-prot', assignmentId: protocol.currentAssignmentId, createdAt: protocol.createdAt, nextStatus: protocol.status, phaseId: protocol.currentPhaseId, checklist: id === 'lot-blocked' ? [{ questionId: 'q-triage-review', text: 'Conferir dados', checked: false }] : undefined })
      return protocol
    })
    db.memberships.push({ id: 'batch-bruno-accounting', userId: 'usr-bruno', unitId: 'u-accounting', role: 'OPERADOR', startsAt: '2020-01-01T00:00:00Z', active: true })
    db.batches = []
    localStorage.setItem(key, JSON.stringify(db))
  }, storageKey)
  await page.reload()
})

async function choose(page: Page, field: string, option: string) {
  await page.getByRole('combobox', { name: field, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function prepareMovement(page: Page, hierarchical = false) {
  await page.getByRole('button', { name: 'Nova Movimentação', exact: true }).click()
  const types = page.getByRole('dialog', { name: 'Movimentação em Lote', exact: true })
  await types.getByRole('checkbox', { name: 'Selecionar todos os tipos de processo' }).check()
  const adminType = types.getByRole('checkbox', { name: 'Selecionar tipo Solicitação administrativa', exact: true })
  await adminType.uncheck()
  await expect(types.getByRole('checkbox', { name: 'Selecionar todos os tipos de processo' })).toHaveJSProperty('indeterminate', true)
  await adminType.check()
  await types.getByRole('button', { name: 'Confirmar seleção' }).click()
  await choose(page, 'Fase', 'Análise')
  await choose(page, 'Secretaria', 'Administração')
  if (hierarchical) {
    await choose(page, 'Unidade', 'Financeiro')
    await choose(page, 'Setor', 'Administração / Financeiro / Contabilidade')
  }
  await choose(page, 'Responsável', 'Bruno Lima')
  await expect(page.getByRole('button', { name: 'Selecionar processos', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Observação', exact: true }).fill('   ')
  await expect(page.getByRole('button', { name: 'Selecionar processos', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Observação', exact: true }).fill('Conferência de processos encaminhados em lote.')
}

test('seleciona tipos e processos, respeita pendências e grava lote e históricos', async ({ page }, testInfo) => {
  await prepareMovement(page, true)
  const deadline = new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  await page.getByLabel('Prazo', { exact: true }).fill(deadline)
  await page.getByRole('button', { name: 'Selecionar processos', exact: true }).click()
  const selection = page.getByRole('region', { name: 'Selecionar processos do lote' })
  await expect(selection.getByRole('checkbox', { name: /^Selecionar processo / })).toHaveCount(4)
  await expect(selection.getByRole('checkbox', { name: 'Selecionar processo 2026.90.01.0003', exact: true })).toBeDisabled()
  await expect(selection.getByRole('checkbox', { name: 'Selecionar processo 2026.90.01.0004', exact: true })).toBeDisabled()
  await selection.getByRole('checkbox', { name: 'Selecionar todos os processos disponíveis' }).check()
  await expect(selection.getByRole('button', { name: 'Movimentar em Lote (2)', exact: true })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('batch-selection.png'), fullPage: true })
  await selection.getByRole('button', { name: 'Movimentar em Lote (2)', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Confirmar movimentação em lote', exact: true })
  await expect(confirmation.getByText('Conferência de processos encaminhados em lote.', { exact: true })).toBeVisible()
  await confirmation.getByRole('button', { name: 'Confirmar movimentação', exact: true }).click()
  const details = page.getByRole('dialog', { name: /^Lote / })
  await expect(details).toBeVisible()
  const saved = await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!)
    return { batch: db.batches[0], count: db.batches.length, processes: db.protocols.filter((item: { id: string }) => ['lot-1', 'lot-2'].includes(item.id)), events: db.events.filter((item: { batchId?: string }) => item.batchId) }
  }, storageKey)
  expect(saved.count).toBe(1)
  expect(saved.batch.protocols).toHaveLength(2)
  expect(saved.events).toHaveLength(2)
  expect(saved.processes.every((item: { currentUnitId: string; currentAssigneeId: string; dueAt: string }) => item.currentUnitId === 'u-accounting' && item.currentAssigneeId === 'usr-bruno' && Boolean(item.dueAt))).toBe(true)
  await details.getByRole('link', { name: 'Ver processo' }).first().click()
  await expect(page.getByText(`Movimentação em lote · ${saved.batch.number}`, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Conferência de processos encaminhados em lote.', { exact: true })).toBeVisible()
  await page.goto('/lotes')
  await expect(page.getByRole('heading', { name: `Lote ${saved.batch.number}`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Exportar comprovante do lote ${saved.batch.number}`, exact: true }).click()
  const receipt = page.getByRole('dialog', { name: `Comprovante de protocolos em lote — ${saved.batch.number}`, exact: true })
  await expectPdfReady(receipt)
  const text = receipt.locator('.textLayer')
  await expect(text).toContainText('COMPROVANTE DE PROTOCOLOS EM LOTE')
  await expect(text).toContainText(`NÚMERO DO LOTE: ${saved.batch.number}`)
  await expect(text).toContainText('Clara Nunes')
  await expect(text).toContainText('Bruno Lima')
  await expect(text).toContainText('Administração / Financeiro / Contabilidade')
  await expect(text).toContainText('2026.90.01.0001')
  await expect(text).toContainText('2026.90.01.0002')
  await expect(text).toContainText('Total de protocolos: 2')
  const download = await downloadPreview(page, receipt)
  expect(download.suggestedFilename()).toBe(`lote_${saved.batch.number}.pdf`)
  await download.saveAs(testInfo.outputPath('batch-receipt.pdf'))
  const document = await PDFDocument.load(await readFile((await download.path())!))
  expect(document.getPageCount()).toBe(1)
  await receipt.getByRole('button', { name: 'Fechar diálogo', exact: true }).click()
  await page.getByRole('button', { name: 'Ver lote' }).click()
  await expect(page.getByRole('dialog', { name: `Lote ${saved.batch.number}`, exact: true }).getByRole('link', { name: 'Ver processo' })).toHaveCount(2)
})

test('conflito de versão impede o lote inteiro e permite atualizar e tentar novamente', async ({ page }) => {
  await prepareMovement(page)
  await page.getByRole('button', { name: 'Selecionar processos', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Selecionar todos os processos disponíveis' }).check()
  await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!)
    db.protocols.find((item: { id: string }) => item.id === 'lot-2').version++
    localStorage.setItem(key, JSON.stringify(db))
  }, storageKey)
  await page.getByRole('button', { name: 'Movimentar em Lote (2)', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Confirmar movimentação em lote', exact: true })
  await confirmation.getByRole('button', { name: 'Confirmar movimentação', exact: true }).click()
  await expect(confirmation.getByText(/Nenhum processo foi movimentado/)).toBeVisible()
  expect(await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!)
    return { batches: db.batches.length, units: db.protocols.filter((item: { id: string }) => ['lot-1', 'lot-2'].includes(item.id)).map((item: { currentUnitId: string }) => item.currentUnitId) }
  }, storageKey)).toEqual({ batches: 0, units: ['u-prot', 'u-prot'] })
  await confirmation.getByRole('button', { name: 'Voltar', exact: true }).click()
  await page.getByRole('button', { name: 'Atualizar disponibilidade' }).click()
  await expect(page.getByRole('button', { name: 'Atualizar disponibilidade' })).toBeEnabled()
  await page.getByRole('button', { name: 'Movimentar em Lote (2)', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Confirmar movimentação', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /^Lote / })).toBeVisible()
})

test('restringe o módulo à permissão de tramitação', async ({ page }) => {
  await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!)
    for (const membership of db.memberships.filter((item: { userId: string }) => item.userId === 'usr-clara')) membership.permissions = membership.permissions.filter((permission: string) => permission !== 'processes.act')
    localStorage.setItem(key, JSON.stringify(db))
  }, storageKey)
  await page.reload()
  await expect(page.getByText('Acesso restrito', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lotes', exact: true })).toHaveCount(0)
})
