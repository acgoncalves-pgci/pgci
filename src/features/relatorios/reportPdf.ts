import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { Attachment, Database, Protocol, ProtocolEvent } from '../../domain/model';
import { eventLabel, statusLabel } from '../../domain/model';
import { dateTime, money } from '../../lib/format';
import { readInstitutionSettings } from '../../lib/institution';
import type { InstitutionSettings } from '../../lib/institution';
import { consultationUrl } from './reportData';
import { api } from '../../services/api';

const unitName = (db: Database, id?: string) => db.units.find((u) => u.id === id)?.name ?? 'Não informado';
const userName = (db: Database, id?: string) => db.users.find((u) => u.id === id)?.name ?? 'Não designado';
let fonts: Promise<string[]> | undefined;
function loadFonts() {
  return fonts ??= Promise.all(['Regular', 'Bold'].map(async (weight) => {
    const response = await fetch(`/fonts/Roboto-${weight}.ttf`);
    if (!response.ok) throw new Error('Não foi possível carregar a fonte do PDF. Tente novamente.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  })).catch((error) => { fonts = undefined; throw error; });
}
async function newPdf(format: 'a4' | [number, number] = 'a4', orientation: 'portrait' | 'landscape' = 'portrait') {
  const doc = new jsPDF({ format, orientation, unit: 'mm', compress: true });
  const [regular, bold] = await loadFonts();
  doc.addFileToVFS('Roboto-Regular.ttf', regular);
  doc.addFileToVFS('Roboto-Bold.ttf', bold);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto');
  doc.setTextColor(20);
  return doc;
}
async function timbre(doc: jsPDF, db: Database, settings: InstitutionSettings) {
  if (settings.logoDataUrl) {
    const properties = doc.getImageProperties(settings.logoDataUrl);
    const ratio = properties.width / properties.height;
    const height = Math.min(18, 28 / ratio);
    const width = height * ratio;
    doc.addImage(settings.logoDataUrl, 'PNG', (210 - width) / 2, 12, width, height);
  }
  const name = settings.organizationName || db.organization.name;
  autoTable(doc, { startY: 32, theme: 'plain', head: [[settings.shortName || name]],
    body: [[name], ...(settings.cnpj ? [[`CNPJ ${settings.cnpj}`]] : [])],
    styles: { font: 'Roboto', fontSize: 8, halign: 'center', textColor: 20, cellPadding: 0.8, lineWidth: 0 },
    headStyles: { fontStyle: 'bold', fontSize: 11, fillColor: [255, 255, 255], textColor: 20 },
    margin: { left: 21, right: 21, top: 20, bottom: 42 } });
  return Math.max(53, tableEnd(doc) + 9);
}

const tableStyles = { font: 'Roboto', fontSize: 8, textColor: 20, cellPadding: 2.5, lineColor: 185, lineWidth: 0.2 };
const tableEnd = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
function table(doc: jsPDF, head: string[], body: string[][], startY: number) {
  autoTable(doc, { head: [head], body, startY, theme: 'grid', styles: tableStyles,
    bodyStyles: head.length === 1 ? { halign: 'center' } : {},
    headStyles: { fillColor: [239, 239, 239], textColor: 20, fontStyle: 'bold', halign: 'center' },
    margin: { left: 21, right: 21, top: 20, bottom: 42 }, rowPageBreak: 'avoid' });
}
function paragraph(doc: jsPDF, title: string, content: string, startY: number) {
  autoTable(doc, { head: [[title]], body: content ? [[content]] : [], startY, theme: 'plain',
    styles: { ...tableStyles, halign: 'center', cellPadding: 3, lineWidth: 0 },
    headStyles: { fontStyle: 'bold', fontSize: 10, halign: 'center', textColor: 20, fillColor: [255, 255, 255] },
    margin: { left: 21, right: 21, top: 20, bottom: 42 } });
}
async function footer(doc: jsPDF, settings: InstitutionSettings, protocol?: Protocol) {
  const publicAccess = Boolean(settings.publicUrl?.trim() && settings.publicConsultation !== false);
  const url = protocol ? consultationUrl(protocol, settings.publicUrl ?? '', settings.publicConsultation !== false, window.location.origin) : undefined;
  const qr = url ? await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 240 }) : undefined;
  let barcode: string | undefined;
  if (protocol) {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, protocol.number, { format: 'CODE128', displayValue: false, height: 36, margin: 0 });
    barcode = canvas.toDataURL('image/png');
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(200).setLineWidth(0.2).line(11, 260, 199, 260);
    if (qr && url) {
      doc.addImage(qr, 'PNG', 10, 264, 20, 20);
      doc.setFont('Roboto', 'bold').setFontSize(8);
      doc.text(publicAccess ? 'Consulte o processo no portal da entidade' : 'Consulte o processo no sistema', 33, 268);
      doc.setFont('Roboto', 'normal').setFontSize(6.5);
      doc.text(doc.splitTextToSize(publicAccess
        ? 'Escaneie o QR code para consultar pelo número do processo no endereço configurado.'
        : 'Escaneie o QR code e entre no sistema com seu usuário para consultar este processo.', 110), 33, 273);
      doc.text(doc.splitTextToSize(url, 110).slice(0, 2), 33, 280);
    }
    if (barcode && protocol) {
      doc.addImage(barcode, 'PNG', 149, 269, 50, 10);
      doc.setFontSize(6).text(protocol.number, 174, 283, { align: 'center' });
    }
    doc.setFont('Roboto', 'normal').setFontSize(6.5);
    const contact = [settings.address, [settings.city, settings.state].filter(Boolean).join(' - '), settings.phone, settings.email].filter(Boolean).join(' · ');
    if (contact) doc.text(doc.splitTextToSize(contact, 170).slice(0, 2), 11, 290);
    doc.text(`${page}/${pages}`, 199, 292, { align: 'right' });
  }
}
export async function createCoverPdf(db: Database, protocol: Protocol) {
  const settings = readInstitutionSettings();
  const doc = await newPdf();
  const type = db.protocolTypes.find((item) => item.id === protocol.typeId)?.name ?? 'Não informado';
  const interested = db.people.find((person) => person.id === protocol.interestedPersonId)?.name ?? 'Não informado';
  const responsible = userName(db, protocol.currentAssigneeId);
  const sector = unitName(db, protocol.currentUnitId);
  const organization = settings.shortName || settings.organizationName || db.organization.name;
  const consultation = consultationUrl(protocol, settings.publicUrl ?? '', settings.publicConsultation !== false, window.location.origin);
  const qr = await QRCode.toDataURL(consultation, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, protocol.number, { format: 'CODE128', displayValue: false, height: 36, margin: 0 });
  const barcode = barcodeCanvas.toDataURL('image/png');
  const coverValue = (value: string) => doc.splitTextToSize(value, 111)[0] ?? value;

  doc.setProperties({ title: `Capa do processo ${protocol.number}` });
  const startY = await timbre(doc, db, settings);
  autoTable(doc, {
    startY,
    theme: 'grid',
    head: [['CAPA DO PROCESSO']],
    body: [[`Número do protocolo: ${protocol.number}`]],
    styles: { ...tableStyles, halign: 'center', cellPadding: 2.5 },
    headStyles: { fillColor: [238, 238, 238], textColor: 20, fontStyle: 'bold', fontSize: 10 },
    margin: { left: 21, right: 21 },
  });
  autoTable(doc, {
    startY: tableEnd(doc),
    theme: 'grid',
    styles: { ...tableStyles, cellPadding: 2.3 },
    body: [
      ['Data/Hora:', dateTime(protocol.createdAt)],
      ['Tipo:', coverValue(type)],
      ['Assunto:', coverValue(protocol.subject)],
      ...(protocol.typeConfigSnapshot.interested.enabled ? [['Interessado:', coverValue(interested)]] : []),
      ['Responsável:', coverValue(responsible)],
      ['Setor:', coverValue(sector)],
      ...(protocol.typeConfigSnapshot.creditor.enabled ? [['Credor:', coverValue(db.people.find((p) => p.id === protocol.creditorPersonId)?.name ?? 'Não informado')]] : []),
      ...(protocol.typeConfigSnapshot.amount.enabled ? [['Valor(R$):', coverValue(money(protocol.amountCents))]] : []),
      ...(protocol.typeConfigSnapshot.contractNumber?.enabled ? [['Número de contrato:', coverValue(protocol.contractNumber ?? 'Não informado')]] : []),
      ...(protocol.typeConfigSnapshot.biddingNumber?.enabled ? [['Número de licitação:', coverValue(protocol.biddingNumber ?? 'Não informado')]] : []),
      ...(protocol.typeConfigSnapshot.legalProcessNumber?.enabled ? [['Número de processo jurídico:', coverValue(protocol.legalProcessNumber ?? 'Não informado')]] : []),
      ...(protocol.typeConfigSnapshot.referenceNumber?.enabled ? [['Número:', coverValue(protocol.referenceNumber ?? 'Não informado')]] : []),
    ],
    columnStyles: { 0: { cellWidth: 53, halign: 'right', fontStyle: 'bold' } },
    margin: { left: 21, right: 21 },
    rowPageBreak: 'avoid',
  });

  const dividerY = 247;
  let y = tableEnd(doc) + 9;
  doc.setFont('Roboto', 'bold').setFontSize(10).setTextColor(20);
  doc.text('Descrição do protocolo', 105, y, { align: 'center' });
  y += 7;
  doc.setFont('Roboto', 'normal').setFontSize(8);
  const availableDescriptionLines = Math.max(1, Math.min(6, Math.floor((dividerY - 69 - y) / 3.7)));
  const description = doc.splitTextToSize(protocol.description || 'Não informado', 174).slice(0, availableDescriptionLines);
  doc.text(description, 105, y, { align: 'center' });
  y += Math.max(4, description.length * 3.7) + 8;

  doc.setFont('Roboto', 'bold').setFontSize(10);
  doc.text('Consulte o andamento do seu protocolo no nosso site', 105, y, { align: 'center' });
  y += 6;
  doc.setFont('Roboto', 'normal').setFontSize(7.2);
  const accessInstructions = doc.splitTextToSize('1 - Para acessar a tramitação, informe o CPF/CNPJ do interessado e o número do protocolo acima na tela de consulta.', 184);
  doc.text(accessInstructions, 13, y);
  y += accessInstructions.length * 3.5 + 2;
  const qrInstructions = doc.splitTextToSize('2 - O QR Code desta capa também pode ser usado para acompanhar o andamento do protocolo.', 184);
  doc.text(qrInstructions, 13, y);
  y += qrInstructions.length * 3.5 + 3;

  const qrY = Math.min(y, dividerY - 39);
  doc.addImage(qr, 'PNG', 93, qrY, 24, 24);
  doc.addImage(barcode, 'PNG', 82, qrY + 25, 46, 8);
  doc.setFontSize(6.5).text(protocol.number, 105, qrY + 36, { align: 'center' });

  doc.setDrawColor(130).setLineWidth(0.2).setLineDashPattern([1.2, 1.2], 0).line(10, dividerY, 200, dividerY);
  doc.setLineDashPattern([], 0);
  doc.setFont('Roboto', 'bold').setFontSize(8);
  doc.text(`PROTOCOLO: ${protocol.number} - ${organization}`, 105, dividerY + 6, { align: 'center' });
  doc.addImage(qr, 'PNG', 11, dividerY + 10, 22, 22);
  doc.setFont('Roboto', 'normal').setFontSize(6.7);
  const stubDescription = doc.splitTextToSize(protocol.description || protocol.subject, 88)[0];
  const stubRows = [
    `Interessado: ${interested}`,
    `Responsável: ${responsible}`,
    ...(protocol.typeConfigSnapshot.amount.enabled ? [`Valor: ${money(protocol.amountCents)}`] : []),
    `Setor: ${sector}`,
    `Descrição: ${stubDescription}`,
  ];
  stubRows.forEach((row, index) => doc.text(row, 37, dividerY + 13 + index * 4));
  doc.text(dateTime(protocol.createdAt), 198, dividerY + 13, { align: 'right' });
  doc.addImage(barcode, 'PNG', 148, dividerY + 17, 50, 9);
  doc.setFontSize(6).text(protocol.number, 173, dividerY + 31, { align: 'center' });
  return doc;
}
export async function downloadCover(db: Database, protocol: Protocol) {
  const doc = await createCoverPdf(db, protocol);
  doc.save(`capa_${protocol.number}.pdf`);
}
export async function downloadList(db: Database, protocols: Protocol[], grouping: string, summary: boolean, period: string) {
  const settings = readInstitutionSettings();
  const doc = await newPdf();
  const startY = await timbre(doc, db, settings);
  paragraph(doc, summary ? 'Resumo de Processos' : 'Relatório de Processos', `${period}\nTotal: ${protocols.length} processo(s)`, startY);
  const groupLabel = (p: Protocol) => grouping === 'type' ? db.protocolTypes.find((t) => t.id === p.typeId)?.name ?? 'Sem tipo' : grouping === 'status' ? statusLabel[p.status] : grouping === 'unit' ? unitName(db, p.currentUnitId) : 'Processos';
  const groups = new Map<string, Protocol[]>();
  for (const p of protocols) { const label = groupLabel(p); groups.set(label, [...(groups.get(label) ?? []), p]); }
  for (const [label, items] of groups) {
    if (grouping) paragraph(doc, `${label} (${items.length})`, '', tableEnd(doc) + 4);
    if (summary) {
      table(doc, ['Situação', 'Quantidade'], Object.entries(statusLabel).map(([key, value]) => [value, String(items.filter((p) => p.status === key).length)]), tableEnd(doc) + 3);
    } else {
      table(doc, ['Número', 'Tipo / Assunto', 'Interessado', 'Unidade', 'Situação', 'Abertura'], items.map((p) => [p.number, `${db.protocolTypes.find((t) => t.id === p.typeId)?.name ?? ''}\n${p.subject}`, db.people.find((person) => person.id === p.interestedPersonId)?.name ?? 'Não informado', unitName(db, p.currentUnitId), statusLabel[p.status], dateTime(p.createdAt)]), tableEnd(doc) + 3);
    }
  }
  await footer(doc, settings);
  doc.save('relatorio_processos.pdf');
}
export async function downloadProductivity(db: Database, protocols: Protocol[], serverId: string, superiorId: string, from: string, to: string, difficulties: string, suggestions: string) {
  const { inPeriod } = await import('./reportData');
  const settings = readInstitutionSettings();
  const doc = await newPdf();
  const startY = await timbre(doc, db, settings);
  const visibleIds = new Set(protocols.map((p) => p.id));
  const events = db.events.filter((e) => visibleIds.has(e.protocolId) && e.actorUserId === serverId && inPeriod(e.createdAt, from, to)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  paragraph(doc, 'Relatório de Produtividade', `Servidor: ${userName(db, serverId)}\nSuperior imediato: ${superiorId ? userName(db, superiorId) : 'Não informado'}\nPeríodo: ${from || 'Início'} a ${to || 'Hoje'}\n${events.length} atividade(s) em ${new Set(events.map((e) => e.protocolId)).size} processo(s)`, startY);
  table(doc, ['Data', 'Processo', 'Atividade', 'Descrição / Resultado'], events.length ? events.map((e) => [dateTime(e.createdAt), protocols.find((p) => p.id === e.protocolId)!.number, e.activity?.trim() || eventLabel[e.kind], [e.result?.trim(), e.message?.trim()].filter(Boolean).join('\n') || eventLabel[e.kind]]) : [['', '', 'Nenhuma atividade no período', '']], tableEnd(doc) + 3);
  paragraph(doc, 'Dificuldades ou impedimentos encontrados', difficulties, tableEnd(doc) + 5);
  paragraph(doc, 'Sugestões para melhoria do desempenho e produtividade setorial', suggestions, tableEnd(doc) + 3);
  await footer(doc, settings);
  doc.save('relatorio_produtividade.pdf');
}


const processEvents = (db: Database, protocol: Protocol) => db.events
  .filter((event) => event.protocolId === protocol.id)
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const latestMovement = (db: Database, protocol: Protocol) => processEvents(db, protocol)
  .filter((event) => ['TRAMITACAO', 'REABERTURA', 'ABERTURA'].includes(event.kind))
  .at(-1);

const movementNumber = (db: Database, protocol: Protocol, event: ProtocolEvent) =>
  processEvents(db, protocol).filter((item) => ['ABERTURA', 'TRAMITACAO', 'REABERTURA'].includes(item.kind) && item.createdAt <= event.createdAt).length;

export function savePdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function simplePageFooter(doc: jsPDF, protocol: Protocol, generatedAt: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('Roboto', 'normal').setFontSize(6.5).setTextColor(80);
    doc.text(`${protocol.number} · Gerado em ${generatedAt}`, 12, 290);
    doc.text(`Pág. ${page} de ${pages}`, 198, 290, { align: 'right' });
  }
}

export async function createMovementReceiptPdf(db: Database, protocol: Protocol, requestedEvent?: ProtocolEvent) {
  const settings = readInstitutionSettings();
  const event = requestedEvent ?? latestMovement(db, protocol);
  if (!event) throw new Error('Não existe movimentação disponível para gerar o comprovante.');
  const doc = await newPdf();
  doc.setProperties({ title: `Comprovante de tramitação ${protocol.number}` });
  const startY = await timbre(doc, db, settings);
  autoTable(doc, {
    startY,
    theme: 'grid',
    head: [['COMPROVANTE DE TRAMITAÇÃO']],
    body: [[`PROCESSO Nº ${protocol.number}`]],
    styles: { ...tableStyles, halign: 'center' },
    headStyles: { fillColor: [238, 238, 238], textColor: 20, fontStyle: 'bold', fontSize: 11 },
    margin: { left: 12, right: 12, top: 18, bottom: 26 },
  });
  const phase = protocol.flowSnapshot?.phases.find((item) => item.phaseId === protocol.currentPhaseId);
  const interested = db.people.find((person) => person.id === protocol.interestedPersonId)?.name ?? 'Não informado';
  autoTable(doc, {
    startY: tableEnd(doc),
    theme: 'grid',
    body: [
      ['Data/Hora da tramitação:', dateTime(event.createdAt), 'Movimentação nº:', String(movementNumber(db, protocol, event)).padStart(2, '0')],
      ['Tipo de processo:', db.protocolTypes.find((type) => type.id === protocol.typeId)?.name ?? 'Não informado', 'Interessado:', interested],
      ['Fase:', phase?.name ?? eventLabel[event.kind], 'Situação:', statusLabel[event.nextStatus ?? protocol.status]],
      ['Origem (unidade / responsável):', `${unitName(db, event.fromUnitId ?? event.actorUnitId)}\n${userName(db, event.fromUserId ?? event.actorUserId)}`, '', ''],
      ['Destino (unidade / responsável):', `${unitName(db, event.toUnitId ?? protocol.currentUnitId)}\n${userName(db, event.toUserId ?? protocol.currentAssigneeId)}`, '', ''],
      ['Prazo para atendimento:', protocol.dueAt ? dateTime(protocol.dueAt) : 'Sem prazo definido', '', ''],
      ['Despacho / observação:', event.message || eventLabel[event.kind], '', ''],
    ],
    styles: { ...tableStyles, valign: 'top' },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 52 }, 2: { cellWidth: 34, fontStyle: 'bold' }, 3: { cellWidth: 58 } },
    didParseCell: (data) => {
      if ([3, 4, 5, 6].includes(data.row.index) && data.column.index === 1) data.cell.colSpan = 3;
      if (data.row.index === 6) data.cell.styles.minCellHeight = 20;
    },
    margin: { left: 12, right: 12, top: 18, bottom: 26 },
  });
  const signatureY = Math.min(250, tableEnd(doc) + 14);
  doc.setFontSize(7).setTextColor(40);
  doc.text('Responsável pela tramitação', 12, signatureY);
  doc.text('Recebido em ____/____/________', 112, signatureY);
  doc.setTextColor(110).setFontSize(6.5);
  doc.text('Documento gerado eletronicamente pelo sistema de processos.', 105, signatureY + 8, { align: 'center' });
  simplePageFooter(doc, protocol, dateTime(new Date().toISOString()));
  return doc;
}

