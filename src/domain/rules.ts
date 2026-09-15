import type { AppUser, Context, Database, Protocol } from './model'
import { isActive } from './model'

export class DomainError extends Error { constructor(public code: string, message: string) { super(message) } }
export const getUser = (db: Database, id: string) => db.users.find((u) => u.id === id) ?? fail('NOT_FOUND', 'Usuário não encontrado.')
export const getProtocol = (db: Database, id: string) => db.protocols.find((p) => p.id === id) ?? fail('NOT_FOUND', 'Protocolo não encontrado.')
export const getAssignment = (db: Database, protocol: Protocol) => db.assignments.find((a) => a.id === protocol.currentAssignmentId) ?? fail('INVALID_STATE', 'Atribuição atual não encontrada.')
export const fail = (code: string, message: string): never => { throw new DomainError(code, message) }
export const requireVersion = (p: Protocol, expected: number) => { if (p.version !== expected) fail('CONFLICT', 'Este protocolo mudou. Atualize a tela antes de continuar.') }
export const requireActive = (p: Protocol) => { if (!isActive(p)) fail('INVALID_STATE', 'Ação disponível apenas para protocolos ativos.') }
export const canView = (db: Database, p: Protocol, ctx: Context) => {
  const user = getUser(db, ctx.userId)
  if (user.role === 'ADMIN' || p.currentUnitId === user.unitId || p.createdById === user.id) return true
  return db.events.some((e) => e.protocolId === p.id && (e.actorUserId === user.id || e.toUserId === user.id || e.fromUserId === user.id))
}
export const canAct = (db: Database, p: Protocol, ctx: Context) => {
  const u = getUser(db, ctx.userId)
  return u.active && ((u.role === 'ADMIN' && ctx.activeUnitId === p.currentUnitId) || (u.unitId === ctx.activeUnitId && p.currentAssigneeId === u.id))
}
export const assertActorUnit = (user: AppUser, ctx: Context) => { if (user.role !== 'ADMIN' && user.unitId !== ctx.activeUnitId) fail('FORBIDDEN', 'Seu contexto ativo deve corresponder à sua unidade.') }
export const requireActor = (db: Database, ctx: Context) => {
  const user = getUser(db, ctx.userId)
  if (!user.active) fail('FORBIDDEN', 'Usuário inativo não pode executar esta ação.')
  if (!db.units.some((unit) => unit.id === ctx.activeUnitId && unit.active)) fail('FORBIDDEN', 'Selecione uma unidade ativa para continuar.')
  assertActorUnit(user, ctx)
  return user
}
export const requireAdmin = (db: Database, ctx: Context) => {
  const user = requireActor(db, ctx)
  if (user.role !== 'ADMIN') fail('FORBIDDEN', 'Apenas administradores podem executar esta ação.')
  return user
}
export const isOverdue = (p: Protocol, now = new Date()) => isActive(p) && !!p.dueAt && new Date(p.dueAt) < now
export const isDueSoon = (p: Protocol, now = new Date()) => !!p.dueAt && isActive(p) && new Date(p.dueAt) >= now && new Date(p.dueAt).getTime() <= now.getTime() + 86400000
export const requireAssignmentReceived = (db: Database, p: Protocol) => { if (!getAssignment(db, p).receivedAt) fail('ACK_REQUIRED', 'É necessário registrar ciência da atribuição atual.') }
