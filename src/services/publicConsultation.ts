import type { Database } from '../domain/model'
import { eventLabel, isMovementEvent, statusLabel } from '../domain/model'
import { DomainError } from '../domain/rules'
import { currentProtocolSituation } from '../domain/situations'
import { readInstitutionSettings } from '../lib/institution'
import { getActiveTenant, tenantPath } from '../saas/tenants'
import { loadDb } from '../storage/database'

export function consultationNumber(reference: string) {
  const value = reference.trim()
  if (value.length > 2048) throw new DomainError('VALIDATION', 'Informe um número de protocolo válido.')
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    if (url.pathname.replace(/\/$/, '') !== tenantPath('/consulta'))
      throw new DomainError('VALIDATION', 'Este código não corresponde à consulta desta prefeitura.')
    return (url.searchParams.get('numero') ?? '').trim()
  }
  return value
}

export function publicProtocolSummary(db: Database, reference: string) {
  const number = consultationNumber(reference)
  if (!number || number.length > 80) throw new DomainError('VALIDATION', 'Informe um número de protocolo válido.')
  const protocol = db.protocols.find((item) => item.number === number)
  if (!protocol) throw new DomainError('NOT_FOUND', 'Protocolo não encontrado nesta prefeitura. Confira o código e tente novamente.')
  const phaseName = (phaseId?: string) => protocol.flowSnapshot?.phases.find((phase) => phase.phaseId === phaseId)?.name ?? db.phases.find((phase) => phase.id === phaseId)?.name
  const unitName = (unitId?: string) => db.units.find((unit) => unit.id === unitId)?.name ?? 'Não informado'
  // Explicit projection: no personal identifiers, file contents or internal notes.
  return {
    number: protocol.number, subject: protocol.subject, description: protocol.description,
    type: db.protocolTypes.find((type) => type.id === protocol.typeId)?.name ?? 'Não informado',
    situation: currentProtocolSituation(db, protocol)?.name ?? statusLabel[protocol.status],
    phase: phaseName(protocol.currentPhaseId), unit: unitName(protocol.currentUnitId),
    createdAt: protocol.createdAt, updatedAt: protocol.updatedAt, dueAt: protocol.dueAt,
    history: db.events.filter((event) => event.protocolId === protocol.id && isMovementEvent(event))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((event) => ({ action: eventLabel[event.kind], createdAt: event.createdAt, unit: unitName(event.toUnitId ?? event.actorUnitId), phase: phaseName(event.phaseId) })),
  }
}

export async function getPublicProtocolSummary(reference: string) {
  if (readInstitutionSettings().publicConsultation === false)
    throw new DomainError('FORBIDDEN', 'A consulta pública está desativada para esta prefeitura.')
  const db = loadDb()
  const tenant = getActiveTenant()
  if (tenant && db.organization.id !== tenant.id) throw new DomainError('FORBIDDEN', 'Consulta indisponível para esta prefeitura.')
  return publicProtocolSummary(db, reference)
}