export async function downloadMovementReceipt(db: Database, protocol: Protocol, event?: ProtocolEvent) {
  const doc = await createMovementReceiptPdf(db, protocol, event);
  doc.save(`comprovante_tramitacao_${protocol.number}.pdf`);
}
export async function createProtocolReceiptPdf(db: Database, protocol: Protocol) {
  const settings = readInstitutionSettings();
  const doc = await newPdf();
  const type = db.protocolTypes.find((item) => item.id === protocol.typeId)?.name ?? 'Não informado';
  const interested = db.people.find((person) => person.id === protocol.interestedPersonId)?.name ?? 'Não informado';
  const organization = settings.shortName || settings.organizationName || db.organization.name;
  const consultation = consultationUrl(protocol, settings.publicUrl ?? '', settings.publicConsultation !== false, window.location.origin);
  const qr = await QRCode.toDataURL(consultation, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, protocol.number, { format: 'CODE128', displayValue: false, height: 36, margin: 0 });
  const barcode = barcodeCanvas.toDataURL('image/png');

  doc.setProperties({ title: `Comprovante de protocolo ${protocol.number}` });
  const startY = await timbre(doc, db, settings);
  autoTable(doc, {
    startY,
    theme: 'grid',
    head: [['COMPROVANTE DE PROTOCOLO']],
    body: [[`Número do protocolo: ${protocol.number}`]],
    styles: { ...tableStyles, halign: 'center', cellPadding: 2.8 },
    headStyles: { fillColor: [238, 238, 238], textColor: 20, fontStyle: 'bold', fontSize: 10 },
    margin: { left: 21, right: 21 },
  });
  autoTable(doc, {
    startY: tableEnd(doc),
    theme: 'grid',
    body: [
      ['Data/Hora:', dateTime(protocol.createdAt)],
      ['Assunto/Tipo:', `${protocol.subject} — ${type}`],
      ['Interessado:', interested],
    ],
    styles: { ...tableStyles, cellPadding: 2.6 },
    columnStyles: { 0: { cellWidth: 48, halign: 'right', fontStyle: 'bold' } },
    margin: { left: 21, right: 21 },
  });

  let y = tableEnd(doc) + 9;
  doc.setFont('Roboto', 'bold').setFontSize(10).setTextColor(20);
  doc.text('Descrição do protocolo', 105, y, { align: 'center' });
  y += 7;
  doc.setFont('Roboto', 'normal').setFontSize(8);
  const description = doc.splitTextToSize(protocol.description || 'Não informado', 174).slice(0, 7);
  doc.text(description, 18, y);
  y += Math.max(10, description.length * 4) + 7;

  doc.setFont('Roboto', 'bold').setFontSize(8);
  doc.text('REQUERIMENTO:     (   ) Deferido     (   ) Indeferido     DATA: ____/____/________', 105, y, { align: 'center' });
  y += 17;
  doc.setDrawColor(70).setLineWidth(0.2).line(56, y, 154, y);
  doc.setFont('Roboto', 'normal').setFontSize(7);
  doc.text('ASSINATURA DO RESPONSÁVEL', 105, y + 4, { align: 'center' });

  y += 16;
  doc.setFont('Roboto', 'bold').setFontSize(10);
  doc.text('Consulte o andamento do seu protocolo no nosso site', 105, y, { align: 'center' });
  y += 6;
  doc.setFont('Roboto', 'normal').setFontSize(7.5);
  const instructions = doc.splitTextToSize('Para realizar a consulta, informe o CPF/CNPJ do interessado e o número deste protocolo no portal da entidade.', 174);
  doc.text(instructions, 18, y);
  y += instructions.length * 3.7 + 2;
  const qrInstructions = doc.splitTextToSize('Você também pode usar o QR code abaixo para acessar diretamente a consulta do processo.', 174);
  doc.text(qrInstructions, 18, y);
  y += qrInstructions.length * 3.7 + 3;
  doc.addImage(qr, 'PNG', 92, y, 26, 26);
  doc.addImage(barcode, 'PNG', 80, y + 29, 50, 9);
  doc.setFontSize(6.5).text(protocol.number, 105, y + 41, { align: 'center' });

  const dividerY = 247;
  doc.setDrawColor(130).setLineWidth(0.2).setLineDashPattern([1.2, 1.2], 0).line(10, dividerY, 200, dividerY);
  doc.setLineDashPattern([], 0);
  doc.setFont('Roboto', 'bold').setFontSize(8);
  doc.text(`PROTOCOLO: ${protocol.number} - ${organization}`, 105, dividerY + 6, { align: 'center' });
  doc.addImage(qr, 'PNG', 12, dividerY + 9, 23, 23);
  doc.setFont('Roboto', 'normal').setFontSize(6.8);
  const stubDescription = doc.splitTextToSize(protocol.description || protocol.subject, 90)[0];
  doc.text(`Interessado: ${interested}`, 39, dividerY + 13);
  doc.text(`Setor: ${unitName(db, protocol.currentUnitId)}`, 39, dividerY + 18);
  doc.text(`Descrição: ${stubDescription}`, 39, dividerY + 23);
  doc.text('Recebemos em: ____/____/________', 39, dividerY + 31);
  doc.setDrawColor(70).line(39, dividerY + 36, 120, dividerY + 36);
  doc.setFontSize(6).text('ASSINATURA', 79.5, dividerY + 39, { align: 'center' });
  doc.setFontSize(6.8).text(dateTime(protocol.createdAt), 198, dividerY + 13, { align: 'right' });
  doc.addImage(barcode, 'PNG', 148, dividerY + 17, 50, 9);
  doc.setFont('Roboto', 'bold').setFontSize(7).text(protocol.number, 173, dividerY + 30, { align: 'center' });
  return doc;
}

