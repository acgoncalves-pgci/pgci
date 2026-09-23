import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('cria um modelo, aplica no editor A4 e salva o documento formatado', async ({ page, isMobile }) => {
  await page.goto('/tipos-documento')
  const officeType = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Ofício', exact: true }) })
  await officeType.getByRole('button', { name: /Modelos/ }).click()

  const modelsDialog = page.getByRole('dialog', { name: 'Modelos — Ofício' })
  await modelsDialog.getByRole('button', { name: 'Novo modelo' }).click()
  const templateDialog = page.getByRole('dialog', { name: 'Novo modelo' })
  await templateDialog.getByLabel('Nome do modelo *').fill('Resposta de integração')
  await templateDialog.getByLabel('Assunto sugerido *').fill('Resposta para {{destinatario}}')
  const templateEditor = templateDialog.getByRole('textbox', { name: 'Editor do documento visual' })
  await templateEditor.fill('Prezado(a) {{destinatario}}, resposta emitida por {{unidade}}.')
  await templateDialog.getByRole('button', { name: 'Salvar modelo' }).click()
  await expect(templateDialog).toBeHidden()
  await expect(modelsDialog.getByText('Resposta de integração', { exact: true })).toBeVisible()
  await modelsDialog.getByRole('button', { name: 'Fechar', exact: true }).click()

  await page.goto('/documentos/novo')
  const type = page.getByRole('combobox', { name: 'Tipo de documento *' })
  await type.click()
  await page.getByRole('option', { name: 'Ofício', exact: true }).click()
  const recipient = page.getByRole('combobox', { name: 'Destinatário' })
  await recipient.click()
  await page.getByRole('option', { name: 'Ana Beatriz Costa', exact: true }).click()
  const model = page.getByRole('combobox', { name: 'Modelo do documento' })
  await model.click()
  await page.getByRole('option', { name: 'Resposta de integração', exact: true }).click()

  await expect(page.getByLabel('Assunto *')).toHaveValue('Resposta para Ana Beatriz Costa')
  const editor = page.getByRole('textbox', { name: 'Corpo do documento * visual' })
  await expect(editor).toContainText('Prezado(a) Ana Beatriz Costa, resposta emitida por Gestão de Processos.')
  await expect(page.getByRole('toolbar', { name: 'Formatação do documento' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Negrito' })).toBeVisible()
  if (!isMobile) {
    const pageBox = await page.locator('.a4-page').boundingBox()
    expect(pageBox).not.toBeNull()
    expect(pageBox!.width).toBeGreaterThan(780)
    expect(pageBox!.width).toBeLessThan(810)
  }

  await page.getByRole('button', { name: 'Salvar documento' }).click()
  await expect(page).toHaveURL(/\/documentos\//)
  await expect(page.getByRole('heading', { level: 1, name: 'Resposta para Ana Beatriz Costa' })).toBeVisible()
  await expect(page.locator('.document-page')).toContainText('Prezado(a) Ana Beatriz Costa, resposta emitida por Gestão de Processos.')
})
