import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

test('responsável atual dá ciência pela lista sem abrir o processo', async ({ page, isMobile }) => {
  await page.goto('/processos?tab=all&search=2026.000019')
  await expect(page.getByRole('button', { name: 'Dar ciência do processo 2026.000019' })).toHaveCount(0)

  await page.evaluate(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-bruno')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
  })
  await page.reload()

  const card = page.locator('.process-card').filter({ hasText: '2026.000019' })
  const view = card.getByRole('link', { name: 'Visualizar processo 2026.000019' })
  const acknowledge = card.getByRole('button', { name: 'Dar ciência do processo 2026.000019' })
  await expect(view).toBeVisible()
  await expect(acknowledge).toBeVisible()
  await expect(acknowledge).toHaveClass(/process-card-action-button--pulse/)
  if (!isMobile) {
    const [viewBox, acknowledgeBox] = await Promise.all([view.boundingBox(), acknowledge.boundingBox()])
    expect(viewBox).not.toBeNull()
    expect(acknowledgeBox).not.toBeNull()
    expect(acknowledgeBox!.x).toBeGreaterThan(viewBox!.x)
  }

  await acknowledge.click()
  await expect(page).toHaveURL(/\/processos\?/)
  const confirmation = page.getByRole('dialog', { name: 'Confirmar visualização da tramitação?' })
  await expect(confirmation).toContainText('sem abrir o processo')
  await confirmation.getByRole('button', { name: 'Confirmar ciência' }).click()

  await expect(confirmation).toBeHidden()
  const registered = card.getByRole('button', { name: 'Ciência registrada no processo 2026.000019' })
  await expect(registered).toBeVisible()
  await expect(registered).toBeDisabled()
  await expect(registered).toHaveClass(/process-card-action-button--done/)
  await expect(registered).not.toHaveClass(/process-card-action-button--pulse/)
  await expect(page).toHaveURL(/\/processos\?/)
})

