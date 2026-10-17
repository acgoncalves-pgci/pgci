import { expect, test } from '@playwright/test'
import { configureDemoSession } from './helpers/session'

configureDemoSession()

test('mantém o formulário ao selecionar texto e soltar fora, mas fecha com um clique no fundo', async ({ page, isMobile }) => {
  await page.goto('/processos/pr-1')
  const checklist = page.getByRole('checkbox', { name: 'Conferir dados de abertura', exact: true })
  await checklist.click()
  await expect(checklist).toBeChecked()
  await page.getByRole('button', { name: 'Tramitar', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Tramitar processo', exact: true })
  const description = dialog.getByRole('textbox', { name: 'Descrição *', exact: true })
  const draft = 'Texto em preenchimento para conferir a seleção sem perder o formulário.'
  await description.fill(draft)
  const box = (await description.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(2, 2, { steps: 12 })
  await page.mouse.up()
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect(description).toHaveValue(draft)

  // Também não fecha se o gesto começar no fundo e terminar no formulário.
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await description.click()
  await expect(description).toHaveValue(draft)

  if (isMobile) await page.touchscreen.tap(2, 2)
  else await page.mouse.click(2, 2)
  await expect(dialog).toBeHidden()
})

test('clicar no fundo fecha apenas o modal superior e preserva o formulário abaixo', async ({ page, isMobile }) => {
  await page.goto('/processos/pr-1')
  const checklist = page.getByRole('checkbox', { name: 'Conferir dados de abertura', exact: true })
  await checklist.click()
  await expect(checklist).toBeChecked()
  await page.getByRole('button', { name: 'Tramitar', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Tramitar processo', exact: true })
  const description = dialog.getByRole('textbox', { name: 'Descrição *', exact: true })
  await description.fill('Encaminhar o processo para análise.')
  await dialog.getByRole('button', { name: 'Tramitar', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Registrar atividade?', exact: true })
  await expect(confirmation).toBeVisible()
  if (isMobile) await page.touchscreen.tap(2, 2)
  else await page.mouse.click(2, 2)
  await expect(confirmation).toBeHidden()
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect(description).toHaveValue('Encaminhar o processo para análise.')
  await dialog.getByRole('button', { name: 'Fechar diálogo', exact: true }).click()
  await expect(dialog).toBeHidden()
})
