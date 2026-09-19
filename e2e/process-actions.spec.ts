import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

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
  expect(download.suggestedFilename()).toMatch(/^comprovante_tramitacao_.*\.pdf$/)
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

test('ciência exige confirmação e fica cinza após o registro', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-bruno')
    localStorage.setItem('fluxo-publico:unit', 'u-adm')
  })
  await page.goto('/processos/pr-19')
  await expect(page.getByRole('heading', { name: 'Processo 2026.000019' })).toBeVisible()

  const movementToggles = page.locator('button[aria-controls^="timeline-content-"]')
  const movementCount = await movementToggles.count()
  const acknowledge = page.getByRole('button', { name: 'Dar ciência da tramitação' })
  await expect(acknowledge).toBeVisible()
  await acknowledge.click()
  const confirmation = page.getByRole('dialog', { name: 'Confirmar visualização da tramitação?' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Confirmar ciência' }).click()

  const registered = page.getByRole('button', { name: 'Ciência registrada', exact: true })
  await expect(registered).toBeDisabled()
  await expect(registered).toHaveClass(/timeline-icon-action--done/)
  await expect(movementToggles).toHaveCount(movementCount)
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
  await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
    name: 'anexo-integrado.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(attachmentBytes),
  })
  await expect(movementToggles).toHaveCount(movementCount)
  await expect(page.getByText('anexo-integrado.pdf', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dossiê' }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Dossiê' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Gerar dossiê do processo?' })
  await expect(dialog).toContainText('anexos em PDF')
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Gerar dossiê' }).click()
  const download = await downloadPromise
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const dossier = await PDFDocument.load(await readFile(downloadedPath!))
  expect(dossier.getPageCount()).toBeGreaterThanOrEqual(3)

  await expect(movementToggles).toHaveCount(movementCount)
  await expect(page.getByText(download.suggestedFilename(), { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Auditoria/ }).click()
  await expect(page.getByText('Arquivo anexado', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: /Anexos/ }).click()
  await expect(page.getByText(download.suggestedFilename(), { exact: true })).toBeVisible()
})

test('resumo separa informações do processo e situação atual', async ({ page }) => {
  await page.goto('/processos/pr-1')
  await page.getByRole('button', { name: 'Resumo' }).click()

  const processInformation = page.getByRole('heading', { name: 'Informações do processo' })
  const currentSituation = page.getByRole('heading', { name: 'Situação atual' })
  await expect(processInformation).toBeVisible()
  await expect(currentSituation).toBeVisible()
  await expect(page.getByText('Tipo de processo', { exact: true })).toBeVisible()
  await expect(page.getByText('Descrição da movimentação', { exact: true })).toBeVisible()
})



test('documentos e anexos da movimentação abrem prévia ao clicar', async ({ page }) => {
  await page.goto('/processos/pr-1')

  const documentButton = page.getByRole('button', { name: 'Visualizar documento DOC-2026.000001' })
  await expect(documentButton).toBeVisible()
  await documentButton.click()

  const documentDialog = page.getByRole('dialog', { name: 'Visualizar documento — DOC-2026.000001' })
  await expect(documentDialog).toBeVisible()
  await expect(documentDialog.getByText('Resposta preliminar', { exact: true })).toBeVisible()
  await expect(documentDialog.getByText(/Documento de demonstração do Fluxo Público/)).toBeVisible()
  await documentDialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(documentDialog).toBeHidden()

  const attachmentButton = page.getByRole('button', { name: 'Visualizar anexo comprovante-demo.txt' })
  await expect(attachmentButton).toBeVisible()
  await attachmentButton.click()

  const attachmentDialog = page.getByRole('dialog', { name: 'comprovante-demo.txt' })
  await expect(attachmentDialog).toBeVisible()
  await expect(attachmentDialog.getByText('Comprovante fictício disponível para visualização.', { exact: true })).toBeVisible()
})


test('abas exibem contadores de anexos e documentos', async ({ page }) => {
  await page.goto('/processos/pr-1')

  const attachmentsTab = page.getByRole('button', { name: /Anexos/ })
  const documentsTab = page.getByRole('button', { name: /Documentos/ })

  await expect(attachmentsTab.locator('span')).toHaveText('1')
  await expect(documentsTab.locator('span')).toHaveText('1')
})