test('lista compacta mostra anexos e menu de impressão completo', async ({ page }) => {
  await page.goto('/processos?tab=all')

  const firstCard = page.locator('.process-card').first()
  await expect(firstCard).toBeVisible()
  const attachmentBadge = firstCard.getByTitle(/anexo/)
  await expect(attachmentBadge).toBeVisible()

  const [statusBox, attachmentBox, referenceBox, stateBox] = await Promise.all([
    firstCard.locator('.process-card-state > span').first().boundingBox(),
    attachmentBadge.boundingBox(),
    firstCard.locator('.process-card-reference').boundingBox(),
    firstCard.locator('.process-card-state').boundingBox(),
  ])
  expect(statusBox).not.toBeNull()
  expect(attachmentBox).not.toBeNull()
  expect(referenceBox).not.toBeNull()
  expect(stateBox).not.toBeNull()
  expect(Math.abs((statusBox!.y + statusBox!.height / 2) - (attachmentBox!.y + attachmentBox!.height / 2))).toBeLessThan(1)
  expect(Math.abs(statusBox!.x - stateBox!.x)).toBeLessThan(1)
  expect(Math.abs((stateBox!.x + stateBox!.width) - (attachmentBox!.x + attachmentBox!.width))).toBeLessThan(5)
  expect(referenceBox!.x + referenceBox!.width - (attachmentBox!.x + attachmentBox!.width)).toBeGreaterThan(8)

  const descriptionChannels = await firstCard.locator('.process-card-description').evaluate((element) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) return []
    context.fillStyle = getComputedStyle(element).backgroundColor
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
  })
  expect(descriptionChannels).toHaveLength(3)
  expect(Math.min(...descriptionChannels)).toBeGreaterThan(230)

  await firstCard.getByRole('button', { name: /Imprimir processo/ }).click()

  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem')).toHaveCount(4)
  await expect(menu.getByRole('menuitem', { name: 'Imprimir capa' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Imprimir comprovante' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Imprimir etiqueta' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Imprimir detalhamento' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await menu.getByRole('menuitem', { name: 'Imprimir comprovante' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^comprovante_protocolo_.*\.pdf$/)
})

test('contador de anexos permanece dentro da coluna em largura intermediária', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'A largura intermediária é validada no projeto desktop.')
  await page.setViewportSize({ width: 820, height: 900 })
  await page.goto('/processos?tab=all')

  const card = page.locator('.process-card').filter({ hasText: 'Em tramitação' }).first()
  const reference = card.locator('.process-card-reference')
  const statusBadge = card.locator('.process-card-state > span').first()
  const attachmentBadge = card.getByTitle(/anexo/)
  await expect(card).toBeVisible()
  await expect(statusBadge).toBeVisible()
  await expect(attachmentBadge).toBeVisible()

  const [referenceBox, attachmentBox, paddingRight] = await Promise.all([
    reference.boundingBox(),
    attachmentBadge.boundingBox(),
    reference.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingRight)),
  ])
  expect(referenceBox).not.toBeNull()
  expect(attachmentBox).not.toBeNull()
  const statusSize = await statusBadge.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
  expect(statusSize.scrollWidth, JSON.stringify(statusSize)).toBeLessThanOrEqual(statusSize.clientWidth + 1)
  expect(attachmentBox!.x + attachmentBox!.width).toBeLessThanOrEqual(referenceBox!.x + referenceBox!.width - paddingRight + 1)
})
test('situação longa usa letreiro e a lista mostra tooltips completos', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'O overflow intermediário é validado no projeto desktop.')
  await page.setViewportSize({ width: 820, height: 900 })
  await page.goto('/processos?tab=all&pageSize=100')

  const card = page.locator('.process-card').filter({ hasText: 'Aguardando resposta da unidade' }).first()
  const badge = card.locator('.process-status-badge')
  const marquee = badge.locator('.overflow-marquee')
  await expect(card).toBeVisible()
  await expect(marquee).toHaveAttribute('data-overflow', 'true')
  expect(await marquee.locator('.overflow-marquee-track').evaluate((element) => getComputedStyle(element).animationName)).toBe('overflow-marquee')

  await badge.hover()
  const statusTooltip = page.getByRole('tooltip')
  await expect(statusTooltip).toHaveText('Aguardando resposta da unidade')
  expect(await statusTooltip.evaluate((element) => element.parentElement === document.body)).toBe(true)

  const description = card.locator('.process-card-description')
  const fullDescription = (await description.textContent())!.trim()
  await description.hover()
  await expect(page.getByRole('tooltip')).toHaveText(fullDescription)
})
test('lista exporta o comprovante do protocolo', async ({ page }) => {
  await page.goto('/processos?tab=all')
  const firstCard = page.locator('.process-card').first()
  await firstCard.getByRole('button', { name: /Imprimir processo/ }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menu').getByRole('menuitem', { name: 'Imprimir comprovante' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^comprovante_protocolo_.*\.pdf$/)
})
test('detalhe exporta os mesmos quatro PDFs da listagem', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Validação dos quatro downloads executada no projeto desktop.')
  await page.goto('/processos/pr-10')
  await expect(page.getByRole('heading', { name: 'Processo 2026.000010' })).toBeVisible()

  const actions = [
    ['Imprimir capa', /^capa_.*\.pdf$/],
    ['Imprimir comprovante', /^comprovante_protocolo_.*\.pdf$/],
    ['Imprimir etiqueta', /^etiqueta_.*\.pdf$/],
    ['Imprimir detalhamento', /^detalhamento_.*\.pdf$/],
  ] as const

  for (const [label, filename] of actions) {
    await page.getByRole('button', { name: 'Ações', exact: true }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(filename)
    if (label === 'Imprimir comprovante' || label === 'Imprimir detalhamento') {
      const downloadedPath = await download.path()
      expect(downloadedPath).not.toBeNull()
      const document = await PDFDocument.load(await readFile(downloadedPath!))
      expect(document.getTitle()).toBe(label === 'Imprimir comprovante'
        ? 'Comprovante de protocolo 2026.000010'
        : 'Detalhamento do processo 2026.000010')
    }
  }
})
test('comprovante da movimentação continua separado do comprovante do protocolo', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Validação do arquivo baixado executada no projeto desktop.')
  await page.goto('/processos/pr-10')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Comprovante', exact: true }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^comprovante_tramitacao_.*\.pdf$/)
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const receipt = await PDFDocument.load(await readFile(downloadedPath!))
  expect(receipt.getTitle()).toBe('Comprovante de tramitação 2026.000010')
})
test('processo concluído não permite edição', async ({ page }) => {
  await page.goto('/processos/pr-10')
  await page.getByRole('button', { name: 'Ações', exact: true }).click()

  const edit = page.getByRole('menuitem', { name: 'Editar', exact: true })
  await expect(edit).toBeDisabled()
  await expect(edit).toHaveAttribute('title', 'Processos concluídos ou arquivados não podem ser editados.')
})
test('processo concluído não exibe botão de dossiê', async ({ page }) => {
  await page.goto('/processos/pr-10')
  await expect(page.getByRole('button', { name: 'Dossiê' })).toHaveCount(0)
})
test('etiqueta usa uma página no formato 150 por 100 mm', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Validação do arquivo baixado executada no projeto desktop.')

  await page.goto('/processos?tab=all')
  const firstCard = page.locator('.process-card').first()
  await expect(firstCard).toBeVisible()
  await firstCard.getByRole('button', { name: /Imprimir processo/ }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Imprimir etiqueta' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^etiqueta_.*\.pdf$/)

  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const label = await PDFDocument.load(await readFile(downloadedPath!))
  expect(label.getPageCount()).toBe(1)
  expect(label.getPage(0).getWidth()).toBeCloseTo(425.2, 0)
  expect(label.getPage(0).getHeight()).toBeCloseTo(283, 0)
})

