import { describe, expect, it } from 'vitest'
import type { AuditEvent, ProtocolEvent } from './model'
import { protocolAuditEntries } from './protocolAudit'

const event: ProtocolEvent = { id: 'event-open', protocolId: 'process-1', kind: 'ABERTURA', actorUserId: 'user-1', actorUnitId: 'unit-1', message: 'Abertura registrada.', createdAt: '2026-10-16T12:00:00.000Z' }
const audit: AuditEvent = { id: 'audit-open', action: 'PROTOCOL_CREATED', targetType: 'PROTOCOL', targetId: 'process-1', actorUserId: 'user-1', actorUnitId: 'unit-1', details: 'Processo criado com assunto informado.', createdAt: '2026-10-16T12:00:00.010Z' }

describe('timeline compacta de auditoria', () => {
  it('apresenta um único item para a movimentação e sua auditoria, mantendo detalhes e atalho', () => {
    expect(protocolAuditEntries([event], [audit])).toEqual([expect.objectContaining({ id: 'audit-audit-open', label: 'Processo criado', details: `${audit.details} ${event.message}`, movementId: event.id })])
  })

  it('mantém os registros de outra pessoa, unidade, processo ou horário separados', () => {
    for (const different of [{ ...audit, actorUserId: 'user-2' }, { ...audit, actorUnitId: 'unit-2' }, { ...audit, targetId: 'process-2' }, { ...audit, createdAt: '2026-10-16T12:00:10.000Z' }]) {
      expect(protocolAuditEntries([event], [different])).toHaveLength(2)
    }
  })

  it('não agrupa duas movimentações diferentes no mesmo registro', () => {
    const next = { ...event, id: 'event-next', createdAt: '2026-10-16T12:00:00.020Z' }
    const entries = protocolAuditEntries([event, next], [audit])
    expect(entries).toHaveLength(2)
    expect(entries.map((item) => item.movementId)).toEqual(expect.arrayContaining([event.id, next.id]))
  })

  it('preserva o identificador do anexo ao agrupar registros legados cujo alvo é o processo', () => {
    const attachmentEvent = { ...event, kind: 'ANEXO_ADICIONADO' as const, relatedAttachmentId: 'attachment-1' }
    const attachmentAudit = { ...audit, action: 'ATTACHMENT_ADDED' }
    expect(protocolAuditEntries([attachmentEvent], [attachmentAudit])).toEqual([expect.objectContaining({ attachmentId: 'attachment-1', label: 'Arquivo anexado' })])
  })

  it('mantém auditorias sem movimentação associada e ordena as mais recentes primeiro', () => {
    const update = { ...audit, id: 'audit-update', action: 'ATTACHMENT_UPDATED', targetType: 'ATTACHMENT' as const, targetId: 'attachment-1', createdAt: '2026-10-16T12:01:00.000Z' }
    const entries = protocolAuditEntries([event], [audit, update])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ action: 'ATTACHMENT_UPDATED', attachmentId: 'attachment-1' })
  })
})
