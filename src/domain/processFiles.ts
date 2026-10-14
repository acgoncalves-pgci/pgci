import type { ProcessFileType, ProtocolType } from './model'
import { DomainError } from './rules'

export const processFileExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'rar', 'zip', 'png', 'jpg', 'jpeg', 'txt'] as const
const defaultExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'txt']
export const retentionLabel = (years: ProcessFileType['retentionYears']) => years === null ? 'Permanente' : `${years} ${years === 1 ? 'ano' : 'anos'}`
export const allowedProcessExtensions = (type?: Pick<ProtocolType, 'fileTypes'>) => type?.fileTypes?.length
  ? [...new Set(type.fileTypes.flatMap((definition) => definition.extensions.map((extension) => extension.toLowerCase().replace(/^\./, ''))))]
  : defaultExtensions
export const processFileAccept = (type?: Pick<ProtocolType, 'fileTypes'>) => allowedProcessExtensions(type).map((extension) => `.${extension}`).join(',')
export const processFileMime = (file: Pick<File, 'name' | 'type'>) => file.type || ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip', rar: 'application/vnd.rar' } as Record<string, string>)[file.name.split('.').at(-1)?.toLowerCase() ?? ''] || 'application/octet-stream'

export function normalizeProcessFileType(input: Omit<ProcessFileType, 'id'>) {
  const name = input.name.trim()
  const extensions = [...new Set(input.extensions.map((extension) => extension.toLowerCase().replace(/^\./, '')))]
  if (!name || name.length > 120) throw new DomainError('VALIDATION', 'Informe um nome de até 120 caracteres para o tipo de arquivo.')
  if (!extensions.length || extensions.some((extension) => !processFileExtensions.includes(extension as typeof processFileExtensions[number])))
    throw new DomainError('VALIDATION', 'Selecione ao menos uma extensão permitida.')
  if (input.retentionYears !== null && ![1, 2, 3, 4].includes(input.retentionYears)) throw new DomainError('VALIDATION', 'Selecione uma retenção válida.')
  if ((input.observation?.length ?? 0) > 1000) throw new DomainError('VALIDATION', 'A observação deve ter até 1.000 caracteres.')
  if (!/^#[0-9a-f]{6}$/i.test(input.color) || !/^[A-Za-z][A-Za-z0-9]{0,79}$/.test(input.icon)) throw new DomainError('VALIDATION', 'Informe cor e ícone válidos.')
  return { ...input, name, extensions, observation: input.observation?.trim() || undefined, color: input.color.toUpperCase() }
}

export function validateProcessFiles(type: Pick<ProtocolType, 'fileTypes'>, files: Pick<File, 'name' | 'size'>[]) {
  const allowed = allowedProcessExtensions(type)
  for (const file of files) {
    const extension = file.name.split('.').at(-1)?.toLowerCase()
    if (!file.name.includes('.') || !extension || !allowed.includes(extension))
      throw new DomainError('VALIDATION', `O arquivo “${file.name}” não é permitido para este tipo de processo. Extensões permitidas: ${allowed.map((value) => value.toUpperCase()).join(', ')}.`)
    if (file.size > 5 * 1024 * 1024) throw new DomainError('VALIDATION', 'Cada arquivo deve ter até 5 MB.')
  }
}
