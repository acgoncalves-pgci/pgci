import type { AppDocument, Context, Database } from '../domain/model'
import { GENERAL_SETTINGS_KEY } from './numbering'
import { documentText } from './richText'

export const templateVariables = [
  { group: 'Entidade', items: [
    { key: 'nome_entidade', label: 'Nome da entidade' },
    { key: 'cidade_entidade', label: 'Cidade da entidade' },
    { key: 'estado_entidade', label: 'Estado da entidade' },
  ] },
  { group: 'Documento', items: [
    { key: 'numero_documento', label: 'Número do documento' },
    { key: 'tipo_documento', label: 'Tipo do documento' },
    { key: 'assunto_documento', label: 'Assunto do documento' },
  ] },
  { group: 'Autor', items: [
    { key: 'nome_autor', label: 'Nome do autor' },
    { key: 'cargo_autor', label: 'Cargo do autor' },
    { key: 'email_autor', label: 'E-mail do autor' },
  ] },
  { group: 'Destinatário', items: [{ key: 'nome_destinatario', label: 'Nome do destinatário' }] },
  { group: 'Lotação', items: [
    { key: 'secretaria', label: 'Secretaria' },
    { key: 'unidade', label: 'Unidade' },
    { key: 'setor', label: 'Setor' },
  ] },
  { group: 'Protocolo', items: [
    { key: 'numero_protocolo', label: 'Número do protocolo' },
    { key: 'assunto_protocolo', label: 'Assunto do protocolo' },
  ] },
  { group: 'Data', items: [
    { key: 'data_hoje', label: 'Data de hoje (dd/mm/aaaa)' },
    { key: 'data_extenso', label: 'Data por extenso' },
    { key: 'ano_atual', label: 'Ano atual' },
  ] },
] as const

const legacyVariables = ['numero_processo', 'assunto_processo', 'destinatario', 'data_atual', 'usuario']
const allowedVariables = new Set<string>([...templateVariables.flatMap((group) => group.items.map((item) => item.key)), ...legacyVariables])
const tokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g

export function invalidTemplateVariables(value: string): string[] {
  return [...new Set([...value.matchAll(tokenPattern)].map((match) => match[1].trim()).filter((key) => !allowedVariables.has(key)))]
}

export function validateTemplateContent(subject: string, body: string): string | undefined {
  if (!documentText(body)) return 'Informe o corpo do modelo.'
  if (/\{\{\s*assunto_documento\s*\}\}/.test(subject)) return 'A variável de assunto do documento deve ser usada no corpo, não no próprio assunto padrão.'
  const invalid = invalidTemplateVariables(subject + ' ' + body)
  if (invalid.length) return `Variáveis desconhecidas: ${invalid.map((key) => `{{${key}}}`).join(', ')}.`
  if ((subject + body).replace(tokenPattern, '').includes('{{') || (subject + body).replace(tokenPattern, '').includes('}}')) return 'Corrija as variáveis incompletas entre chaves duplas.'
  return undefined
}

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)

export function replaceTemplateVariables(value: string, values: Record<string, string>, html = false): string {
  return value.replace(tokenPattern, (original, key: string) => {
    const replacement = values[key.trim()]
    return replacement === undefined ? original : html ? escapeHtml(replacement) : replacement
  })
}

export function documentTemplateValues(db: Database, ctx: Context, draft: Pick<AppDocument, 'typeId' | 'subject' | 'recipientPersonId' | 'unitId' | 'protocolId' | 'signerTitle'>, number?: string): Record<string, string> {
  const author = db.users.find((user) => user.id === ctx.userId)
  const membership = db.memberships.find((item) => item.userId === ctx.userId && item.unitId === draft.unitId && item.active)
  const unit = db.units.find((item) => item.id === draft.unitId)
  const parents = unit ? [unit] : []
  while (parents[parents.length - 1]?.parentId) {
    const parent = db.units.find((item) => item.id === parents[parents.length - 1].parentId)
    if (!parent || parents.includes(parent)) break
    parents.push(parent)
  }
  const protocol = db.protocols.find((item) => item.id === draft.protocolId)
  const date = new Date()
  let settings: { city?: string; state?: string; organizationName?: string } = {}
  try { settings = JSON.parse(localStorage.getItem(GENERAL_SETTINGS_KEY) ?? '{}') } catch { /* Configuração opcional. */ }
  const recipient = db.people.find((person) => person.id === draft.recipientPersonId)
  return {
    nome_entidade: settings.organizationName?.trim() || db.organization.name,
    cidade_entidade: settings.city?.trim() || '',
    estado_entidade: settings.state?.trim() || '',
    numero_documento: number ?? '{{numero_documento}}',
    tipo_documento: db.documentTypes.find((type) => type.id === draft.typeId)?.name ?? '',
    assunto_documento: draft.subject,
    nome_autor: author?.name ?? '',
    cargo_autor: draft.signerTitle?.trim() || membership?.title || '',
    email_autor: author?.email ?? '',
    nome_destinatario: recipient?.name ?? '',
    secretaria: (parents.length > 1 ? parents.at(-2) : unit)?.name ?? '',
    unidade: unit?.name ?? '',
    setor: parents.length > 2 ? unit?.name ?? '' : '',
    numero_protocolo: protocol?.number ?? '',
    assunto_protocolo: protocol?.subject ?? '',
    data_hoje: new Intl.DateTimeFormat('pt-BR').format(date),
    data_extenso: new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date),
    ano_atual: String(date.getFullYear()),
    numero_processo: protocol?.number ?? '',
    assunto_processo: protocol?.subject ?? '',
    destinatario: recipient?.name ?? '',
    data_atual: new Intl.DateTimeFormat('pt-BR').format(date),
    usuario: author?.name ?? '',
  }
}
