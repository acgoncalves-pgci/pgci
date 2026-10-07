import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:unit', 'u-prot')
  })
})

test('exibe a hierarquia e administra uma unidade subordinada pela própria linha', async ({ page }) => {
  await page.goto('/estrutura')

  await expect(page.getByRole('heading', { name: 'Estrutura Organizacional' })).toBeVisible()
  const tree = page.getByRole('tree')
  await expect(tree).toBeVisible()
  await expect(tree.getByText('Financeiro', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Criar unidade subordinada a Administração' }).click()
  const createDialog = page.getByRole('dialog', { name: 'Nova unidade organizacional' })
  await expect(createDialog.getByRole('combobox', { name: 'Unidade superior' })).toBeDisabled()
  await expect(createDialog.getByRole('combobox', { name: 'Unidade superior' })).toContainText('Administração')
  await createDialog.getByLabel('Nome *').fill('Controle de Contratos')
  await createDialog.getByLabel('Sigla *').fill('CCON')
  await createDialog.getByRole('button', { name: 'Salvar' }).click()

  await expect(tree.getByText('Controle de Contratos', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar Controle de Contratos' })).toBeAttached()
  await page.getByRole('button', { name: 'Excluir Controle de Contratos' }).click()
  const deleteDialog = page.getByRole('dialog', { name: 'Excluir unidade organizacional' })
  await deleteDialog.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(tree.getByText('Controle de Contratos', { exact: true })).toHaveCount(0)
})

async function createBranch(page: Page) {
  await page.goto('/estrutura')
  await expect(page.getByRole('tree')).toBeVisible()
  const ids = await page.evaluate(async () => {
    const modulePath = '/src/services/api.ts'
    const { api } = await import(modulePath)
    const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const root = await api.createUnit(ctx, { name: 'Secretaria Alfa', abbreviation: 'ALFA', active: true })
    const child = await api.createUnit(ctx, { name: 'Departamento Alfa', abbreviation: 'DALFA', parentId: root.id, active: true })
    const grandchild = await api.createUnit(ctx, { name: 'Seção Alfa', abbreviation: 'SALFA', parentId: child.id, active: true })
    const target = await api.createUnit(ctx, { name: 'Secretaria Beta', abbreviation: 'BETA', active: true })
    return { root: root.id, child: child.id, grandchild: grandchild.id, target: target.id }
  })
  await page.reload()
  await expect(page.getByRole('treeitem', { name: 'Seção Alfa', exact: true })).toBeVisible()
  return ids
}

async function parentOf(page: Page, unitId: string) {
  return page.evaluate((id) => JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!).units.find((unit: { id: string }) => unit.id === id).parentId ?? null, unitId)
}

test('escolhe o pai, sobe apenas um nível e remove a subordinação preservando os filhos', async ({ page }, testInfo) => {
  const ids = await createBranch(page)
  await expect(page.getByRole('button', { name: 'Subir nível de Secretaria Alfa', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Subordinar Secretaria Alfa', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Subordinar Secretaria Alfa', exact: true })
  await dialog.getByRole('combobox', { name: 'Unidade superior' }).click()
  await expect(page.getByRole('option', { name: /Departamento Alfa|Seção Alfa/ })).toHaveCount(0)
  await page.getByRole('option', { name: 'Secretaria Beta', exact: true }).click()
  await dialog.getByRole('button', { name: 'Salvar subordinação' }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => parentOf(page, ids.root)).toBe(ids.target)
  await expect.poll(() => parentOf(page, ids.child)).toBe(ids.root)
  await page.getByRole('button', { name: 'Subir nível de Departamento Alfa', exact: true }).click()
  await expect.poll(() => parentOf(page, ids.child)).toBe(ids.target)
  await expect.poll(() => parentOf(page, ids.grandchild)).toBe(ids.child)
  await page.getByRole('button', { name: 'Subordinar Departamento Alfa', exact: true }).click()
  const detach = page.getByRole('dialog', { name: 'Subordinar Departamento Alfa', exact: true })
  await detach.getByRole('combobox', { name: 'Unidade superior' }).click()
  await page.getByRole('option', { name: 'Sem unidade superior (nível principal)', exact: true }).click()
  await detach.getByRole('button', { name: 'Salvar subordinação' }).click()
  await expect(detach).toBeHidden()
  await expect.poll(() => parentOf(page, ids.child)).toBeNull()
  await expect.poll(() => parentOf(page, ids.grandchild)).toBe(ids.child)
  await page.reload()
  await expect(page.getByRole('treeitem', { name: 'Departamento Alfa', exact: true }).getByRole('treeitem', { name: 'Seção Alfa', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('estrutura-hierarquia.png'), fullPage: true })
})

test('arrasta a unidade com seus filhos e impede soltá-la em uma descendente', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A operação por toque utiliza os botões da linha.')
  const ids = await createBranch(page)
  await page.getByRole('button', { name: 'Arrastar Secretaria Alfa', exact: true }).dragTo(page.locator(`[data-unit-id="${ids.target}"]`))
  await expect.poll(() => parentOf(page, ids.root)).toBe(ids.target)
  await expect.poll(() => parentOf(page, ids.child)).toBe(ids.root)
  await page.getByRole('button', { name: 'Arrastar Secretaria Beta', exact: true }).dragTo(page.locator(`[data-unit-id="${ids.grandchild}"]`))
  await expect.poll(() => parentOf(page, ids.target)).toBeNull()
  await expect(page.locator('.structure-tree-row--dragging')).toHaveCount(0)
  await page.reload()
  await expect.poll(() => parentOf(page, ids.root)).toBe(ids.target)
})

test('cria e edita a unidade com ícone e cor persistidos', async ({ page }, testInfo) => {
  await page.goto('/estrutura')
  await page.getByRole('button', { name: 'Nova unidade organizacional', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Nova unidade organizacional' })
  await create.getByLabel('Nome *').fill('Fiscalização')
  await create.getByLabel('Sigla *').fill('fisc')
  await create.getByLabel('Cor hexadecimal').fill('#7c3aed')
  await create.getByRole('combobox', { name: 'Ícone', exact: true }).click()
  await page.getByRole('option', { name: 'Scale', exact: true }).click()
  await create.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(create).toBeHidden()
  const row = page.getByRole('treeitem', { name: 'Fiscalização', exact: true })
  await expect(row.locator('.structure-tree-icon')).toHaveCSS('color', 'rgb(124, 58, 237)')
  await expect(row.locator('.lucide-scale')).toBeVisible()
  await row.getByRole('button', { name: 'Editar Fiscalização', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Editar unidade', exact: true })
  await expect(edit.getByLabel('Cor hexadecimal')).toHaveValue('#7C3AED')
  await edit.getByRole('combobox', { name: 'Ícone', exact: true }).click()
  await page.getByRole('option', { name: 'Network', exact: true }).click()
  await edit.getByLabel('Cor hexadecimal').fill('#047857')
  await page.screenshot({ path: testInfo.outputPath('unidade-aparencia.png'), fullPage: true })
  await edit.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(edit).toBeHidden()
  await page.reload()
  await expect(row.locator('.lucide-network')).toBeVisible()
  await expect(row.locator('.structure-tree-icon')).toHaveCSS('color', 'rgb(4, 120, 87)')
})
