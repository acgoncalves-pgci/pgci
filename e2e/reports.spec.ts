import { test, expect } from '@playwright/test';
import { downloadPreview } from './helpers/pdf';
import { configureDemoSession } from './helpers/session';
configureDemoSession();

test('select permanece alinhado ao elemento âncora com zoom reduzido', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:appearance', JSON.stringify({ zoom: 80 }));
  });
  await page.goto('/relatorios');

  const trigger = page.getByRole('combobox', { name: 'Tipo' });
  await trigger.click();
  const content = page.locator('.ui-select-content');
  await expect(content).toBeVisible();

  const anchorRect = await trigger.boundingBox();
  const menuRect = await content.boundingBox();
  if (!anchorRect || !menuRect) throw new Error('Select não encontrado.');
  const alignment = {
    leftDelta: Math.abs(menuRect.x - anchorRect.x),
    verticalGap: menuRect.y - (anchorRect.y + anchorRect.height),
    widthDelta: Math.abs(menuRect.width - anchorRect.width),
  };

  expect(alignment.leftDelta).toBeLessThanOrEqual(1);
  expect(alignment.verticalGap).toBeGreaterThanOrEqual(0);
  expect(alignment.verticalGap).toBeLessThanOrEqual(5);
  expect(alignment.widthDelta).toBeLessThanOrEqual(1);
});

test('relatórios exibem filtros em abas e geram os três PDFs', async ({ page }, testInfo) => {
  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByLabel('Agrupar por')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('relatorios-claro.png'), fullPage: true });
  await page.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
  const list = await downloadPreview(page);
  expect(list.suggestedFilename()).toBe('relatorio_processos.pdf');
  await list.saveAs(testInfo.outputPath('processos.pdf'));
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar diálogo' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const number = await page.evaluate(() => JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!).protocols[0].number as string);
  await page.getByRole('tab', { name: 'Relatório Individual', exact: true }).click();
  await expect(page.getByLabel('Agrupar por')).toHaveCount(0);
  await page.getByLabel('Número do processo').fill(number);
  await page.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
  const cover = await downloadPreview(page);
  expect(cover.suggestedFilename()).toBe(`capa_${number}.pdf`);
  await cover.saveAs(testInfo.outputPath('capa.pdf'));
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar diálogo' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('tab', { name: 'Relatório de Produtividade', exact: true }).click();
  await page.getByLabel('Servidor', { exact: true }).click();
  await page.getByRole('option').nth(1).click();
  await page.getByLabel('Dificuldades ou impedimentos encontrados').fill('Sem impedimentos.');
  await page.getByRole('button', { name: 'Gerar PDF', exact: true }).click();
  const productivity = await downloadPreview(page);
  expect(productivity.suggestedFilename()).toBe('relatorio_produtividade.pdf');
  await productivity.saveAs(testInfo.outputPath('produtividade.pdf'));
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar diálogo' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('relatorios-escuro.png'), fullPage: true });
});

test('sidebar recolhe imediatamente após selecionar e reabre ao retornar o ponteiro', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Sidebar compacta é um controle desktop.');
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Minimizar sidebar' }).click();
  const sidebar = page.locator('aside').first();
  const main = page.locator('#main-content');
  await main.hover({ position: { x: 500, y: 300 } });
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(72);
  const collapsedMainX = (await main.boundingBox())!.x;
  await sidebar.hover();
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(240);
  await expect.poll(async () => (await main.boundingBox())!.x).toBeGreaterThan(collapsedMainX + 150);
  await sidebar.getByRole('link', { name: 'Relatórios', exact: true }).click();
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(72);
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Relatórios', exact: true }).hover();
  await sidebar.hover();
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(240);
  await sidebar.getByRole('link', { name: 'Relatórios', exact: true }).click();
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(72);
});

