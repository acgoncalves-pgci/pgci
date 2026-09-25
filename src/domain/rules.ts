import type { AppDocument, AppUser, Context, Database, Protocol, ProtocolType, Role, UserUnitMembership } from './model'
import { isActive } from './model'

export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export const fail = (code: string, message: string): never => {
  throw new DomainError(code, message)
}

export const getUser = (db: Database, id: string) =>
  db.users.find((user) => user.id === id) ?? fail('NOT_FOUND', 'Usuário não encontrado.')

export const getProtocol = (db: Database, id: string) =>
  db.protocols.find((protocol) => protocol.id === id) ?? fail('NOT_FOUND', 'Processo não encontrado.')

export const getAssignment = (db: Database, protocol: Protocol) =>
  db.assignments.find((assignment) => assignment.id === protocol.currentAssignmentId) ??
  fail('INVALID_STATE', 'Atribuição atual não encontrada.')

const isMembershipCurrent = (membership: UserUnitMembership, now = new Date()) =>
  membership.active &&
  new Date(membership.startsAt) <= now &&
  (!membership.endsAt || new Date(membership.endsAt) >= now)

export const findActiveMembershipForUnit = (db: Database, userId: string, unitId: string) =>
  db.memberships.find(
    (membership) =>
      membership.userId === userId &&
      membership.unitId === unitId &&
      isMembershipCurrent(membership),
  )

export const findActiveMembership = (db: Database, ctx: Context) =>
  findActiveMembershipForUnit(db, ctx.userId, ctx.activeUnitId)

export const canReceiveWorkInUnit = (db: Database, userId: string, unitId: string) => {
  const membership = findActiveMembershipForUnit(db, userId, unitId)
  return Boolean(membership && membership.role !== 'LEITOR')
}

export const canManageDocument = (db: Database, document: AppDocument, ctx: Context) => {
  if (!db.users.some((user) => user.id === ctx.userId && user.active)) return false
  if (document.protocolId) {
    const protocol = db.protocols.find((item) => item.id === document.protocolId)
    return Boolean(protocol && isActive(protocol) && canAct(db, protocol, ctx))
  }
  return canReceiveWorkInUnit(db, ctx.userId, document.unitId)
}

export const canOpenProtocolType = (db: Database, type: ProtocolType, ctx: Context) => {
  const authorizedUserIds = type.authorizedUserIds ?? []
  const authorizedUnitIds = type.authorizedUnitIds ?? []
  if (!authorizedUserIds.length && !authorizedUnitIds.length) return true
  if (authorizedUserIds.includes(ctx.userId)) return true
  return authorizedUnitIds.includes(ctx.activeUnitId) && Boolean(findActiveMembershipForUnit(db, ctx.userId, ctx.activeUnitId))
}

export const requireActiveMembership = (db: Database, ctx: Context) =>
  findActiveMembership(db, ctx) ??
  fail('FORBIDDEN', 'Você não possui vínculo ativo com a unidade selecionada.')

export const requireOperationalMembership = (db: Database, ctx: Context) => {
  const membership = requireActiveMembership(db, ctx)
  if (membership.role === 'LEITOR')
    fail('FORBIDDEN', 'Seu vínculo com a unidade selecionada permite somente leitura.')
  return membership
}

export const roleForContext = (db: Database, ctx: Context): Role =>
  requireActiveMembership(db, ctx).role

export const requireVersion = (protocol: Protocol, expected: number) => {
  if (protocol.version !== expected)
    fail('CONFLICT', 'Este processo mudou. Atualize a tela antes de continuar.')
}

export const requireActive = (protocol: Protocol) => {
  if (!isActive(protocol))
    fail('INVALID_STATE', 'Ação disponível apenas para processos ativos.')
}

export const unitIdsForScope = (db: Database, ctx: Context) => {
  if (ctx.scopeUnitId !== 'ALL') return [ctx.activeUnitId]
  const now = new Date()
  return db.memberships
    .filter((membership) => membership.userId === ctx.userId && isMembershipCurrent(membership, now))
    .map((membership) => membership.unitId)
}

export const hasParticipated = (db: Database, protocol: Protocol, userId: string) =>
  db.events.some(
    (event) =>
      event.protocolId === protocol.id &&
      (event.actorUserId === userId || event.toUserId === userId || event.fromUserId === userId),
  )

export const canView = (db: Database, protocol: Protocol, ctx: Context) => {
  const user = getUser(db, ctx.userId)
  const unitIds = unitIdsForScope(db, ctx)
  const memberships = db.memberships.filter(
    (membership) =>
      membership.userId === ctx.userId &&
      unitIds.includes(membership.unitId) &&
      isMembershipCurrent(membership),
  )
  if (!memberships.length) return false
  const participated = hasParticipated(db, protocol, user.id)
  if (ctx.scopeUnitId && ctx.scopeUnitId !== 'ALL')
    return unitIds.includes(protocol.currentUnitId) || participated
  if (memberships.some((membership) => membership.role === 'ADMIN') || unitIds.includes(protocol.currentUnitId) || protocol.createdById === user.id)
    return true
  return participated
}

export const canAct = (db: Database, protocol: Protocol, ctx: Context) => {
  const user = getUser(db, ctx.userId)
  const membership = findActiveMembership(db, ctx)
  if (!user.active || !membership || membership.role === 'LEITOR') return false
  return (
    (membership.role === 'ADMIN' && ctx.activeUnitId === protocol.currentUnitId) ||
    (ctx.activeUnitId === protocol.currentUnitId && protocol.currentAssigneeId === user.id)
  )
}

export const assertActorUnit = (user: AppUser, ctx: Context, db?: Database) => {
  if (db) {
    requireActiveMembership(db, ctx)
    return
  }
  if (user.unitId !== ctx.activeUnitId)
    fail('FORBIDDEN', 'Seu contexto ativo deve corresponder à sua unidade.')
}

export const requireActor = (db: Database, ctx: Context) => {
  const user = getUser(db, ctx.userId)
  if (!user.active)
    fail('FORBIDDEN', 'Usuário inativo não pode executar esta ação.')
  if (!db.units.some((unit) => unit.id === ctx.activeUnitId && unit.active))
    fail('FORBIDDEN', 'Selecione uma unidade ativa para continuar.')
  assertActorUnit(user, ctx, db)
  return user
}

export const requireAdmin = (db: Database, ctx: Context) => {
  const user = requireActor(db, ctx)
  if (roleForContext(db, ctx) !== 'ADMIN')
    fail('FORBIDDEN', 'Apenas administradores podem executar esta ação.')
  return user
}

export const isOverdue = (protocol: Protocol, now = new Date()) =>
  isActive(protocol) && !!protocol.dueAt && new Date(protocol.dueAt) < now

export const isDueSoon = (protocol: Protocol, now = new Date()) =>
  !!protocol.dueAt &&
  isActive(protocol) &&
  new Date(protocol.dueAt) >= now &&
  new Date(protocol.dueAt).getTime() <= now.getTime() + 86400000

export const requireAssignmentReceived = (db: Database, protocol: Protocol) => {
  if (!getAssignment(db, protocol).receivedAt)
    fail('ACK_REQUIRED', 'É necessário registrar ciência da atribuição atual.')
}
