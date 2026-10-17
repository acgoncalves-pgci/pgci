import type { Database, ProtocolBatch } from '../../domain/model'
import { unitPath } from '../../domain/units'

export function batchReceiptData(db: Database, batch: ProtocolBatch) {
  return {
    number: batch.number,
    createdAt: batch.createdAt,
    types: batch.typeNames ?? [...new Set(batch.protocols.map((item) => db.protocolTypes.find((type) => type.id === item.typeId)?.name ?? 'Tipo não informado'))],
    actor: batch.actorName ?? db.users.find((user) => user.id === batch.actorUserId)?.name ?? 'Não informado',
    recipient: batch.assigneeName ?? db.users.find((user) => user.id === batch.assigneeId)?.name ?? 'Fila da unidade',
    destination: batch.destinationPath ?? (db.units.some((unit) => unit.id === batch.unitId) ? unitPath(db.units, batch.unitId) : batch.unitName),
    message: batch.message,
    protocols: batch.protocols.map((item) => {
      const protocol = db.protocols.find((candidate) => candidate.id === item.protocolId)
      return { number: item.number, createdAt: item.createdAt ?? protocol?.createdAt, description: item.description ?? (protocol?.description || protocol?.subject || 'Não informado') }
    }),
  }
}

export function batchReceiptDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}