export async function downloadProtocolReceipt(db: Database, protocol: Protocol) {
  const doc = await createProtocolReceiptPdf(db, protocol);
  doc.save(`comprovante_protocolo_${protocol.number}.pdf`);
}

export async function createProcessLabelPdf(db: Database, protocol: Protocol) {
  const settings = readInstitutionSettings();
  const width = Math.min(300, Math.max(70, (Number(settings.labelWidth) || 425) * 25.4 / 72));
  const height = Math.min(200, Math.max(45, (Number(settings.labelHeight) || 283) * 25.4 / 72));
  const doc = await newPdf([width, height], width >= height ? 'landscape' : 'portrait');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const scaleX = pageWidth / 150;
  const scaleY = pageHeight / 100;
  const x = (value: number) => value * scaleX;
  const y = (value: number) => value * scaleY;
  const type = db.protocolTypes.find((item) => item.id === protocol.typeId);
  const status = statusLabel[protocol.status];
  const consultation = consultationUrl(protocol, settings.publicUrl ?? '', settings.publicConsultation !== false, window.location.origin);
  const qr = await QRCode.toDataURL(consultation, { errorCorrectionLevel: 'M', margin: 1, width: 320 });

  doc.setProperties({ title: `Etiqueta do processo ${protocol.number}` });
  doc.setTextColor(12);
  if (settings.logoDataUrl) {
    const image = doc.getImageProperties(settings.logoDataUrl);
    const ratio = image.width / image.height;
    const maxWidth = x(27);
    const maxHeight = y(12);
    const imageWidth = Math.min(maxWidth, maxHeight * ratio);
    const imageHeight = imageWidth / ratio;
    doc.addImage(settings.logoDataUrl, 'PNG', x(5), y(5), imageWidth, imageHeight);
  } else {
    doc.setFont('Roboto', 'bold').setFontSize(9).text(settings.shortName || db.organization.abbreviation, x(5), y(10));
  }

  doc.setFont('Roboto', 'bold').setFontSize(15).text('PROCESSO', x(145), y(9), { align: 'right' });
  doc.setFont('Roboto', 'normal').setFontSize(9);
  const typeLabel = type?.name?.toLocaleUpperCase('pt-BR') ?? 'TIPO NÃO INFORMADO';
  doc.text(doc.splitTextToSize(typeLabel, x(64)).slice(0, 2), x(145), y(14), { align: 'right' });

  doc.setFont('Roboto', 'bold').setFontSize(27).text(protocol.number, x(5), y(31));
  doc.setFont('Roboto', 'normal').setFontSize(9.5);
  doc.text(dateTime(protocol.createdAt), x(5), y(40));
  doc.text(unitName(db, protocol.currentUnitId), x(5), y(46));
  doc.text(userName(db, protocol.currentAssigneeId), x(5), y(52));
  doc.setFont('Roboto', 'bold').setFontSize(9.5);
  doc.text(doc.splitTextToSize(protocol.subject, x(83)).slice(0, 2), x(5), y(61));

  const qrSize = Math.min(x(36), y(36));
  doc.addImage(qr, 'PNG', pageWidth - x(41), y(21), qrSize, qrSize);
  doc.setDrawColor(18).setLineWidth(.35).line(x(4.5), y(66), pageWidth - x(4.5), y(66));
  doc.setFont('Roboto', 'normal').setTextColor(85).setFontSize(9.5).text(status, x(5), y(72));
  return doc;
}
export async function downloadProcessLabel(db: Database, protocol: Protocol) {
  const doc = await createProcessLabelPdf(db, protocol);
  doc.save(`etiqueta_${protocol.number}.pdf`);
}

