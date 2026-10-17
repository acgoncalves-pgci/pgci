import { describe, expect, it } from 'vitest'
import type { ProtocolBatch } from '../../domain/model'
import { seedDatabase } from '../../mocks/seed'
import { batchReceiptData, batchReceiptDate } from './batchReceipt'

function fixture() {
  const db = seedDatabase()
  const protocol = db.protocols[0]
  const batch: ProtocolBatch = { id: 'receipt-batch', number: '2026.000001', actorUserId: 'usr-clara', actorUnitId: 'u-prot', createdAt: protocol.createdAt, typeIds: [protocol.typeId, 'pt-admin'], phaseId: 'phase-analysis', phaseName: 'Análise', unitId: 'u-accounting', unitName: 'Contabilidade', message: 'Conferir processos.', protocols: [{ protocolId: protocol.id, number: protocol.number, typeId: protocol.typeId, eventId: 'receipt-event', expectedVersion: 1 }] }
  return { db, protocol, batch }
}

describe('dados do comprovante de lote', () => {
  it('lê lotes antigos e inclui somente tipos dos processos efetivamente tramitados', () => {
    const { db, protocol, batch } = fixture()
    const data = batchReceiptData(db, batch)
    expect(data.actor).toBe('Clara Nunes')
    expect(data.recipient).toBe('Fila da unidade')
    expect(data.destination).toBe('Administração / Financeiro / Contabilidade')
    expect(data.types).toEqual([db.protocolTypes.find((item) => item.id === protocol.typeId)!.name])
    expect(data.protocols).toEqual([{ number: protocol.number, createdAt: protocol.createdAt, description: protocol.description }])
  })

  it('preserva as informações históricas mesmo que usuários, unidades, tipos e processos sejam alterados ou removidos', () => {
    const { db, batch } = fixture()
    batch.actorName = 'Responsável original'
    batch.assigneeName = 'Destinatário original'
    batch.destinationPath = 'Secretaria original / Setor original'
    batch.typeNames = ['Tipo original']
    batch.protocols[0].createdAt = '2026-09-20T04:15:58.000Z'
    batch.protocols[0].description = 'Descrição original com acentuação.'
    const before = batchReceiptData(db, batch)
    db.users = []; db.units = []; db.protocolTypes = []; db.protocols = []
    expect(batchReceiptData(db, batch)).toEqual(before)
  })

  it('mantém número e contagem de processos antigos removidos, sem inventar datas ou descrições', () => {
    const { db, batch } = fixture()
    db.protocols = []
    expect(batchReceiptData(db, batch).protocols).toEqual([{ number: batch.protocols[0].number, createdAt: undefined, description: 'Não informado' }])
    expect(batchReceiptDate(undefined)).toBe('Não informado')
    expect(batchReceiptDate('inválido')).toBe('Não informado')
    expect(batchReceiptDate('2026-09-20T04:15:58.000Z')).toMatch(/20\/09\/2026, \d{2}:15:58/)
  })
})