test('avança a fase configurada somente pela tramitação', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Regressão funcional coberta no projeto desktop.')
  await page.goto('/processos/pr-1')

  await expect(page.getByRole('heading', { name: 'Processo 2026.000001' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Avançar fase' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Tramitar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tramitar processo' })
  const phase = dialog.getByRole('combobox', { name: 'Fase *' })
  await expect(phase).toBeDisabled()
  await expect(phase).toContainText('Análise')
  await expect(dialog.getByText('Próxima etapa obrigatória do fluxo. A fase não pode ser alterada nesta tramitação.')).toBeVisible()
})
test('filtra destinatários pela unidade selecionada na tramitação', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
  })
  await page.goto('/processos/pr-6')
  await page.getByRole('button', { name: 'Tramitar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tramitar processo' })

  await dialog.getByRole('combobox', { name: 'Unidade organizacional de destino *' }).click()
  await page.getByRole('option', { name: 'Administração / Financeiro' }).click()
  await dialog.getByRole('combobox', { name: 'Destinatário' }).click()
  await expect(page.getByRole('option', { name: 'Rafael Reis' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Clara Nunes' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Bruno Lima' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Rafael Reis' }).click()

  await dialog.getByRole('combobox', { name: 'Unidade organizacional de destino *' }).click()
  await page.getByRole('option', { name: 'Gestão de Processos' }).click()
  await expect(dialog.getByRole('combobox', { name: 'Destinatário' })).toContainText('Enviar para fila sem responsável')
  await dialog.getByRole('combobox', { name: 'Destinatário' }).click()
  await expect(page.getByRole('option', { name: 'Clara Nunes' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Rafael Reis' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Bruno Lima' })).toHaveCount(0)
})

test('ciência exige confirmação e fica cinza após o registro', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-bruno')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
  })
  await page.goto('/processos/pr-19')
  await expect(page.getByRole('heading', { name: 'Processo 2026.000019' })).toBeVisible()

  const movementToggles = page.locator('button[aria-controls^="timeline-content-"]')
  const movementCount = await movementToggles.count()
  const checklistItem = page.getByRole('checkbox', { name: 'Registrar despacho ou resultado' })
  await expect(checklistItem).toBeDisabled()
  await expect(page.getByText('Dê ciência desta movimentação para preencher o checklist.')).toBeVisible()
  const acknowledge = page.getByRole('button', { name: 'Dar ciência da tramitação' })
  await expect(acknowledge).toBeVisible()
  await acknowledge.click()
  const confirmation = page.getByRole('dialog', { name: 'Confirmar visualização da tramitação?' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Confirmar ciência' }).click()

  const registered = page.getByRole('button', { name: 'Ciência registrada', exact: true })
  await expect(registered).toBeDisabled()
  await expect(registered).toHaveClass(/timeline-icon-action--done/)
  await expect(page.getByRole('button', { name: 'Devolver fase' })).toHaveCount(0)
  await expect(checklistItem).toBeEnabled()
  await checklistItem.click()
  await expect(checklistItem).toBeChecked()
  const checklistSection = checklistItem.locator('xpath=ancestor::section[1]')
  const checklistHeight = (await checklistSection.boundingBox())!.height
  const observationButton = page.getByRole('button', { name: 'Adicionar observação em Registrar despacho ou resultado' })
  await observationButton.click()
  const observationPopover = page.getByRole('dialog', { name: 'Informações do item Registrar despacho ou resultado' })
  await expect(observationPopover).toBeVisible()
  await observationButton.click()
  await expect(observationPopover).toHaveCount(0)
  await observationButton.click()
  await expect(observationPopover).toBeVisible()
  expect(await observationPopover.evaluate((element) => element.parentElement === document.body)).toBe(true)
  expect(await observationPopover.evaluate((element) => getComputedStyle(element).position)).toBe('fixed')
  expect(Math.abs((await checklistSection.boundingBox())!.height - checklistHeight)).toBeLessThan(1)
  await observationPopover.getByRole('textbox', { name: 'Observação' }).fill('Atividade conferida no andamento.')
  await observationPopover.getByRole('button', { name: 'Salvar e marcar', exact: true }).click()
  await expect(page.getByText('Atividade conferida no andamento.', { exact: true }).first()).toHaveText('Atividade conferida no andamento.')
  await expect(movementToggles).toHaveCount(movementCount)
})