test('configuração persiste a logo e o endereço de consulta e gera capa pela ação do processo', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('fluxo-publico:user', 'usr-admin');
    localStorage.setItem('fluxo-publico:unit', 'u-prot');
  });
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('public/assets/pgci-logo.svg');
  await expect(page.getByRole('img', { name: 'Logo da entidade' })).toBeVisible();
  await page.getByRole('tab', { name: 'Portal', exact: true }).click();
  await page.getByLabel('Endereço público').fill('https://portal.entidade.gov.br/consulta');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Logo da entidade' })).toBeVisible();
  await page.getByRole('tab', { name: 'Portal', exact: true }).click();
  await expect(page.getByLabel('Endereço público')).toHaveValue('https://portal.entidade.gov.br/consulta');
  await page.goto('/processos/pr-1');
  await page.getByRole('button', { name: 'Ações', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Imprimir capa', exact: true }).click();
  await (await downloadPreview(page)).saveAs(testInfo.outputPath('capa-timbrada.pdf'));
});

test('capa preserva os dados e continua o histórico extenso em páginas A4', async ({ page }, testInfo) => {
  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();
  const pdf = await page.evaluate(async () => {
    const db = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!);
    const protocol = db.protocols[0];
    protocol.subject = 'atualização cadastral com descrição de assunto extensa para conferir quebra de linha e preservação integral até o fim do assunto';
    protocol.description = ('Informação complementar extensa para verificar a paginação e a preservação dos dados. '.repeat(3) + '\n').repeat(5) + 'FIM DAS INFORMAÇÕES COMPLEMENTARES';
    db.events = Array.from({ length: 45 }, (_, index) => ({ ...db.events[0], id: `stress-${index}`, protocolId: protocol.id, message: `Movimentação ${index + 1}: ` + 'Descrição detalhada da atividade realizada pelo servidor responsável. '.repeat(7), createdAt: new Date(Date.UTC(2026, 8, 1, 12, index)).toISOString() }));
    db.events[44].message += ' FIM DAS MOVIMENTAÇÕES';
    db.events.reverse();
    const modulePath = '/src/features/relatorios/reportPdf.ts';
    const { createCoverPdf } = await import(modulePath);
    const doc = await createCoverPdf(db, protocol);
    return { pages: doc.getNumberOfPages(), base64: doc.output('datauristring').split(',')[1] };
  });
  expect(pdf.pages).toBeGreaterThan(1);
  const { PDFDocument } = await import('pdf-lib');
  const document = await PDFDocument.load(Buffer.from(pdf.base64, 'base64'));
  for (const sheet of document.getPages()) {
    expect(sheet.getWidth()).toBeCloseTo(595.28, 1);
    expect(sheet.getHeight()).toBeCloseTo(841.89, 1);
  }
  const { writeFile } = await import('node:fs/promises');
  await writeFile(testInfo.outputPath('capa-extensa.pdf'), Buffer.from(pdf.base64, 'base64'));
});

test('capa apresenta campos opcionais e ausência de movimentações sem alterar o cadastro', async ({ page }, testInfo) => {
  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();
  const pdf = await page.evaluate(async () => {
    const db = JSON.parse(localStorage.getItem('fluxo-publico:database:v1')!);
    const protocol = db.protocols[0];
    protocol.subject = 'análise de documentação';
    for (const field of ['contractNumber', 'biddingNumber', 'legalProcessNumber', 'referenceNumber']) {
      protocol.typeConfigSnapshot[field] = { enabled: true, required: false };
      protocol[field] = 'referência jurídica abc-2026';
    }
    db.events = db.events.filter((event: { protocolId: string }) => event.protocolId !== protocol.id);
    const modulePath = '/src/features/relatorios/reportPdf.ts';
    const { createCoverPdf } = await import(modulePath);
    const doc = await createCoverPdf(db, protocol);
    return { pages: doc.getNumberOfPages(), subject: protocol.subject, base64: doc.output('datauristring').split(',')[1] };
  });
  expect(pdf.pages).toBe(1);
  expect(pdf.subject).toBe('análise de documentação');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(testInfo.outputPath('capa-sem-movimentos.pdf'), Buffer.from(pdf.base64, 'base64'));
});