function detailSection(doc: jsPDF, title: string, startY: number) {
  autoTable(doc, {
    head: [[title]], startY, theme: 'plain',
    styles: { ...tableStyles, halign: 'center', cellPadding: 2.5, lineWidth: 0 },
    headStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', fontSize: 10 },
    margin: { left: 12, right: 12, top: 18, bottom: 15 },
  });
}

function detailTable(doc: jsPDF, head: string[], body: string[][], startY: number, columnStyles: Record<number, object>) {
  autoTable(doc, {
    head: [head], body, startY, theme: 'grid',
    styles: { ...tableStyles, fontSize: 6.5, cellPadding: 1.3, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [239, 239, 239], textColor: 20, fontStyle: 'bold', halign: 'left' },
    columnStyles,
    margin: { left: 12, right: 12, top: 18, bottom: 15 },
    rowPageBreak: 'avoid',
  });
}

function processDetailsFooter(doc: jsPDF, protocol: Protocol) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('Roboto', 'normal').setFontSize(6.5).setTextColor(80);
    doc.text(protocol.number, 12, 290);
    doc.text(`Pág. ${page} de ${pages}`, 198, 290, { align: 'right' });
  }
}

export async function createProcessDetailsPdf(db: Database, protocol: Protocol) {
  const settings = readInstitutionSettings();
  const doc = await newPdf();
  const attachments = db.attachments.filter((attachment) => attachment.protocolId === protocol.id);
  doc.setProperties({ title: `Detalhamento do processo ${protocol.number}` });
  const startY = await timbre(doc, db, settings);
  autoTable(doc, {
    startY, theme: 'grid', head: [['MOVIMENTAÇÃO DO PROTOCOLO']],
    body: [[`NÚMERO DO PROTOCOLO: ${protocol.number}`]],
    styles: { ...tableStyles, halign: 'center' },
    headStyles: { fillColor: [58, 58, 58], textColor: 255, fontStyle: 'bold', fontSize: 11 },
    margin: { left: 12, right: 12, top: 18, bottom: 18 },
  });
  autoTable(doc, {
    startY: tableEnd(doc), theme: 'grid',
    body: [
      ['Data/Hora:', dateTime(protocol.createdAt), 'Assunto/Tipo:', db.protocolTypes.find((type) => type.id === protocol.typeId)?.name ?? 'Não informado'],
      ['Interessado:', db.people.find((person) => person.id === protocol.interestedPersonId)?.name ?? 'Não informado', '', ''],
      ['Descrição:', protocol.description, '', ''],
    ],
    styles: { ...tableStyles, valign: 'top' },
    columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold' }, 1: { cellWidth: 65 }, 2: { cellWidth: 28, fontStyle: 'bold' }, 3: { cellWidth: 63 } },
    didParseCell: (data) => {
      if ([1, 2].includes(data.row.index) && data.column.index === 1) data.cell.colSpan = 3;
    },
    margin: { left: 12, right: 12, top: 18, bottom: 18 },
  });
  const events = processEvents(db, protocol);
  const movementKinds = new Set(['ABERTURA', 'TRAMITACAO', 'REABERTURA', 'FASE_AVANCADA', 'FASE_DEVOLVIDA', 'CONCLUSAO', 'ARQUIVAMENTO']);
  detailSection(doc, 'Tramitações', tableEnd(doc) + 4);
  detailTable(doc, ['Data/hora', 'Setor', 'Fase', 'Enviado por', 'Recebido por', 'Descrição', 'Situação'],
    events.filter((event) => movementKinds.has(event.kind)).map((event) => {
      const eventPhase = protocol.flowSnapshot?.phases.find((phase) => phase.phaseId === event.phaseId);
      return [
        dateTime(event.createdAt), unitName(db, event.toUnitId ?? event.actorUnitId), eventPhase?.name ?? eventLabel[event.kind],
        userName(db, event.fromUserId ?? event.actorUserId), userName(db, event.toUserId),
        event.message || eventLabel[event.kind], eventPhase?.situationType?.name ?? statusLabel[event.nextStatus ?? protocol.status],
      ];
    }), tableEnd(doc) + 1, { 0: { cellWidth: 22 }, 1: { cellWidth: 32 }, 2: { cellWidth: 23 }, 3: { cellWidth: 17 }, 4: { cellWidth: 17 }, 5: { cellWidth: 54 }, 6: { cellWidth: 21 } });
  detailSection(doc, 'Ações', tableEnd(doc) + 4);
  detailTable(doc, ['Data/hora', 'Usuário', 'Descrição'], events.map((event) => [dateTime(event.createdAt), userName(db, event.actorUserId), event.message || eventLabel[event.kind]]), tableEnd(doc) + 1,
    { 0: { cellWidth: 31 }, 1: { cellWidth: 45 }, 2: { cellWidth: 110 } });
  detailSection(doc, 'Anexos', tableEnd(doc) + 4);
  detailTable(doc, ['Descrição', 'Tipo', 'Tamanho', 'Data'], attachments.length
    ? attachments.map((attachment) => [attachment.filename, attachment.mimeType, `${Math.max(1, Math.ceil(attachment.sizeBytes / 1024))} KB`, dateTime(attachment.createdAt)])
    : [['Nenhum anexo vinculado', '', '', '']], tableEnd(doc) + 1,
    { 0: { cellWidth: 86 }, 1: { cellWidth: 42 }, 2: { cellWidth: 27 }, 3: { cellWidth: 31 } });
  processDetailsFooter(doc, protocol);
  return doc;
}