test('abre os requisitos do checklist ao marcar e identifica data, anexo e observação', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Regressão funcional coberta no projeto desktop.')
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
    localStorage.setItem('fluxo-publico:scope-unit', 'u-adm')
  })
  await page.goto('/processos/pr-9')
  await expect(page.getByRole('heading', { name: 'Processo 2026.000009' })).toBeVisible()
  await page.getByRole('button', { name: 'Assumir e dar ciência' }).click()

  const checklistItem = page.getByRole('checkbox', { name: 'Registrar pesquisa de preços compatível com o objeto' })
  await expect(checklistItem).toBeEnabled()
  const row = checklistItem.locator('xpath=ancestor::div[1]')
  await expect(row.locator('svg[aria-label="Data obrigatória"]')).toBeVisible()
  await expect(row.locator('svg[aria-label="Anexo obrigatório"]')).toBeVisible()
  await expect(row.locator('svg[aria-label="Observação obrigatória"]')).toBeVisible()

  await checklistItem.click()
  const popover = page.getByRole('dialog', { name: 'Informações do item Registrar pesquisa de preços compatível com o objeto' })
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('button', { name: 'Salvar e marcar' })).toBeDisabled()
  await popover.locator('input[type="date"]').fill('2026-09-20')
  await popover.getByRole('textbox', { name: 'Observação obrigatória' }).fill('Pesquisa de preços conferida.')

  const chooserPromise = page.waitForEvent('filechooser')
  await popover.getByRole('button', { name: 'Selecionar arquivo' }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'pesquisa-precos.txt', mimeType: 'text/plain', buffer: Buffer.from('Pesquisa de preços registrada.') })
  await expect(popover.getByRole('button', { name: /arquivo\(s\) anexado\(s\)/ })).toBeVisible()
  await expect(popover.getByRole('button', { name: 'Salvar e marcar' })).toBeEnabled()
  await popover.getByRole('button', { name: 'Salvar e marcar' }).click()
  await expect(checklistItem).toBeChecked()
})
test('responsável abre a designação e o dossiê incorpora anexos PDF', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Validação integral de download executada no projeto desktop.')

  await page.goto('/processos/pr-1')
  await page.getByRole('button', { name: 'Abrir menu do perfil' }).click()
  await page.getByRole('button', { name: 'Trocar usuário' }).click()
  await page.getByRole('button', { name: /Trocar para Marina Duarte/ }).click()
  await expect(page.getByRole('heading', { name: 'Processo 2026.000001' })).toBeVisible()

  await page.getByRole('button', { name: 'Escolher outro responsável' }).click()
  await expect(page.getByRole('button', { name: 'Escolher outro responsável' })).not.toHaveClass(/timeline-icon-action--pulse/)
  const assignmentDialog = page.getByRole('dialog', { name: 'Designar responsável' })
  await expect(assignmentDialog).toBeVisible()
  const backdrop = await assignmentDialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(backdrop?.x).toBe(0)
  expect(backdrop?.y).toBe(0)
  expect(backdrop?.width).toBe(viewport.width)
  expect(backdrop?.height).toBe(viewport.height)
  await assignmentDialog.getByRole('button', { name: 'Cancelar' }).click()

  const movementToggles = page.locator('button[aria-controls^="timeline-content-"]')
  const movementCount = await movementToggles.count()
  const attachmentPdf = await PDFDocument.create()
  attachmentPdf.addPage([320, 180])
  const attachmentBytes = await attachmentPdf.save()
  const secondAttachmentPdf = await PDFDocument.create()
  secondAttachmentPdf.addPage([320, 180])
  secondAttachmentPdf.addPage([320, 180])
  const secondAttachmentBytes = await secondAttachmentPdf.save()
  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles([
    { name: 'anexo-integrado.pdf', mimeType: 'application/pdf', buffer: Buffer.from(attachmentBytes) },
    { name: 'anexo-com-duas-paginas.pdf', mimeType: 'application/pdf', buffer: Buffer.from(secondAttachmentBytes) },
  ])
  await expect(movementToggles).toHaveCount(movementCount)
  await expect(page.getByText('anexo-integrado.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText('anexo-com-duas-paginas.pdf', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Visualizar anexo anexo-integrado.pdf' }).click()
  const pdfViewer = page.getByRole('dialog', { name: 'anexo-integrado.pdf' })
  await expect(pdfViewer.getByTitle('Pré-visualização de anexo-integrado.pdf')).toBeVisible()
  await pdfViewer.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(pdfViewer).toBeHidden()
  const dossierButton = page.getByRole('button', { name: 'Dossiê' })
  await expect(dossierButton).toHaveCount(1)

  await dossierButton.click()
  const dialog = page.getByRole('dialog', { name: 'Gerar dossiê do processo?' })
  await expect(dialog).toContainText('anexos em PDF')
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Gerar dossiê' }).click()
  const download = await downloadPromise
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const dossier = await PDFDocument.load(await readFile(downloadedPath!))
  expect(dossier.getPageCount()).toBe(7)

  await expect(movementToggles).toHaveCount(movementCount)
  await expect(page.getByText(download.suggestedFilename(), { exact: true })).toBeVisible()

  await dossierButton.click()
  const secondDialog = page.getByRole('dialog', { name: 'Gerar dossiê do processo?' })
  const secondDownloadPromise = page.waitForEvent('download')
  await secondDialog.getByRole('button', { name: 'Gerar dossiê' }).click()
  const secondDownload = await secondDownloadPromise
  const secondDownloadedPath = await secondDownload.path()
  expect(secondDownloadedPath).not.toBeNull()
  const secondDossier = await PDFDocument.load(await readFile(secondDownloadedPath!))
  expect(secondDossier.getPageCount()).toBe(7)
  await expect(page.getByText(secondDownload.suggestedFilename(), { exact: true }).last()).toBeVisible()

  await page.getByRole('button', { name: /Auditoria/ }).click()
  await expect(page.getByText('Arquivo anexado', { exact: true })).toHaveCount(4)
  await page.getByRole('button', { name: /Anexos/ }).click()
  await expect(page.getByText(download.suggestedFilename(), { exact: true }).last()).toBeVisible()
})

