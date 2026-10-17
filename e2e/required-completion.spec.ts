import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:unit', 'u-prot')
  })
})

for (const reopen of [false, true]) {
  test(`conclusão obrigatória exige checklist completo, detalhes e anexo (reabertura: ${reopen})`, async ({ page }) => {
    await page.goto('/processos/pr-1')
    await expect(page.getByRole('group', { name: 'Ações da movimentação' })).toBeVisible()
    await page.evaluate(() => {
      const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'
      const db = JSON.parse(localStorage.getItem(key)!)
      const protocol = db.protocols.find((item: { id: string }) => item.id === 'pr-1')
      protocol.status = 'EM_ANDAMENTO'
      protocol.flowModeSnapshot = 'REQUIRED'
      protocol.currentPhaseId = 'phase-completion'
      protocol.currentAssigneeId = 'usr-admin'
      const assignment = db.assignments.find((item: { id: string }) => item.id === protocol.currentAssignmentId)
      assignment.assigneeId = 'usr-admin'
      assignment.receivedAt = new Date().toISOString()
      assignment.receivedById = 'usr-admin'
      const phase = protocol.flowSnapshot.phases.find((item: { phaseId: string }) => item.phaseId === protocol.currentPhaseId)
      phase.requiresAttachment = true
      phase.requiredAttachmentTypes = ['text/plain']
      phase.checklistQuestions[0].requiresAttachment = true
      db.attachments = db.attachments.filter((item: { protocolId: string }) => item.protocolId !== protocol.id)
      const opening = db.events.find((item: { id: string }) => item.id === 'ev-open-1')
      db.events.push({ ...opening, id: 'movement-final-pending', kind: 'TRAMITACAO', actorUserId: 'usr-admin', phaseId: protocol.currentPhaseId, fromUnitId: 'u-prot', toUnitId: 'u-prot', toUserId: 'usr-admin', createdAt: new Date().toISOString(), checklist: [{ questionId: 'q-completion-result', text: 'Registrar resultado final', checked: false }] })
      localStorage.setItem(key, JSON.stringify(db))
    })
    if (reopen) {
      await page.evaluate(async () => {
        const modulePath = '/src/services/api.ts'
        const { api } = await import(modulePath)
        const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
        const { protocol } = await api.getProtocol(ctx, 'pr-1')
        const cancelled = await api.cancel(ctx, protocol.id, protocol.version, 'Refazer a conferência final.')
        const reopened = await api.reopen(ctx, protocol.id, cancelled.version, { unitId: 'u-prot', assigneeId: ctx.userId, message: 'Retomar pendências finais.' })
        await api.acknowledge(ctx, protocol.id, reopened.version)
      })
    }
    await page.reload()
    const complete = page.getByRole('group', { name: 'Ações da movimentação' }).getByRole('button', { name: 'Concluir', exact: true })
    await complete.click()
    const pending = page.getByRole('dialog', { name: 'Pendências para concluir', exact: true })
    await expect(pending.getByText('Conclua o item do checklist: Registrar resultado final.')).toBeVisible()
    await expect(pending.getByText('Anexe um arquivo TXT exigido pela fase atual.')).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Concluir processo', exact: true })).toHaveCount(0)
    await pending.getByRole('button', { name: 'Voltar ao processo' }).click()

    const checkbox = page.getByRole('checkbox', { name: 'Registrar resultado final', exact: true }).first()
    await checkbox.click()
    const details = page.getByRole('dialog', { name: 'Informações do item Registrar resultado final' })
    await expect(details.getByRole('button', { name: 'Salvar e marcar' })).toBeDisabled()
    await details.locator('input[type="date"]').fill('2026-10-16')
    await details.getByRole('textbox', { name: 'Observação obrigatória' }).fill('Resultado final conferido e comprovado.')
    await expect(details.getByRole('button', { name: 'Salvar e marcar' })).toBeDisabled()
    const chooserPromise = page.waitForEvent('filechooser')
    await details.getByRole('button', { name: 'Selecionar arquivo' }).click()
    await (await chooserPromise).setFiles({ name: 'resultado-final.txt', mimeType: 'text/plain', buffer: Buffer.from('Comprovação do resultado final.') })
    await details.getByRole('button', { name: 'Salvar e marcar' }).click()
    await expect(details).toBeHidden()
    await expect(checkbox).toBeChecked()
    await expect(complete).not.toHaveAttribute('title', 'Existem pendências. Clique para ver o que falta.')
    await complete.click()
    const confirmation = page.getByRole('dialog', { name: 'Concluir processo', exact: true })
    await confirmation.getByRole('textbox', { name: 'Resultado da conclusão *', exact: true }).fill('Processo finalizado após resolver todas as pendências.')
    await confirmation.getByRole('button', { name: 'Concluir', exact: true }).click()
    await expect(confirmation).toBeHidden()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!).protocols.find((item: { id: string }) => item.id === 'pr-1').status)).toBe('CONCLUIDO')
    await page.reload()
    await expect(page.getByRole('group', { name: 'Ações da movimentação' }).getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0)
  })
}