const isGeneratedDossier = (attachment: Attachment) =>
  /^dossie_.+_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.pdf$/i.test(attachment.filename);

const dossierPdfAttachments = (db: Database, protocol: Protocol) => db.attachments
  .filter((attachment) => attachment.protocolId === protocol.id && attachment.mimeType.toLocaleLowerCase() === 'application/pdf' && !isGeneratedDossier(attachment))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

async function createDossierCoverPdf(db: Database, protocol: Protocol, integratedCount: number) {
  const settings = readInstitutionSettings();
  const doc = await newPdf();
  const generatedAt = dateTime(new Date().toISOString());
  doc.setProperties({ title: 'Dossiê do processo ' + protocol.number });
  doc.setDrawColor(175).setLineWidth(.25).rect(12, 10, 186, 277).rect(14, 12, 182, 273);
  await timbre(doc, db, settings);
  doc.setFont('Roboto', 'normal').setTextColor(55).setFontSize(13).text('DOSSIÊ DO PROCESSO', 105, 160, { align: 'center' });
  doc.setFont('Roboto', 'bold').setTextColor(10).setFontSize(23).text('Processo ' + protocol.number, 105, 178, { align: 'center' });
  doc.setFont('Roboto', 'normal').setTextColor(70).setFontSize(10);
  doc.text(integratedCount + ' anexo(s) integrado(s) a este dossiê', 105, 190, { align: 'center' });
  doc.text('Gerado em ' + generatedAt, 105, 199, { align: 'center' });
  doc.setFontSize(7).text('Documento gerado eletronicamente pelo sistema de processos.', 105, 267, { align: 'center' });
  simplePageFooter(doc, protocol, generatedAt);
  return doc;
}

