import type { Database } from '../domain/model'
import { configuredSequence, formatConfiguredNumber, numberingCounterKey, readNumberingSettings } from '../lib/numbering'

// Upgrade only the original demo identifiers. User-created records keep their numbers.
export function normalizeDemoNumbers(db: Database): Database {
  if (db.demoNumberingVersion === 1) return db
  const settings = readNumberingSettings()
  const replacements = new Map<string, string>()
  for (const scope of ['protocol', 'document'] as const) {
    const records = scope === 'protocol' ? db.protocols : db.documents
    const demo = records.filter((record) => {
      const match = record.id.match(scope === 'protocol' ? /^pr-(\d+)$/ : /^doc-(\d+)$/)
      if (!match || Number(match[1]) > (scope === 'protocol' ? 20 : 8)) return false
      return record.number === `${scope === 'document' ? 'DOC-' : ''}2026.${match[1].padStart(6, '0')}`
    })
    const retained = records.filter((record) => !demo.includes(record))
    const occupied = new Set(retained.map((record) => record.number))
    for (const record of demo.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
      const date = new Date(record.createdAt)
      const key = numberingCounterKey(scope, settings, date)
      const last = retained.reduce((max, item) => Math.max(max, configuredSequence(item.number, scope, settings, date) ?? 0), 0)
      let sequence = Math.max(db.counters[key] ?? 0, last)
      let number: string
      do { number = formatConfiguredNumber(scope, ++sequence, settings, date) } while (occupied.has(number))
      replacements.set(record.number, number)
      record.number = number
      db.counters[key] = sequence
      occupied.add(number)
    }
  }
  const rewrite = (text: string) => {
    for (const [before, after] of [...replacements].sort(([a], [b]) => b.length - a.length)) {
      const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      text = text.replace(new RegExp(`(?<![\\w.-])${escaped}(?!\\d|\\.\\d)`, 'g'), after)
    }
    return text
  }
  for (const document of db.documents) document.body = rewrite(document.body)
  for (const event of db.events) if (event.message) event.message = rewrite(event.message)
  for (const audit of db.auditEvents) if (audit.details) audit.details = rewrite(audit.details)
  db.demoNumberingVersion = 1
  return db
}
