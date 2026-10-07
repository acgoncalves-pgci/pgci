import { beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from './seed'
import { normalizeDemoNumbers } from './normalizeDemoNumbers'
import { configuredSequence, formatConfiguredNumber, GENERAL_SETTINGS_KEY, numberingCounterKey } from '../lib/numbering'
import { api } from '../services/api'
import { saveDb } from '../storage/database'

describe('numeração e cronologia da demonstração', () => {
  beforeEach(() => localStorage.clear())
  for (const format of ['Diário — YYYY.MM.DD.NNNN', 'Anual — YYYY.NNNNNN', 'Sequencial — NNNNNN']) {
    it(`respeita ${format}, padding e contadores independentes`, () => {
      const settings = { numberFormat: format, sequencePadding: '5' }
      localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(settings))
      const db = seedDatabase()
      for (const scope of ['protocol', 'document'] as const) {
        const records = scope === 'protocol' ? db.protocols : db.documents
        const periods = new Map<string, number>()
        for (const record of [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
          const date = new Date(record.createdAt)
          const key = numberingCounterKey(scope, settings, date)
          const next = (periods.get(key) ?? 0) + 1
          periods.set(key, next)
          expect(record.number).toBe(formatConfiguredNumber(scope, next, settings, date))
        }
        expect(new Set(records.map((record) => record.number)).size).toBe(records.length)
        for (const [key, count] of periods) expect(db.counters[key]).toBe(count)
      }
    })
  }
  it('documentos e eventos respeitam a abertura e a movimentação a que estão vinculados', () => {
    const db = seedDatabase()
    for (const document of db.documents) {
      const protocol = db.protocols.find((item) => item.id === document.protocolId)
      const movement = db.events.find((item) => item.id === document.movementEventId)
      if (protocol) expect(document.createdAt >= protocol.createdAt).toBe(true)
      if (movement) expect(document.createdAt >= movement.createdAt).toBe(true)
      expect(Date.parse(document.createdAt)).toBeLessThanOrEqual(Date.now())
    }
    for (const event of db.events) {
      const assignment = db.assignments.find((item) => item.id === event.assignmentId)
      if (assignment) expect(event.createdAt >= assignment.startedAt, event.id).toBe(true)
    }
  })
  it('migra números antigos uma única vez, preservando registros criados pelo usuário e referências', () => {
    const db = seedDatabase()
    delete db.demoNumberingVersion
    db.counters = {}
    for (const record of db.protocols) record.number = `2026.${record.id.slice(3).padStart(6, '0')}`
    for (const record of db.documents) record.number = `DOC-2026.${record.id.slice(4).padStart(6, '0')}`
    const original = db.protocols[0]
    const manual = { ...original, id: 'processo-criado-pelo-usuario', number: '2026.000099' }
    db.protocols.push(manual)
    db.documents[0].body = 'Processo 2026.000001 e documento DOC-2026.000001.'
    normalizeDemoNumbers(db)
    expect(manual.number).toBe('2026.000099')
    expect(db.documents[0].body).toBe(`Processo ${original.number} e documento ${db.documents[0].number}.`)
    const numbers = db.protocols.map((record) => record.number)
    localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify({ numberFormat: 'Sequencial — NNNNNN' }))
    normalizeDemoNumbers(db)
    expect(db.protocols.map((record) => record.number)).toEqual(numbers)
  })
  it('a sequência diária considera apenas o mesmo dia e a anual apenas o mesmo ano', () => {
    const date = new Date(2026, 9, 6)
    expect(configuredSequence('2026.10.05.0999', 'protocol', {}, date)).toBeUndefined()
    expect(configuredSequence('2026.10.06.0002', 'protocol', {}, date)).toBe(2)
    expect(configuredSequence('2025.0999', 'protocol', { numberFormat: 'Anual' }, date)).toBeUndefined()
    expect(configuredSequence('2026.0002', 'protocol', { numberFormat: 'Anual' }, date)).toBe(2)
  })
  it('a API reinicia a sequência diária sem reaproveitar números de outros dias', async () => {
    const db = seedDatabase()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    db.documents.push({ ...db.documents[0], id: 'documento-importado', number: formatConfiguredNumber('document', 999, {}, yesterday), protocolId: undefined, movementEventId: undefined })
    const next = (db.counters[numberingCounterKey('document', {}, new Date())] ?? 0) + 1
    saveDb(db)
    const ctx = { userId: 'usr-admin', activeUnitId: 'u-prot' }
    const first = await api.createDocument(ctx, { typeId: 'dt-oficio', subject: 'Registro do dia', body: 'Registro administrativo para conferência.' })
    const second = await api.createDocument(ctx, { typeId: 'dt-oficio', subject: 'Segundo registro', body: 'Complementação do registro administrativo.' })
    expect(first.number).toBe(formatConfiguredNumber('document', next, {}, new Date()))
    expect(second.number).toBe(formatConfiguredNumber('document', next + 1, {}, new Date()))
  })
})
