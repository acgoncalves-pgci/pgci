import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  Download,
  FileUp,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import type { AppUser, Database, Role, UserUnitMembership } from '../../domain/model';
import type { Permission } from '../../domain/permissions';
import { defaultPermissions, hasPermission, profileIdForRole } from '../../domain/permissions';
import { sortUnitsByPath, unitPath } from '../../domain/units';
import { api } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll, useDb } from '../../app/queries';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { CpfInput } from '../../components/ui/CpfInput';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback';
import { ListPagination, paginateItems } from '../../components/ui/ListPagination';
import { parseUserCsv } from '../../lib/userCsv';
import type { UserImportResult } from '../../lib/userCsv';
import { PermissionGrid } from './PermissionGrid';

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
  LEITOR: 'Leitor',
};

const roleStyles: Record<Role, string> = {
  ADMIN: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
  GESTOR: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  OPERADOR: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  LEITOR: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

const membershipCount = (db: Database, userId: string) =>
  db.memberships.filter((membership) => membership.userId === userId && membership.active).length;

export function UsersPage() {
  const ctx = useSession();
  const { data: db, isLoading } = useDb();
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [role, setRole] = useState<'all' | Role>('all');

  const users = useMemo(() => {
    if (!db) return [];
    const query = normalize(search.trim());
    return db.users
      .filter((user) => {
        const matchesQuery = !query || normalize(user.name + ' ' + user.email + ' ' + (user.cpf ?? '')).includes(query);
        const matchesStatus = status === 'all' || (status === 'active' ? user.active : !user.active);
        const matchesRole = role === 'all' || user.role === role;
        return matchesQuery && matchesStatus && matchesRole;
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }, [db, role, search, status]);
  const paginated = paginateItems(users, page);

  if (isLoading || !db) return <Loading variant="list" />;

  const canCreate = hasPermission(db, ctx, 'users.create');
  const canAssign = hasPermission(db, ctx, 'users.assign');
  const canEdit = hasPermission(db, ctx, 'users.edit');
  const canManageProfiles = hasPermission(db, ctx, 'profiles.manage');

  return (
    <div className="mx-auto max-w-7xl">
      <PageTitle title="Usuários" detail="Usuários com acesso ao sistema desta entidade." icon={Users} action={(canCreate || canManageProfiles) && <div className="flex flex-wrap items-center gap-2">
          {canManageProfiles && <Link className="btn-secondary self-start" to="/perfis"><ShieldCheck size={16} /> Perfis de acesso</Link>}
          {canCreate && <button className="btn-secondary self-start" onClick={() => setImporting(true)}><FileUp size={16} /> Importar CSV</button>}
          {canCreate && canAssign && <button className="btn-primary self-start" onClick={() => setEditing('new')}><Plus size={16} /> Novo usuário</button>}
        </div>} />

      <section className="mb-5 space-y-3" aria-label="Busca e filtros de usuários">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input
              aria-label="Buscar usuários"
              className="!mt-0 pl-9"
              placeholder="Nome, e-mail ou CPF..."
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </label>
          <button type="button" className="btn-secondary self-start" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((current) => !current)}>
            <SlidersHorizontal size={16} /> Mais filtros
          </button>
        </div>
        {filtersOpen && (
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900/60">
            <Field label="Situação">
              <Select aria-label="Filtrar usuários por situação" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </Select>
            </Field>
            <Field label="Perfil principal">
              <Select aria-label="Filtrar usuários por perfil" value={role} onChange={(event) => { setRole(event.target.value as typeof role); setPage(1); }}>
                <option value="all">Todos os perfis</option>
                <option value="ADMIN">Administrador</option>
                <option value="GESTOR">Gestor</option>
                <option value="OPERADOR">Operador</option>
                <option value="LEITOR">Leitor</option>
              </Select>
            </Field>
          </div>
        )}
      </section>

      {users.length ? (
        <section className="space-y-2" aria-label="Lista de usuários">
          {paginated.items.map((user) => {
            const units = membershipCount(db, user.id);
            const primaryAccess = db.memberships.find((membership) => membership.userId === user.id && membership.unitId === user.unitId && membership.active);
            const primaryProfile = db.profiles.find((profile) => profile.id === primaryAccess?.profileId);
            return (
              <article className="flex min-h-[4.15rem] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-[color-mix(in_srgb,var(--ui-accent)_40%,#cbd5e1)] dark:border-slate-700 dark:bg-slate-900/70" key={user.id}>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[var(--ui-accent)]">
                  <UserRound size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-bold">{user.name}</h2>
                    {!user.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">Inativo</span>}
                    {!units && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-200">Sem unidade</span>}
                    <span className={'rounded-full border px-2 py-0.5 text-[10px] font-bold ' + roleStyles[user.role]}>{primaryProfile?.name ?? roleLabels[user.role]}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to={'/usuarios/' + user.id + '/unidades'}
                    className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold transition-colors hover:border-[var(--ui-accent)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_8%,transparent)] hover:text-[var(--ui-accent)] dark:border-slate-700"
                    aria-label={'Gerenciar unidades de ' + user.name}
                  >
                    <ShieldCheck size={15} />
                    <span className="hidden sm:inline">Unidades</span>
                    <span className="grid min-w-5 place-items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-100">{units}</span>
                    <ChevronRight size={14} />
                  </Link>
                  {canEdit && (
                    <button type="button" className="btn-secondary !min-h-9 !p-2" aria-label={'Editar usuário ' + user.name} onClick={() => setEditing(user)}>
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <Empty title="Nenhum usuário encontrado" detail="Ajuste a busca ou os filtros para localizar outros usuários." />
      )}
      <ListPagination page={paginated.page} total={paginated.total} onPage={setPage} label="usuários" />

      {editing && (
        <UserEditor
          user={editing === 'new' ? undefined : editing}
          db={db}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
      {importing && <UserImportDialog db={db} onClose={() => setImporting(false)} />}
    </div>
  );
}

export function UserAccessPage() {
  const { id: userId = '' } = useParams();
  const ctx = useSession();
  const client = useQueryClient();
  const { data: db, isLoading } = useDb();
  const [editing, setEditing] = useState<UserUnitMembership | 'new' | null>(null);
  const [removing, setRemoving] = useState<UserUnitMembership | null>(null);

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => api.removeUserMembership(ctx, userId, membershipId),
    onSuccess: () => {
      invalidateAll(client);
      setRemoving(null);
    },
  });

  if (isLoading || !db) return <Loading variant="detail" />;
  const user = db.users.find((item) => item.id === userId);
  if (!user) return <Empty title="Usuário não encontrado" detail="Volte para a lista e selecione um usuário válido." action={<Link className="btn-secondary" to="/usuarios">Voltar para usuários</Link>} />;

  const memberships = db.memberships
    .filter((membership) => membership.userId === user.id && membership.active)
    .sort((left, right) => unitPath(db.units, left.unitId).localeCompare(unitPath(db.units, right.unitId), 'pt-BR'));
  const linkedUnitIds = new Set(memberships.map((membership) => membership.unitId));
  const canAdd = db.units.some((unit) => unit.active && !linkedUnitIds.has(unit.id));
  const canAssign = hasPermission(db, ctx, 'users.assign');

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5">
        <PageTitle title={`Unidades / Permissões — ${user.name}`} detail="Unidades organizacionais em que este usuário atua e o papel definido em cada uma." icon={ShieldCheck} action={<Link className="btn-secondary !p-2" aria-label="Voltar para usuários" to="/usuarios"><ArrowLeft size={17} /></Link>} />
        <nav className="mt-5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-label="Navegação estrutural">
          <Link className="hover:text-[var(--ui-accent)]" to="/usuarios">Usuários</Link>
          <ChevronRight size={13} />
          <span>{user.name}</span>
          <ChevronRight size={13} />
          <strong className="text-slate-700 dark:text-slate-200">Unidades / Permissões</strong>
        </nav>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70" aria-label="Unidades e permissões">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide"><ShieldCheck size={15} /> Unidades / Permissões</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Gerencie os acessos do usuário sem alterar as movimentações já registradas.</p>
          </div>
          {canAssign && (
            <button type="button" className="btn-primary self-start" disabled={!canAdd} title={canAdd ? undefined : 'Todas as unidades ativas já foram vinculadas'} onClick={() => setEditing('new')}>
              <Plus size={16} /> Adicionar unidade
            </button>
          )}
        </div>

        <div className="space-y-2">
          {memberships.map((membership) => {
            const unit = db.units.find((item) => item.id === membership.unitId);
            const parent = db.units.find((item) => item.id === unit?.parentId);
            return (
              <article key={membership.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center dark:border-slate-700">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[var(--ui-accent)]">
                  <Building2 size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold">{unit?.name ?? 'Unidade indisponível'}</h3>
                    {unit && <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-bold dark:border-slate-700">{unit.abbreviation}</span>}
                    {membership.unitId === user.unitId && <span className="rounded-full bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] px-2 py-0.5 text-[9px] font-bold text-[var(--ui-accent)]">Principal</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{membership.title || db.profiles.find((profile) => profile.id === membership.profileId)?.name || roleLabels[membership.role]}{parent ? ' · ' + parent.name : ''}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <CalendarDays size={11} /> Desde {new Date(membership.startsAt).toLocaleDateString('pt-BR')}
                    <span className={'ml-1 rounded-full border px-2 py-0.5 font-bold ' + roleStyles[membership.role]}>{db.profiles.find((profile) => profile.id === membership.profileId)?.name ?? roleLabels[membership.role]}</span>
                  </p>
                </div>
                {canAssign && (
                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    <button type="button" className="btn-secondary !min-h-9 !p-2" aria-label={'Editar acesso à ' + (unit?.name ?? 'unidade')} onClick={() => setEditing(membership)}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="btn-secondary !min-h-9 !p-2 text-red-600 dark:text-red-400" aria-label={'Remover acesso à ' + (unit?.name ?? 'unidade')} onClick={() => setRemoving(membership)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {editing && (
        <AccessEditor
          user={user}
          membership={editing === 'new' ? undefined : editing}
          db={db}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
      {removing && (
        <Dialog title="Remover acesso à unidade?" onClose={() => setRemoving(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            O usuário deixará de atuar em <strong>{db.units.find((unit) => unit.id === removing.unitId)?.name}</strong>. Os registros anteriores serão preservados.
          </p>
          {removeMutation.error && <div className="mt-4"><ErrorBox error={removeMutation.error} /></div>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRemoving(null)}>Cancelar</button>
            <button type="button" className="btn bg-red-600 text-white hover:bg-red-700" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(removing.id)}>Remover acesso</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function UserEditor({ user, db, onClose, onSaved }: {
  user?: AppUser;
  db: Database;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ctx = useSession();
  const client = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const availableUnits = sortUnitsByPath(db.units.filter((unit) => unit.active));
  const [unitId, setUnitId] = useState(availableUnits[0]?.id ?? '');
  const [profileId, setProfileId] = useState(profileIdForRole('OPERADOR'));
  const [permissions, setPermissions] = useState<Permission[]>(defaultPermissions('OPERADOR'));
  const selectedProfile = db.profiles.find((profile) => profile.id === profileId);
  const [cpf, setCpf] = useState(user?.cpf ?? '');
  const [createPerson, setCreatePerson] = useState(false);
  const [active, setActive] = useState(user?.active ?? true);
  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, email, role: user?.role ?? (selectedProfile?.isAdmin ? 'ADMIN' : 'OPERADOR'), cpf, active, createPerson: !user && createPerson };
      return user ? api.updateUser(ctx, user.id, input) : api.createUser(ctx, { ...input, access: { unitId, profileId, permissions } });
    },
    onSuccess: () => {
      invalidateAll(client);
      onSaved();
    },
  });

  return (
    <Dialog title={user ? 'Editar usuário' : 'Novo usuário'} onClose={onClose} wide={!user}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <Input aria-label="Nome do usuário" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Ex.: Maria da Silva" />
          </Field>
          <Field label="E-mail *">
            <Input aria-label="E-mail do usuário" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="nome@exemplo.com.br" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CPF (opcional)">
            <CpfInput aria-label="CPF do usuário" defaultValue={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" />
          </Field>
        </div>
        {!user && <>
          <Field label="Unidade organizacional *"><Select aria-label="Unidade organizacional" value={unitId} onChange={(event) => setUnitId(event.target.value)}>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unitPath(db.units, unit.id)}</option>)}</Select></Field>
          <Field label="Perfil nesta unidade *"><Select aria-label="Perfil nesta unidade" value={profileId} onChange={(event) => { const profile = db.profiles.find((item) => item.id === event.target.value); if (profile) { setProfileId(profile.id); setPermissions([...profile.permissions]); } }}>{db.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</Select></Field>
          {selectedProfile?.isAdmin ? <p className="text-sm text-violet-700 dark:text-violet-300">Administrador: todas as permissões nesta unidade.</p> : <div className="max-h-[45vh] overflow-y-auto pr-1"><PermissionGrid value={permissions} onChange={setPermissions}/></div>}
        </>}
        {!user && <>
          <label className="flex items-center gap-2 text-sm"><Switch checked={createPerson} onCheckedChange={setCreatePerson} aria-label="Criar pessoa" /> Criar pessoa com o mesmo nome</label>
        </>}
        {user && <label className="flex items-center gap-2 text-sm"><Switch checked={active} disabled={user.id === ctx.userId || user.id === 'usr-admin'} onCheckedChange={setActive} /> Usuário ativo</label>}
        {mutation.error && <ErrorBox error={mutation.error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={mutation.isPending || !name.trim() || !email.trim() || (!user && !unitId)}>Salvar</button>
        </div>
      </form>
    </Dialog>
  );
}

function UserImportDialog({ db, onClose }: { db: Database; onClose: () => void }) {
  const ctx = useSession();
  const client = useQueryClient();
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState<UserImportResult | null>(null);
  const [fileError, setFileError] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.importUsers(ctx, result?.rows ?? []),
    onSuccess: () => { invalidateAll(client); onClose(); },
  });

  const readFile = async (file?: File) => {
    setResult(null);
    setFileError('');
    setFilename(file?.name ?? '');
    if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith('.csv')) { setFileError('Selecione um arquivo .csv.'); return; }
    if (file.size > 1024 * 1024) { setFileError('O arquivo deve ter no máximo 1 MB.'); return; }
    try { setResult(parseUserCsv(await file.text(), db)); }
    catch { setFileError('Não foi possível ler o arquivo CSV.'); }
  };

  return <Dialog title="Importar usuários por CSV" onClose={onClose} wide>
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Cadastre até 1000 usuários por vez. Use <strong>sim</strong> ou <strong>não</strong> em ativo e criar_pessoa. A unidade será atribuída depois no botão <strong>Unidades</strong>.</p>
      <a className="btn-secondary inline-flex" href="/examples/usuarios.csv" download="usuarios.csv"><Download size={16} /> Baixar CSV de exemplo</a>
      <Field label="Arquivo CSV *">
        <Input aria-label="Arquivo CSV" type="file" accept=".csv,text/csv" onChange={(event) => { void readFile(event.target.files?.[0]); }} />
      </Field>
      {filename && <p className="text-xs text-slate-500 dark:text-slate-400">Arquivo: {filename}</p>}
      {fileError && <ErrorBox error={new Error(fileError)} />}
      {result && <>
        <p className="text-sm font-semibold">{result.rows.length} usuário(s) encontrado(s) · {result.errors.length} erro(s)</p>
        {result.errors.length > 0 && <div role="alert" className="max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <ul className="list-inside list-disc space-y-1">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>
        </div>}
        {result.rows.length > 0 && <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800"><tr>{['Linha', 'Nome', 'E-mail', 'Perfil', 'CPF', 'Ativo', 'Criar pessoa'].map((heading) => <th className="px-3 py-2" key={heading}>{heading}</th>)}</tr></thead>
            <tbody>{result.rows.slice(0, 20).map((row) => <tr key={row.line} className="border-t border-slate-200 dark:border-slate-700"><td className="px-3 py-2">{row.line}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.role}</td><td className="px-3 py-2">{row.cpf || '—'}</td><td className="px-3 py-2">{row.active ? 'Sim' : 'Não'}</td><td className="px-3 py-2">{row.createPerson ? 'Sim' : 'Não'}</td></tr>)}</tbody>
          </table>
        </div>}
        {result.rows.length > 20 && <p className="text-xs text-slate-500">Mostrando as primeiras 20 linhas. Todas serão validadas e importadas.</p>}
      </>}
      {mutation.error && <ErrorBox error={mutation.error} />}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="btn-primary" disabled={mutation.isPending || !result?.rows.length || Boolean(result.errors.length)} onClick={() => mutation.mutate()}>Importar usuários</button></div>
    </div>
  </Dialog>;
}

function AccessEditor({ user, membership, db, onClose, onSaved }: {
  user: AppUser;
  membership?: UserUnitMembership;
  db: Database;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ctx = useSession();
  const client = useQueryClient();
  const linkedUnitIds = new Set(db.memberships.filter((item) => item.userId === user.id && item.active && item.id !== membership?.id).map((item) => item.unitId));
  const availableUnits = sortUnitsByPath(db.units.filter((unit) => unit.active && !linkedUnitIds.has(unit.id)));
  const [unitId, setUnitId] = useState(membership?.unitId ?? availableUnits[0]?.id ?? '');
  const [profileId, setProfileId] = useState(membership?.profileId ?? profileIdForRole(membership?.role ?? user.role));
  const [permissions, setPermissions] = useState<Permission[]>(membership?.permissions ?? defaultPermissions(membership?.role ?? user.role));
  const selectedProfile = db.profiles.find((profile) => profile.id === profileId);
  const [title, setTitle] = useState(membership?.title === db.profiles.find((profile) => profile.id === membership?.profileId)?.name ? '' : membership?.title ?? '');
  const mutation = useMutation({
    mutationFn: () => api.saveUserMembership(ctx, user.id, membership?.id, { unitId, profileId, permissions, title }),
    onSuccess: () => {
      invalidateAll(client);
      onSaved();
    },
  });

  return (
    <Dialog title={membership ? 'Editar acesso à unidade' : 'Adicionar unidade'} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <Field label="Unidade organizacional *">
          <Select aria-label="Unidade organizacional" value={unitId} disabled={Boolean(membership)} onChange={(event) => setUnitId(event.target.value)}>
            {availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unitPath(db.units, unit.id)}</option>)}
          </Select>
        </Field>
        <Field label="Perfil nesta unidade *"><Select aria-label="Perfil nesta unidade" value={profileId} onChange={(event) => { const profile = db.profiles.find((item) => item.id === event.target.value); if (profile) { setProfileId(profile.id); setPermissions([...profile.permissions]); } }}>{db.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</Select></Field>
        <Field label="Cargo ou função">
          <Input aria-label="Cargo ou função" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selectedProfile?.name ?? 'Função na unidade'} />
        </Field>
        {selectedProfile?.isAdmin ? <p className="text-sm text-violet-700 dark:text-violet-300">Administrador: todas as permissões nesta unidade.</p> : <><p className="text-xs text-slate-500 dark:text-slate-400">O perfil preenche as permissões iniciais. Você pode adicionar ou remover permissões para esta unidade.</p><div className="max-h-[45vh] overflow-y-auto pr-1"><PermissionGrid value={permissions} onChange={setPermissions}/></div></>}
        {mutation.error && <ErrorBox error={mutation.error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={mutation.isPending || !unitId}>Salvar acesso</button>
        </div>
      </form>
    </Dialog>
  );
}