async function createDossierAttachmentCoverPdf(db: Database, protocol: Protocol, attachment: Attachment, index: number) {
  const settings = readInstitutionSettings();
  const doc = await newPdf();
  doc.setDrawColor(175).setLineWidth(.25).rect(12, 10, 186, 277).rect(14, 12, 182, 273);
  await timbre(doc, db, settings);
  doc.setFont('Roboto', 'normal').setTextColor(70).setFontSize(13);
  doc.text('ANEXO ' + String(index).padStart(2, '0'), 105, 157, { align: 'center' });

  const fontSize = attachment.filename.length > 70 ? 16 : 20;
  doc.setFont('Roboto', 'bold').setTextColor(10).setFontSize(fontSize);
  const filenameLines = doc.splitTextToSize(attachment.filename, 174).slice(0, 3);
  doc.text(filenameLines, 105, 171, { align: 'center', lineHeightFactor: 1.15 });
  const metadataY = 171 + filenameLines.length * fontSize * .42 + 4;
  doc.setFont('Roboto', 'normal').setTextColor(70).setFontSize(9);
  doc.text('PDF - ' + dateTime(attachment.createdAt), 105, metadataY, { align: 'center' });
  doc.setFont('Roboto', 'bold').setTextColor(20).setFontSize(8);
  doc.text('Documento anexado por ' + userName(db, attachment.uploadedById), 105, metadataY + 8, { align: 'center' });
  doc.setDrawColor(165).setLineWidth(.25).line(83, metadataY + 15, 127, metadataY + 15);
  doc.setFont('Roboto', 'normal').setTextColor(70).setFontSize(7);
  doc.text('Dossiê do processo ' + protocol.number, 105, 278, { align: 'center' });
  return doc;
}

