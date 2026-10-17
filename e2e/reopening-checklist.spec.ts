import { expect, test } from '@playwright/test'
import { configureDemoSession } from './helpers/session'

configureDemoSession()

for (const { legacy, existingAttachment } of [{ legacy: false, existingAttachment: true }, { legacy: true, existingAttachment: true }, { legacy: false, existingAttachment: false }]) {
  test(`cancelar e reabrir libera checklist, detalhes e tramitação (registro legado: ${legacy}, anexo existente: ${existingAttachment})`, async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await page.goto('/processos/pr-1')
    await expect(page.getByRole('group', { name: 'Ações da movimentação' })).toBeVisible()
    await page.evaluate((hasAttachment) => {
      const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'
      const db = JSON.parse(localStorage.getItem(key)!)
      const protocol = db.protocols.find((item: { id: string }) => item.id === 'pr-1')
      const phase = protocol.flowSnapshot.phases.find((item: { phaseId: string }) => item.phaseId === protocol.currentPhaseId)
      Object.assign(phase.checklistQuestions[0], { requiresDate: true, requiresObservation: true, requiresAttachment: true })
      phase.requiredAttachmentTypes = ['text/plain']
      if (!hasAttachment) db.attachments = db.attachments.filter((item: { protocolId: string }) => item.protocolId !== 'pr-1')
      db.events.find((item: { id: string }) => item.id === 'ev-open-1').checklist = [{ questionId: 'q-triage-data', text: 'Conferir dados de abertura', checked: false }]
      localStorage.setItem(key, JSON.stringify(db))
      localStorage.setItem('fluxo-publico:tenant:prefeitura-saomateus-ma:user', 'usr-admin')
    }, existingAttachment)
    await page.reload()
    await page.getByRole('group', { name: 'Ações da movimentação' }).getByRole('button', { name: 'Cancelar', exact: true }).click()
    const cancelDialog = page.getByRole('dialog', { name: 'Cancelar processo', exact: true })
    await cancelDialog.getByLabel('Motivo do cancelamento *').fill('Aguardar nova conferência.')
    await cancelDialog.getByRole('button', { name: 'Cancelar processo', exact: true }).click()
    await expect(cancelDialog).toBeHidden()

    await page.getByRole('group', { name: 'Ações da movimentação' }).getByRole('button', { name: 'Reabrir', exact: true }).click()
    const reopenDialog = page.getByRole('dialog', { name: 'Reabrir processo', exact: true })
    await reopenDialog.getByLabel('Motivo da reabertura *').fill('Retomar conferência do checklist.')
    await reopenDialog.getByRole('button', { name: 'Reabrir', exact: true }).click()
    await page.getByRole('dialog', { name: 'Confirmar reabertura' }).getByRole('button', { name: 'Confirmar reabertura', exact: true }).click()
    await expect(reopenDialog).toBeHidden()
    if (legacy) {
      await page.evaluate(() => {
        const key = 'fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1'
        const db = JSON.parse(localStorage.getItem(key)!)
        const event = db.events.filter((item: { protocolId: string; kind: string }) => item.protocolId === 'pr-1' && item.kind === 'REABERTURA').at(-1)
        delete event.phaseId
        delete event.checklist
        localStorage.setItem(key, JSON.stringify(db))
      })
      await page.reload()
    }
    const movement = page.getByRole('button', { name: 'Recolher conteúdo de Reabertura do processo', exact: true }).locator('xpath=ancestor::article[1]')
    const checkbox = movement.getByRole('checkbox', { name: 'Conferir dados de abertura', exact: true })
    await expect(checkbox).toBeDisabled()
    await movement.getByRole('button', { name: 'Assumir e dar ciência', exact: true }).click()
    const assumeDialog = page.getByRole('dialog', { name: 'Assumir e marcar como visualizado?' })
    await assumeDialog.getByRole('button', { name: 'Assumir responsabilidade' }).click()
    await expect(assumeDialog).toBeHidden()
    await expect(checkbox).toBeEnabled()
    await checkbox.click()
    const details = page.getByRole('dialog', { name: 'Informações do item Conferir dados de abertura' })
    await expect(details.getByRole('button', { name: 'Salvar e marcar' })).toBeDisabled()
    await details.locator('input[type="date"]').fill('2026-10-16')
    await details.getByRole('textbox', { name: 'Observação obrigatória' }).fill('Documentação conferida após reabertura.')
    if (!existingAttachment) {
      await expect(details.getByRole('button', { name: 'Salvar e marcar' })).toBeDisabled()
      const chooserPromise = page.waitForEvent('filechooser')
      await details.getByRole('button', { name: 'Selecionar arquivo' }).click()
      const chooser = await chooserPromise
      await chooser.setFiles({ name: 'conferencia-reabertura.txt', mimeType: 'text/plain', buffer: Buffer.from('Documento conferido após reabertura.') })
    }
    await expect(details.getByRole('button', { name: '1 arquivo(s) anexado(s)' })).toBeVisible()
    await expect(details.getByRole('button', { name: 'Salvar e marcar' })).toBeEnabled()
    await details.getByRole('button', { name: 'Salvar e marcar' }).click()
    await expect(checkbox).toBeChecked()
    const forward = page.getByRole('group', { name: 'Ações da movimentação' }).getByRole('button', { name: 'Tramitar', exact: true })
    await expect(forward).toHaveAttribute('aria-disabled', 'false')
    await page.reload()
    await expect(checkbox).toBeChecked()
    await movement.screenshot({ path: testInfo.outputPath('reopened-checklist.png') })
    await forward.click()
    const forwardDialog = page.getByRole('dialog', { name: 'Tramitar processo', exact: true })
    const destination = forwardDialog.getByRole('combobox', { name: 'Unidade organizacional de destino *' })
    if (await destination.isEnabled()) {
      await destination.click()
      await page.getByRole('option', { name: 'Administração', exact: true }).click()
    }
    await forwardDialog.getByLabel('Descrição *', { exact: true }).fill('Prosseguir após concluir as pendências da reabertura.')
    await forwardDialog.getByRole('button', { name: 'Tramitar', exact: true }).click()
    await page.getByRole('dialog', { name: 'Registrar atividade?' }).getByRole('button', { name: 'Não, apenas continuar' }).click()
    await expect(forwardDialog).toBeHidden()
    const persisted = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!)
      return { protocol: db.protocols.find((item: { id: string }) => item.id === 'pr-1'), opening: db.events.find((item: { id: string }) => item.id === 'ev-open-1'), reopened: db.events.find((item: { protocolId: string; kind: string }) => item.protocolId === 'pr-1' && item.kind === 'REABERTURA') }
    })
    expect(persisted.protocol).toMatchObject({ currentPhaseId: 'phase-analysis', currentUnitId: 'u-adm' })
    expect(persisted.opening.checklist[0].checked).toBe(false)
    expect(persisted.reopened.checklist[0]).toMatchObject({ checked: true, date: '2026-10-16', observation: 'Documentação conferida após reabertura.' })
  })
}
