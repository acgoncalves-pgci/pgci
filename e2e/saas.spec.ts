import { expect, test } from '@playwright/test'

const base = '/saomateusdomaranhao'
const primary = 'fluxo-publico:tenant:prefeitura-saomateus-ma:'

async function signIn(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Preencher acesso de demonstração' }).click()
  await page.getByRole('button', { name: 'Entrar no sistema' }).click()
  await expect(page.getByRole('heading', { name: 'Meus Processos' })).toBeVisible()
}

test('login e navegação mantêm o slug em rotas, recuperação e links profundos', async ({ page, isMobile }, testInfo) => {
  await page.goto(`${base}/`)
  await expect(page).toHaveURL(new RegExp(`${base}/$`))
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible()
  await expect(page.locator('.auth-organization')).toContainText('Prefeitura Municipal de São Mateus do Maranhão')
  await expect(page.getByRole('link', { name: 'Esqueceu sua senha?' })).toHaveAttribute('href', `${base}/esqueci-a-senha`)
  await page.getByRole('link', { name: 'Esqueceu sua senha?' }).click()
  await expect(page).toHaveURL(new RegExp(`${base}/esqueci-a-senha$`))
  await page.getByRole('link', { name: 'Voltar para o login' }).click()
  await page.goto(`${base}/documentos?origem=saas`)
  await expect(page).toHaveURL(new RegExp(`${base}/login$`))
  await page.getByRole('button', { name: 'Preencher acesso de demonstração' }).click()
  await page.getByRole('button', { name: 'Entrar no sistema' }).click()
  await expect(page).toHaveURL(new RegExp(`${base}/documentos\\?origem=saas$`))
  await expect(page.getByRole('heading', { name: 'Documentos', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Documentos', exact: true })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${base}/dashboard$`))
  await expect(page.getByRole('heading', { name: 'Meus Processos' })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  await page.getByRole('link', { name: 'Documentos', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${base}/documentos$`))
  await expect(page.getByRole('heading', { name: 'Documentos', exact: true })).toBeVisible()
  await page.goto(`${base}/login`)
  await expect(page.getByRole('button', { name: 'Entrar no sistema' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('saas-login.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('cada prefeitura mantém seu login, sessão, dados e arquivos separados', async ({ page }) => {
  await page.goto(`${base}/`)
  await signIn(page)
  await page.goto(`${base}/configuracoes`)
  await expect(page.getByLabel('Endereço de acesso')).toHaveValue(/\/saomateusdomaranhao\/$/)
  await expect(page.getByLabel('Endereço de acesso')).toHaveAttribute('readonly', '')
  await page.getByLabel('Nome da organização').fill('Prefeitura de São Mateus — Portal Institucional')
  await page.getByLabel('Cidade', { exact: true }).fill('Cidade renomeada')
  await page.getByRole('tab', { name: 'Login', exact: true }).click()
  await page.getByLabel('Título do login').fill('Bem-vindo ao portal de São Mateus')
  await page.getByLabel('Descrição do login').fill('Acesso exclusivo dos servidores de São Mateus.')
  await page.getByRole('switch', { name: 'Usar cores da prefeitura' }).click()
  await page.getByLabel('Cor principal do login').fill('#075e44')
  await page.getByLabel('Cor do painel do login').fill('#064e3b')
  await page.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Configurações gerais salvas' })).toBeVisible()
  await page.evaluate(async () => {
    const path = '/src/storage/database.ts'
    const storage = await import(path)
    const db = storage.loadDb()
    db.protocols[0].subject = 'Processo exclusivo de São Mateus'
    storage.saveDb(db)
    await storage.putBlob('mesma-chave', new Blob(['Arquivo de São Mateus']))
    const tenantsPath = '/src/saas/tenants.ts'
    const { registerTenant } = await import(tenantsPath)
    registerTenant({ id: 'prefeitura-axixa-ma', name: 'Prefeitura de Axixá', city: 'Axixá', state: 'MA', abbreviation: 'PMA' })
  })
  await page.goto('/axixa/')
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible()
  await expect(page.locator('.auth-organization')).toContainText('Prefeitura de Axixá')
  expect(await page.evaluate(() => localStorage.getItem('fluxo-publico:tenant:prefeitura-axixa-ma:user'))).toBeNull()
  await signIn(page)
  await page.goto('/axixa/processos/pr-1')
  await expect(page.getByText('Processo exclusivo de São Mateus', { exact: true })).toHaveCount(0)
  const before = await page.evaluate(async () => {
    const path = '/src/storage/database.ts'
    const { getBlob, putBlob } = await import(path)
    const blob = await getBlob('mesma-chave')
    await putBlob('mesma-chave', new Blob(['Arquivo de Axixá']))
    return blob ? await blob.text() : null
  })
  expect(before).toBeNull()
  await page.goto(`${base}/processos/pr-1`)
  await expect(page.getByText('Processo exclusivo de São Mateus', { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(async () => {
    const path = '/src/storage/database.ts'
    const { getBlob } = await import(path)
    return (await getBlob('mesma-chave'))?.text()
  })).toBe('Arquivo de São Mateus')
  await page.goto(`${base}/login`)
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao portal de São Mateus' })).toBeVisible()
  await expect(page.getByText('Acesso exclusivo dos servidores de São Mateus.')).toBeVisible()
  await expect(page.locator('.auth-submit')).toHaveCSS('background-color', 'rgb(7, 94, 68)')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao portal de São Mateus' })).toBeVisible()
  await page.goto('/axixa/login')
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible()
  expect(await page.evaluate((prefix) => localStorage.getItem(`${prefix}user`), primary)).toBe('usr-admin')
})

test('migra dados e anexos existentes sem apagar originais nem restaurar sessão após sair', async ({ page, isMobile }) => {
  await page.goto('/prefeitura-inexistente/')
  await expect(page.getByRole('heading', { name: 'Prefeitura não encontrada' })).toBeVisible()
  await page.evaluate(async () => {
    const path = '/src/mocks/seed.ts'
    const { seedDatabase } = await import(path)
    const db = seedDatabase()
    db.protocols[0].subject = 'Processo existente preservado'
    db.attachments[0].filename = 'arquivo-legado.txt'
    db.attachments[0].blobKey = 'arquivo-legado'
    localStorage.setItem('fluxo-publico:database:v1', JSON.stringify(db))
    localStorage.setItem('fluxo-publico:user', 'usr-admin')
    localStorage.setItem('fluxo-publico:settings-general', '{"organizationName":"Prefeitura já configurada"}')
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('fluxo-publico-blobs', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('blobs')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const tx = request.result.transaction('blobs', 'readwrite')
        tx.objectStore('blobs').put(new Blob(['Conteúdo anterior ao modo SaaS'], { type: 'text/plain' }), 'arquivo-legado')
        tx.oncomplete = () => { request.result.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  })
  await page.goto('/processos/pr-1?legado=1')
  await expect(page).toHaveURL(new RegExp(`${base}/processos/pr-1\\?legado=1$`))
  await expect(page.getByText('Processo existente preservado', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /^Anexos\b/ }).click()
  await page.getByRole('button', { name: 'Visualizar anexo arquivo-legado.txt' }).click()
  await expect(page.getByRole('dialog', { name: 'arquivo-legado.txt' })).toContainText('Conteúdo anterior ao modo SaaS')
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!).protocols[0].subject)).toBe('Processo existente preservado')
  if (isMobile) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${base}/login$`))
  await page.goto('/dashboard')
  await expect(page).toHaveURL(new RegExp(`${base}/login$`))
})

test('slug desconhecido não acessa dados de outra prefeitura nem cria cadastro automaticamente', async ({ page }) => {
  await page.goto(`${base}/`)
  await signIn(page)
  await page.goto('/prefeitura-desconhecida/documentos')
  await expect(page.getByRole('heading', { name: 'Prefeitura não encontrada' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Navegação principal' })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fluxo-publico:saas:tenants:v1')!).length)).toBe(1)
  await expect(page.getByText('Marina Duarte', { exact: true })).toHaveCount(0)
})
