import { expect, test } from '@playwright/test'

test('atualiza métricas e atalhos ao alternar unidade e Todos no dashboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'O seletor de contexto está disponível no cabeçalho desktop.')
  await page.addInitScript(() => {
    const prefix = 'fluxo-publico:tenant:prefeitura-saomateus-ma:'
    localStorage.setItem(`${prefix}user`, 'usr-admin')
    localStorage.setItem(`${prefix}unit`, 'u-prot')
    if (!localStorage.getItem(`${prefix}scope-unit`)) localStorage.setItem(`${prefix}scope-unit`, 'u-prot')
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Meus Processos', exact: true })).toBeVisible()
  const expected = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:database:v1')!)
    const active = db.protocols.filter((protocol: { status: string }) => ['CADASTRADO', 'EM_ANDAMENTO', 'REABERTO'].includes(protocol.status))
    const counts = (unit?: string) => {
      const protocols = active.filter((protocol: { currentUnitId: string }) => !unit || protocol.currentUnitId === unit)
      return {
        overdue: protocols.filter((protocol: { dueAt?: string }) => protocol.dueAt && Date.parse(protocol.dueAt) < Date.now()).length,
        soon: protocols.filter((protocol: { dueAt?: string }) => protocol.dueAt && Date.parse(protocol.dueAt) >= Date.now() && Date.parse(protocol.dueAt) < Date.now() + 86400000).length,
      }
    }
    return { local: counts('u-prot'), all: counts() }
  })
  expect(expected.all.overdue).toBeGreaterThan(expected.local.overdue)
  const overdue = page.getByRole('button', { name: /Prazo vencido/ }).locator('strong')
  const soon = page.getByRole('button', { name: /Vence em 24h/ }).locator('strong')
  await expect(overdue).toHaveText(String(expected.local.overdue).padStart(2, '0'))
  await expect(soon).toHaveText(String(expected.local.soon).padStart(2, '0'))
  for (const all of [true, false, true]) {
    await page.getByRole('button', { name: /^Selecionar contexto de estrutura/ }).click()
    await page.getByRole('dialog', { name: 'Contexto ativo' }).getByRole('button', { name: all ? /^Todos/ : 'Gestão de Processos Administrador geral', exact: !all }).click()
    const counts = all ? expected.all : expected.local
    await expect(overdue).toHaveText(String(counts.overdue).padStart(2, '0'))
    await expect(soon).toHaveText(String(counts.soon).padStart(2, '0'))
  }
  expect(await page.evaluate(() => localStorage.getItem('fluxo-publico:tenant:prefeitura-saomateus-ma:unit'))).toBe('u-prot')
  await page.getByRole('button', { name: /Prazo vencido/ }).click()
  await expect(page).toHaveURL(/\/processos\?tab=all&shortcut=overdue$/)
  await expect(page.locator('.process-card')).toHaveCount(expected.all.overdue)
  await page.goto('/dashboard')
  await expect(overdue).toHaveText(String(expected.all.overdue).padStart(2, '0'))
})
