import { expect, test } from '@playwright/test'
import { configureDemoSession } from './helpers/session'
import { demoText } from './helpers/demo'
configureDemoSession()

const documentStyle = async (page: import('@playwright/test').Page, selector: string) =>
  page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element)
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight }
  })

test('cada fonte da interface mantém os textos de processos no mínimo em peso médio', async ({ page }) => {
  await page.goto('/configuracoes')
  for (const font of ['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Sora']) {
    await page.getByRole('tab', { name: 'Aparência' }).click()
    await page.getByRole('button', { name: `${font} Aa Bb 123` }).click()
    await page.goto('/processos')
    await expect(page.locator('.process-card').first()).toBeVisible()
    for (const selector of ['.process-quick-filter small', '.process-card-description', '.process-card-movement dt']) {
      const weight = await page.locator(selector).first().evaluate((element) => Number(getComputedStyle(element).fontWeight))
      expect(weight, `${font}: ${selector}`).toBeGreaterThanOrEqual(500)
    }
    const faces = await page.evaluate((family) => [...document.fonts].filter((face) => {
      const weights = face.weight.split(' ').map(Number)
      return face.family === family && weights[0] <= 500 && (weights[1] ?? weights[0]) >= 500
    }).length, font)
    expect(faces, `${font} precisa de arquivo de peso médio`).toBeGreaterThan(0)
    await page.goto('/configuracoes')
  }
})

test('fonte e tamanho da interface preservam a tipografia do editor, do documento e da impressão', async ({ page }) => {
  await page.goto('/documentos')
  await page.getByRole('button', { name: await demoText(page, 'Visualizar DOC-2026.000008'), exact: true }).click()
  const documentBefore = await documentStyle(page, '.document-page')
  await page.goto('/documentos/novo')
  const editorBefore = await documentStyle(page, '.rich-editor-content')

  await page.goto('/configuracoes')
  await page.getByRole('tab', { name: 'Aparência' }).click()
  await page.getByRole('button', { name: 'Sora Aa Bb 123' }).click()
  await page.getByRole('button', { name: /Extra grande · Aumenta a leitura em 37,5%/ }).click()
  await page.goto('/documentos')
  await page.getByRole('button', { name: await demoText(page, 'Visualizar DOC-2026.000008'), exact: true }).click()
  expect(await documentStyle(page, '.document-page')).toEqual(documentBefore)
  await page.emulateMedia({ media: 'print' })
  expect(await documentStyle(page, '.document-page')).toEqual(documentBefore)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('16px')
  await page.emulateMedia({ media: 'screen' })
  await page.goto('/documentos/novo')
  expect(await documentStyle(page, '.rich-editor-content')).toEqual(editorBefore)
  expect(editorBefore).toEqual({ family: 'Arial, Helvetica, sans-serif', size: '15px', weight: '400' })
})
