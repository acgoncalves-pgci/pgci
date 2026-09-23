export const GENERAL_SETTINGS_KEY = 'fluxo-publico:settings-general'

export type NumberingScope = 'protocol' | 'document'
export type NumberingSettings = {
  numberFormat?: string
  sequencePadding?: string
}

export const readNumberingSettings = (): NumberingSettings => {
  try {
    return JSON.parse(localStorage.getItem(GENERAL_SETTINGS_KEY) ?? '{}') as NumberingSettings
  } catch {
    return {}
  }
}

const pad = (sequence: number, value?: string) => {
  const parsed = Number(value)
  const size = Number.isInteger(parsed) ? Math.min(10, Math.max(1, parsed)) : 4
  return String(sequence).padStart(size, '0')
}

export const numberingCounterKey = (scope: NumberingScope, settings: NumberingSettings, date = new Date()) => {
  const format = settings.numberFormat ?? 'Diário — YYYY.MM.DD.NNNN'
  const year = date.getFullYear()
  if (format.startsWith('Diário')) return `${scope}-daily-${year}-${date.getMonth() + 1}-${date.getDate()}`
  if (format.startsWith('Anual')) return `${scope}-annual-${year}`
  return `${scope}-sequential`
}

export const formatConfiguredNumber = (
  scope: NumberingScope,
  sequence: number,
  settings: NumberingSettings,
  date = new Date(),
) => {
  const format = settings.numberFormat ?? 'Diário — YYYY.MM.DD.NNNN'
  const prefix = scope === 'document' ? 'DOC-' : ''
  const serial = pad(sequence, settings.sequencePadding)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (format.startsWith('Diário')) return `${prefix}${year}.${month}.${day}.${serial}`
  if (format.startsWith('Anual')) return `${prefix}${year}.${serial}`
  return `${prefix}${serial}`
}