test('resumo separa informações do processo e tramitação atual', async ({ page }) => {
  await page.goto('/processos/pr-1')
  await page.getByRole('button', { name: 'Resumo' }).click()

  const processInformation = page.getByRole('heading', { name: 'Informações do processo' })
  const currentSituation = page.getByRole('heading', { name: 'Tramitação atual' })
  await expect(processInformation).toBeVisible()
  await expect(currentSituation).toBeVisible()
  await expect(page.getByText('Tipo:', { exact: true })).toBeVisible()
  await expect(page.getByText('Tipo de processo', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Descrição da movimentação', { exact: true })).toBeVisible()
})



test('documentos da movimentação abrem diretamente o visualizador de PDF', async ({ page }) => {
  await page.goto('/processos/pr-1')

  const documentButton = page.getByRole('button', { name: 'Visualizar documento DOC-2026.000001' })
  await expect(documentButton).toBeVisible()
  await documentButton.click()

  const documentDialog = page.getByRole('dialog', { name: 'DOC-2026.000001.pdf' })
  await expect(documentDialog).toBeVisible()
  const viewer = documentDialog.getByTitle('Pré-visualização de DOC-2026.000001.pdf')
  await expect(viewer).toBeVisible({ timeout: 15_000 })
  const encoded = await viewer.evaluate(async (frame: HTMLIFrameElement) => {
    const bytes = new Uint8Array(await (await fetch(frame.src)).arrayBuffer())
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
  })
  expect((await PDFDocument.load(Buffer.from(encoded, 'base64'))).getPageCount()).toBeGreaterThan(0)
  await documentDialog.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(documentDialog).toBeHidden()

  const attachmentButton = page.getByRole('button', { name: 'Visualizar anexo comprovante-demo.txt' })
  await expect(attachmentButton).toBeVisible()
  await attachmentButton.click()

  const attachmentDialog = page.getByRole('dialog', { name: 'comprovante-demo.txt' })
  await expect(attachmentDialog).toBeVisible()
  await expect(attachmentDialog.getByText('Comprovante fictício disponível para visualização.', { exact: true })).toBeVisible()
})

test('documento formatado da movimentação mantém HTML renderizado na prévia PDF', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/documentos/novo?protocolId=pr-1&movementEventId=ev-open-1')
  await page.getByRole('combobox', { name: 'Tipo de documento *' }).click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  await page.getByLabel('Assunto *').fill('Documento formatado da movimentação')
  await page.getByRole('textbox', { name: 'Corpo do documento * visual' }).evaluate((element) => {
    element.innerHTML = '<p>Texto <strong>formatado</strong> com espaços preservados.</p>'
    element.dispatchEvent(new InputEvent('input', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Documento formatado da movimentação' })).toBeVisible()

  await page.goto('/processos/pr-1')
  const documentButton = page.getByRole('button', { name: /Visualizar documento DOC-/ }).filter({ hasText: 'Documento formatado da movimentação' })
  await expect(documentButton).toBeVisible()
  const number = (await documentButton.getAttribute('aria-label'))!.replace('Visualizar documento ', '')
  await documentButton.click()
  const dialog = page.getByRole('dialog', { name: `${number}.pdf` })
  await expect(dialog).toBeVisible()
  await expect(page.locator('article.document-page[aria-hidden="true"] strong')).toHaveText('formatado')
  const viewer = dialog.getByTitle(`Pré-visualização de ${number}.pdf`)
  await expect(viewer).toBeVisible({ timeout: 15_000 })
  const encoded = await viewer.evaluate(async (frame: HTMLIFrameElement) => {
    const bytes = new Uint8Array(await (await fetch(frame.src)).arrayBuffer())
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
  })
  expect((await PDFDocument.load(Buffer.from(encoded, 'base64'))).getPageCount()).toBeGreaterThan(0)
})


test('abas exibem contadores de anexos e documentos', async ({ page }) => {
  await page.goto('/processos/pr-1')

  const attachmentsTab = page.getByRole('button', { name: /Anexos/ })
  const documentsTab = page.getByRole('button', { name: /Documentos/ })

  await expect(attachmentsTab.locator('span')).toHaveText('1')
  await expect(documentsTab.locator('span')).toHaveText('1')
})
