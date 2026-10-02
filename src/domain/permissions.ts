import type { AccessProfile, Context, Database, Role, UserUnitMembership } from './model'

export const permissionGroups = [
  { label: 'Pessoas', items: [['people.view', 'Visualizar'], ['people.create', 'Criar'], ['people.edit', 'Editar']] },
  { label: 'Estrutura organizacional', items: [['structure.view', 'Ver unidades'], ['structure.create', 'Criar unidade'], ['structure.edit', 'Editar unidade'], ['structure.delete', 'Excluir unidade']] },
  { label: 'Usuários e permissões', items: [['users.view', 'Ver usuários'], ['users.create', 'Criar usuário'], ['users.edit', 'Editar usuário'], ['users.deactivate', 'Inativar usuário'], ['users.assign', 'Atribuir perfil e escopo'], ['profiles.manage', 'Gerenciar perfis']] },
  { label: 'Tipos de processo e fluxos', items: [['protocolTypes.view', 'Visualizar'], ['protocolTypes.create', 'Criar'], ['protocolTypes.edit', 'Editar'], ['protocolTypes.delete', 'Excluir']] },
  { label: 'Tipos de documento', items: [['documentTypes.view', 'Visualizar'], ['documentTypes.create', 'Criar'], ['documentTypes.edit', 'Editar']] },
  { label: 'Situações e fases', items: [['workflow.view', 'Visualizar'], ['workflow.create', 'Criar'], ['workflow.edit', 'Editar'], ['workflow.delete', 'Excluir']] },
  { label: 'Processos', items: [['processes.view', 'Visualizar'], ['processes.create', 'Criar'], ['processes.act', 'Movimentar'], ['processes.assign', 'Designar responsável'], ['processes.edit', 'Editar'], ['processes.delete', 'Excluir']] },
  { label: 'Documentos e anexos', items: [['documents.view', 'Visualizar'], ['documents.create', 'Criar'], ['documents.edit', 'Editar'], ['documents.delete', 'Excluir'], ['attachments.create', 'Anexar'], ['attachments.delete', 'Excluir anexo']] },
  { label: 'Relatórios', items: [['reports.view', 'Acessar relatórios'], ['reports.export', 'Exportar PDF'], ['reports.productivity', 'Ver produtividade']] },
  { label: 'Administração', items: [['settings.manage', 'Configurações'], ['audit.view', 'Ver auditoria']] },
] as const

export type Permission = (typeof permissionGroups)[number]['items'][number][0]
export const allPermissions: Permission[] = permissionGroups.flatMap((group) => group.items.map(([key]) => key))

const roleDefaults: Record<Role, Permission[]> = {
  ADMIN: allPermissions,
  GESTOR: ['people.view', 'structure.view', 'users.view', 'protocolTypes.view', 'documentTypes.view', 'workflow.view', 'processes.view', 'processes.create', 'processes.act', 'processes.assign', 'documents.view', 'documents.create', 'documents.edit', 'attachments.create', 'reports.view', 'reports.export', 'reports.productivity'],
  OPERADOR: ['people.view', 'structure.view', 'users.view', 'protocolTypes.view', 'documentTypes.view', 'workflow.view', 'processes.view', 'processes.create', 'processes.act', 'documents.view', 'documents.create', 'documents.edit', 'documents.delete', 'attachments.create', 'attachments.delete', 'reports.view', 'reports.export', 'reports.productivity', 'audit.view'],
  LEITOR: ['people.view', 'structure.view', 'users.view', 'protocolTypes.view', 'documentTypes.view', 'workflow.view', 'processes.view', 'documents.view', 'reports.view'],
}

export const defaultPermissions = (role: Role): Permission[] => [...roleDefaults[role]]
export const defaultProfiles = (): AccessProfile[] => ([
  { id: 'profile-admin', name: 'Administrador', isAdmin: true, permissions: allPermissions, system: true },
  { id: 'profile-manager', name: 'Gestor', isAdmin: false, permissions: defaultPermissions('GESTOR'), system: true },
  { id: 'profile-operator', name: 'Operador', isAdmin: false, permissions: defaultPermissions('OPERADOR'), system: true },
  { id: 'profile-reader', name: 'Leitor', isAdmin: false, permissions: defaultPermissions('LEITOR'), system: true },
])
export const profileIdForRole = (role: Role): string => ({ ADMIN: 'profile-admin', GESTOR: 'profile-manager', OPERADOR: 'profile-operator', LEITOR: 'profile-reader' })[role]
export const validPermissions = (values: readonly string[]): values is Permission[] =>
  values.every((value) => allPermissions.includes(value as Permission))

export const effectivePermissions = (membership: UserUnitMembership): Permission[] =>
  membership.role === 'ADMIN' ? allPermissions : membership.permissions ?? defaultPermissions(membership.role)

export const hasPermission = (db: Database, ctx: Context, permission: Permission): boolean => {
  if (!db.users.some((user) => user.id === ctx.userId && user.active)) return false
  if (!db.units.some((unit) => unit.id === ctx.activeUnitId && unit.active)) return false
  const now = Date.now()
  const membership = db.memberships.find((item) => item.userId === ctx.userId && item.unitId === ctx.activeUnitId && item.active && new Date(item.startsAt).getTime() <= now && (!item.endsAt || new Date(item.endsAt).getTime() >= now))
  return Boolean(membership && effectivePermissions(membership).includes(permission))
}