export async function buildDossier(db: Database, protocol: Protocol) {
  const { PDFDocument } = await import('pdf-lib');
  const loadedAttachments: Array<{ attachment: Attachment; source: import('pdf-lib').PDFDocument }> = [];
  for (const attachment of dossierPdfAttachments(db, protocol)) {
    const blob = await api.getBlob(attachment.blobKey);
    if (!blob) continue;
    try {
      loadedAttachments.push({ attachment, source: await PDFDocument.load(await blob.arrayBuffer()) });
    } catch {
      // Arquivos inválidos continuam relacionados no detalhamento, mas não podem ser incorporados.
    }
  }

  const [cover, details] = await Promise.all([
    createDossierCoverPdf(db, protocol, loadedAttachments.length),
    createProcessDetailsPdf(db, protocol),
  ]);
  const dossier = await PDFDocument.load(cover.output('arraybuffer'));
  const detailsSource = await PDFDocument.load(details.output('arraybuffer'));
  const detailsPages = await dossier.copyPages(detailsSource, detailsSource.getPageIndices());
  detailsPages.forEach((page) => dossier.addPage(page));
  for (const [index, { attachment, source }] of loadedAttachments.entries()) {
    const identification = await createDossierAttachmentCoverPdf(db, protocol, attachment, index + 1);
    const identificationSource = await PDFDocument.load(identification.output('arraybuffer'));
    const identificationPages = await dossier.copyPages(identificationSource, identificationSource.getPageIndices());
    identificationPages.forEach((page) => dossier.addPage(page));
    const pages = await dossier.copyPages(source, source.getPageIndices());
    pages.forEach((page) => dossier.addPage(page));
  }
  const bytes = await dossier.save();
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: 'dossie_' + protocol.number + '_' + timestamp + '.pdf',
    integrated: loadedAttachments.length,
  };
}
export async function downloadDossier(db: Database, protocol: Protocol) {
  const dossier = await buildDossier(db, protocol);
  savePdfBlob(dossier.blob, dossier.filename);
  return dossier;
}

export async function downloadProcessDetails(db: Database, protocol: Protocol) {
  const doc = await createProcessDetailsPdf(db, protocol);
  doc.save(`detalhamento_${protocol.number}.pdf`);
}
