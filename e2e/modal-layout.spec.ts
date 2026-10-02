import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 393 : 1440, height: 560 })
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

async function expectFixedChrome(dialog: Locator) {
  const layout = await dialog.evaluate(async (element) => {
    const panel = element.querySelector<HTMLElement>('.dialog-content')!
    await Promise.all(panel.getAnimations().map((animation) => animation.finished))
    const body = element.querySelector<HTMLElement>('.dialog-body')!
    const header = panel.querySelector<HTMLElement>('header')!
    const footer = panel.querySelector<HTMLElement>('.dialog-footer')!
    const before = { header: header.getBoundingClientRect().top, footer: footer.getBoundingClientRect().bottom }
    body.scrollTop = body.scrollHeight
    await new Promise(requestAnimationFrame)
    return {
      before,
      after: { header: header.getBoundingClientRect().top, footer: footer.getBoundingClientRect().bottom },
      scrollTop: body.scrollTop,
      panelScrollTop: panel.scrollTop,
      height: window.innerHeight,
      width: panel.getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
    }
  })
  expect(layout.scrollTop).toBeGreaterThan(0)
  expect(layout.panelScrollTop).toBe(0)
  expect(layout.after.header).toBeCloseTo(layout.before.header, 0)
  expect(layout.after.footer).toBeCloseTo(layout.before.footer, 0)
  expect(layout.after.header).toBeGreaterThanOrEqual(0)
  expect(layout.after.footer).toBeLessThanOrEqual(layout.height)
  expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth - 32)
  await expect(dialog.locator('.dialog-footer')).toBeInViewport()
}

test('mantém cabeçalho e rodapé visíveis nos formulários longos', async ({ page }) => {
  for (const item of [
    { path: '/perfis', button: 'Novo perfil', title: 'Novo perfil' },
    { path: '/tipos-processo', button: 'Novo', title: 'Novo tipo de processo' },
    { path: '/usuarios', button: 'Novo usuário', title: 'Novo usuário' },
  ]) {
    await page.goto(item.path)
    await page.getByRole('button', { name: item.button, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: item.title, exact: true })
    await expectFixedChrome(dialog)
    await dialog.locator('.dialog-footer').getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()
  }
})

test('rola apenas o conteúdo da etapa e mantém o rodapé das perguntas fixo', async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 420 })
  await page.goto('/tipos-processo')
  await page.getByRole('button', { name: /Configurar fluxo de Solicitação administrativa/ }).click()
  await page.getByRole('button', { name: 'Nova etapa' }).click()
  const stage = page.getByRole('dialog', { name: 'Nova etapa do fluxo' })
  await expectFixedChrome(stage)
  await stage.getByRole('switch', { name: 'Exige checklist' }).click()
  await stage.getByRole('button', { name: 'Nova pergunta' }).click()
  const question = page.getByRole('dialog', { name: 'Nova pergunta' })
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 320 })
  await expectFixedChrome(question)
  await question.getByLabel('Pergunta *').fill('Confirmar a documentação')
  await question.locator('.dialog-footer').getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(question).toBeHidden()
  await expect(stage.getByText('Confirmar a documentação')).toBeVisible()
})

test('mantém cabeçalho e rodapé dentro da tela com zoom aumentado', async ({ page }) => {
  await page.goto('/perfis')
  await page.evaluate(() => { document.body.style.zoom = '1.25' })
  await page.getByRole('button', { name: 'Novo perfil', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo perfil', exact: true })
  await expectFixedChrome(dialog)
  await dialog.getByRole('button', { name: 'Fechar diálogo' }).click()
  await expect(dialog).toBeHidden()
})
