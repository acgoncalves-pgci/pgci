import type { Protocol, ProtocolEvent } from './model'
import { isActive, isLegacyAssumptionEvent, isMovementEvent } from './model'

const closedKinds = new Set<ProtocolEvent['kind']>(['CONCLUSAO', 'ARQUIVAMENTO', 'REJEICAO', 'CANCELAMENTO'])
const timestamp = (value?: string | null) => value ? Date.parse(value) : NaN

export function isProtocolOverdue(protocol: Protocol, now = Date.now()): boolean {
  return isActive(protocol) && Boolean(protocol.dueAt && timestamp(protocol.dueAt) < now)
}

export function formatStageDuration(milliseconds: number): string {
  const minutes = Math.floor(Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 60_000)
  if (!minutes) return 'Menos de 1 min'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes / 60) % 24
  if (days >= 30) {
    const months = Math.floor(days / 30)
    return `${months} ${months === 1 ? 'mês' : 'meses'}${days % 30 ? ` ${days % 30} ${days % 30 === 1 ? 'dia' : 'dias'}` : ''}`
  }
  if (days) return `${days} ${days === 1 ? 'dia' : 'dias'}${hours ? ` ${hours} h` : ''}`
  const remainingMinutes = minutes % 60
  const totalHours = Math.floor(minutes / 60)
  return totalHours ? `${totalHours} h${remainingMinutes ? ` ${remainingMinutes} min` : ''}` : `${minutes} min`
}

export function protocolMovementTiming(protocol: Protocol, events: ProtocolEvent[], event: ProtocolEvent, now = Date.now()) {
  const movements = events.filter((item) => item.protocolId === protocol.id && isMovementEvent(item) && !isLegacyAssumptionEvent(events, item))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const index = movements.findIndex((item) => item.id === event.id)
  const closed = closedKinds.has(event.kind)
  // Encerramentos resumem a permanência da última etapa, sem contar o período parado até uma reabertura.
  let startIndex = index
  if (closed) while (startIndex > 0 && closedKinds.has(movements[startIndex].kind)) startIndex -= 1
  const start = movements[startIndex] ?? event
  const next = movements[index + 1]
  const firstClosure = closed ? movements.slice(startIndex, index + 1).find((item) => closedKinds.has(item.kind)) : undefined
  const running = !closed && !next && isActive(protocol)
  const startedAt = Number.isFinite(timestamp(start.createdAt)) ? start.createdAt : protocol.createdAt
  const endValue = closed ? firstClosure?.createdAt ?? event.createdAt : next?.createdAt ?? (!isActive(protocol) ? protocol.completedAt ?? protocol.archivedAt ?? protocol.updatedAt : undefined)
  const endedAt = Number.isFinite(timestamp(endValue)) ? endValue! : undefined
  const end = Math.max(timestamp(startedAt), endedAt ? timestamp(endedAt) : now)
  const dueAt = !next && !closed ? protocol.dueAt : event.dueAt === undefined && !next ? protocol.dueAt : event.dueAt ?? undefined
  const validDueAt = Number.isFinite(timestamp(dueAt)) ? dueAt : undefined
  return { startedAt, endedAt, running, duration: formatStageDuration(end - timestamp(startedAt)), dueAt: validDueAt, overdue: Boolean(validDueAt && timestamp(validDueAt) < end) }
}
