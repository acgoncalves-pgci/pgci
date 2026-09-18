import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { Database, Protocol } from '../../domain/model';
import { eventLabel, statusLabel } from '../../domain/model';
import { dateTime, money } from '../../lib/format';
import { readInstitutionSettings } from '../../lib/institution';
import type { InstitutionSettings } from '../../lib/institution';
import { consultationUrl } from './reportData';

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
async function newPdf() {
  const doc = new jsPDF({ format: 'a4', compress: true });
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
  doc.setProperties({ title: `Capa do processo ${protocol.number}` });
  const startY = await timbre(doc, db, settings);
  table(doc, ['DADOS DO PROCESSO'], [[`Número do Processo: ${protocol.number}`]], startY);
  autoTable(doc, { startY: tableEnd(doc), theme: 'grid', styles: tableStyles,
    body: [
      ['Data/Hora:', dateTime(protocol.createdAt)],
      ['Tipo:', db.protocolTypes.find((t) => t.id === protocol.typeId)?.name ?? 'Não informado'],
      ['Assunto:', protocol.subject],
      ...(protocol.typeConfigSnapshot.interested.enabled ? [['Interessado:', db.people.find((p) => p.id === protocol.interestedPersonId)?.name ?? 'Não informado']] : []),
      ['Responsável:', userName(db, protocol.currentAssigneeId)],
      ['Setor:', unitName(db, protocol.currentUnitId)],
      ...(protocol.typeConfigSnapshot.creditor.enabled ? [['Credor:', db.people.find((p) => p.id === protocol.creditorPersonId)?.name ?? 'Não informado']] : []),
      ...(protocol.typeConfigSnapshot.amount.enabled ? [['Valor:', money(protocol.amountCents)]] : []),
    ], columnStyles: { 0: { cellWidth: 53, halign: 'right', fontStyle: 'bold' } },
    margin: { left: 21, right: 21, top: 20, bottom: 42 }, rowPageBreak: 'avoid' });
  paragraph(doc, 'Informações Complementares', protocol.description, tableEnd(doc) + 6);
  paragraph(doc, 'Movimentação do Processo', '', tableEnd(doc) + 2);
  const events = db.events.filter((e) => e.protocolId === protocol.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let movementStatus: keyof typeof statusLabel = 'CADASTRADO';
  const movementRows = events.map((e) => {
    movementStatus = e.nextStatus ?? e.previousStatus ?? (e.kind === 'ABERTURA' ? 'CADASTRADO' : ['TRAMITACAO', 'REABERTURA', 'FASE_AVANCADA', 'FASE_DEVOLVIDA'].includes(e.kind) ? 'EM_ANDAMENTO' : e.kind === 'CONCLUSAO' ? 'CONCLUIDO' : e.kind === 'ARQUIVAMENTO' ? 'ARQUIVADO' : movementStatus);
    return [dateTime(e.createdAt), unitName(db, e.toUnitId || e.actorUnitId), eventLabel[e.kind], userName(db, e.toUserId || e.actorUserId),
      [e.message || eventLabel[e.kind], e.relatedAttachmentId ? `Anexo: ${db.attachments.find((a) => a.id === e.relatedAttachmentId)?.filename ?? 'Arquivo vinculado'}` : '', e.relatedDocumentId ? `Documento: ${db.documents.find((d) => d.id === e.relatedDocumentId)?.number ?? 'Documento vinculado'}` : ''].filter(Boolean).join('\n'), statusLabel[movementStatus]];
  });
  table(doc, ['DATA/TEMPO', 'SETOR', 'ASSUNTO DO ANDAMENTO', 'RECEBIDO POR', 'DESCRIÇÃO DA TRAMITAÇÃO', 'SITUAÇÃO'], movementRows, tableEnd(doc) + 2);
  await footer(doc, settings, protocol);
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
  table(doc, ['Data', 'Processo', 'Atividade', 'Descrição / Resultado'], events.length ? events.map((e) => [dateTime(e.createdAt), protocols.find((p) => p.id === e.protocolId)!.number, eventLabel[e.kind], e.message || eventLabel[e.kind]]) : [['', '', 'Nenhuma atividade no período', '']], tableEnd(doc) + 3);
  paragraph(doc, 'Dificuldades ou impedimentos encontrados', difficulties, tableEnd(doc) + 5);
  paragraph(doc, 'Sugestões para melhoria do desempenho e produtividade setorial', suggestions, tableEnd(doc) + 3);
  await footer(doc, settings);
  doc.save('relatorio_produtividade.pdf');
}
