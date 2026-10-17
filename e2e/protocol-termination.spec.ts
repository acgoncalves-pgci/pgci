import { expect, test } from '@playwright/test'
import { configureDemoSession } from './helpers/session'

configureDemoSession()

for (const scenario of [
  { button: 'Rejeitar', title: 'Rejeitar processo', field: 'Motivo da rejeição *', status: 'REJEITADO', label: 'Rejeitado', movement: 'Processo rejeitado', kind: 'REJEICAO', audit: 'PROTOCOL_REJECTED' },
  { button: 'Cancelar', title: 'Cancelar processo', field: 'Motivo do cancelamento *', status: 'CANCELADO', label: 'Cancelado', movement: 'Processo cancelado', kind: 'CANCELAMENTO', audit: 'PROTOCOL_CANCELLED' },
]) {
  test(`${scenario.button} exige confirmação e mantém o histórico após recarregar`, async ({ page }, testInfo) => {
    await page.goto('/processos/pr-1')
    const actions = page.getByRole('group', { name: 'Ações da movimentação' })
    const trigger = actions.getByRole('button', { name: scenario.button, exact: true })
    await expect(trigger).toBeEnabled()
    const before = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!)
      return { protocol: db.protocols.find((item: { id: string }) => item.id === 'pr-1'), events: db.events.length, audit: db.auditEvents.length }
    })

    await trigger.click()
    const dialog = page.getByRole('dialog', { name: scenario.title, exact: true })
    await expect(dialog).toContainText('Confirma')
    await expect(dialog).toContainText(before.protocol.number)
    const confirm = dialog.getByRole('button', { name: scenario.title, exact: true })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel(scenario.field, { exact: true }).fill('   ')
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel(scenario.field, { exact: true }).fill('Motivo que não será confirmado.')
    await dialog.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(dialog).toBeHidden()
    const unchanged = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!)
      return { protocol: db.protocols.find((item: { id: string }) => item.id === 'pr-1'), events: db.events.length, audit: db.auditEvents.length }
    })
    expect(unchanged).toEqual(before)

    await trigger.click()
    const reason = `Justificativa de ${scenario.button.toLocaleLowerCase()} registrada para conferência.`
    await dialog.getByLabel(scenario.field, { exact: true }).fill(reason)
    await confirm.click()
    await expect(dialog).toBeHidden()
    const movement = page.locator('.timeline-panel article').first()
    await expect(movement.getByRole('button', { name: `Recolher conteúdo de ${scenario.movement}`, exact: true })).toBeVisible()
    await expect(movement).toContainText(reason)
    await expect(movement).toContainText('Clara Nunes')
    await expect(movement).toContainText('Gestão de Processos')
    await expect(movement.getByRole('button', { name: 'Anexar documento', exact: true })).toHaveCount(0)
    await expect(movement.getByRole('button', { name: 'Anexar arquivo', exact: true })).toHaveCount(0)
    await expect(movement.getByRole('link', { name: 'Anexar documento', exact: true })).toHaveCount(0)
    const overview = page.getByRole('region', { name: 'Tipo, responsabilidade e etapas do processo' })
    await expect(overview).toContainText(scenario.label)
    for (const label of ['Tramitar', 'Concluir', 'Arquivar', 'Rejeitar', 'Cancelar']) {
      await expect(actions.getByRole('button', { name: label, exact: true })).toHaveCount(0)
    }
    const persisted = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!)
      return { protocol: db.protocols.find((item: { id: string }) => item.id === 'pr-1'), events: db.events.filter((item: { protocolId: string }) => item.protocolId === 'pr-1'), audit: db.auditEvents.filter((item: { targetId: string }) => item.targetId === 'pr-1') }
    })
    expect(persisted.protocol).toMatchObject({ status: scenario.status, version: before.protocol.version + 1 })
    expect(persisted.events).toContainEqual(expect.objectContaining({ kind: scenario.kind, message: reason, actorUserId: 'usr-clara', actorUnitId: 'u-prot', previousStatus: before.protocol.status, nextStatus: scenario.status }))
    expect(persisted.audit).toContainEqual(expect.objectContaining({ action: scenario.audit }))
    await page.reload()
    await expect(movement).toContainText(reason)
    await expect(overview).toContainText(scenario.label)
    await movement.screenshot({ path: testInfo.outputPath('terminal-movement.png') })
  })
}
