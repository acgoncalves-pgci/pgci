import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedDatabase } from '../mocks/seed'
import { loadDb, saveDb } from '../storage/database'
import { activateTenant, tenantStorage } from '../saas/tenants'
import { consultationNumber, getPublicProtocolSummary, publicProtocolSummary } from './publicConsultation'
import { consultationUrl } from '../features/relatorios/reportData'

describe('consulta pública somente de leitura', () => {
  beforeEach(() => { activateTenant(undefined); localStorage.clear(); saveDb(seedDatabase()) })
  afterEach(() => activateTenant(undefined))

  it('consulta sem login e não altera ciência, movimentações ou versões', async () => {
    const db = loadDb()
    const protocol = db.protocols[0]
    const summary = await getPublicProtocolSummary(protocol.number)
    expect(summary).toMatchObject({ number: protocol.number, subject: protocol.subject, description: protocol.description })
    expect(summary.history.length).toBeGreaterThan(0)
    expect(loadDb()).toEqual(db)
  })

  it('retorna somente dados do resumo e não expõe notas, pessoas ou arquivos', () => {
    const db = loadDb()
    const protocol = db.protocols[0]
    protocol.observations = 'Observação interna restrita'
    db.events.filter((event) => event.protocolId === protocol.id).forEach((event) => { event.message = 'Despacho interno restrito' })
    const summary = publicProtocolSummary(db, protocol.number)
    expect(Object.keys(summary).sort()).toEqual(['number', 'subject', 'description', 'type', 'situation', 'phase', 'unit', 'createdAt', 'updatedAt', 'dueAt', 'history'].sort())
    for (const event of summary.history) expect(Object.keys(event).sort()).toEqual(['action', 'createdAt', 'unit', 'phase'].sort())
    expect(JSON.stringify(summary)).not.toContain('intern')
  })

  it('respeita o bloqueio de consulta pública da prefeitura', async () => {
    tenantStorage.setItem('fluxo-publico:settings-general', JSON.stringify({ publicConsultation: false }))
    await expect(getPublicProtocolSummary(loadDb().protocols[0].number)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('aceita o número de barras antigo e a URL dos códigos novos sem aceitar outro slug', async () => {
    const tenant = { id: 'prefeitura-saomateus-ma', slug: 'saomateusdomaranhao', name: 'São Mateus', city: 'São Mateus', state: 'MA', abbreviation: 'PM' }
    activateTenant(tenant)
    const db = loadDb()
    const number = db.protocols[0].number
    const url = consultationUrl(db.protocols[0], '', true, 'https://sistema.gov.br')
    expect(new URL(url).pathname).toBe('/saomateusdomaranhao/consulta')
    expect(consultationNumber(url)).toBe(number)
    expect(consultationNumber(number)).toBe(number)
    expect((await getPublicProtocolSummary(url)).number).toBe(number)
    expect(() => consultationNumber(url.replace('/saomateusdomaranhao/', '/outraprefeitura/'))).toThrow('desta prefeitura')
  })

  it('isola a consulta da prefeitura e trata números ausentes ou inexistentes', async () => {
    const db = loadDb()
    await expect(getPublicProtocolSummary('INEXISTENTE')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(getPublicProtocolSummary('')).rejects.toMatchObject({ code: 'VALIDATION' })
    activateTenant({ id: 'prefeitura-outra', slug: 'outra', name: 'Outra', city: 'Outra', state: 'MA', abbreviation: 'PO' })
    const other = loadDb(); other.protocols = []; saveDb(other)
    await expect(getPublicProtocolSummary(db.protocols[0].number)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(() => consultationNumber('a'.repeat(2049))).toThrow()
  })
})
