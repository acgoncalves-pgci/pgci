import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import type { AccessProfile } from '../../domain/model'
import type { Permission } from '../../domain/permissions'
import { allPermissions, hasPermission } from '../../domain/permissions'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { Dialog, DialogBody, DialogFooter } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import { Switch } from '../../components/ui/Switch'
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback'
import { PermissionGrid } from './PermissionGrid'

export function ProfilesPage() {
  const ctx = useSession()
  const client = useQueryClient()
  const { data: db, isLoading } = useDb()
  const [editing, setEditing] = useState<AccessProfile | 'new' | null>(null)
  const [removing, setRemoving] = useState<AccessProfile | null>(null)
  const remove = useMutation({ mutationFn: (profileId: string) => api.deleteProfile(ctx, profileId), onSuccess: () => { invalidateAll(client); setRemoving(null) } })
  if (isLoading || !db) return <Loading variant="list" />
  const canManage = hasPermission(db, ctx, 'profiles.manage')
  if (!canManage) return <Empty title="Acesso restrito" detail="Você não possui permissão para gerenciar perfis nesta unidade." />
  return <div className="mx-auto max-w-7xl">
    <PageTitle title="Perfis de acesso" detail="Modelos de permissões usados ao conceder acesso a uma unidade." icon={ShieldCheck} action={<div className="flex gap-2"><Link to="/usuarios" className="btn-secondary"><ArrowLeft size={16} /> Usuários</Link><button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Novo perfil</button></div>} />
    <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">Cada vínculo recebe uma cópia das permissões do perfil. Alterar um modelo não muda os acessos já concedidos.</p>
    <section className="space-y-2" aria-label="Perfis cadastrados">
      {db.profiles.map((profile) => <article key={profile.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[var(--ui-accent)]"><ShieldCheck size={18}/></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">{profile.name}</h2><p className="text-xs text-slate-500 dark:text-slate-400">{profile.isAdmin ? 'Administrador · todas as permissões' : `${profile.permissions.length} permissões`}{profile.description ? ` · ${profile.description}` : ''}</p></div>
        <button type="button" className="btn-secondary !p-2" aria-label={`Editar perfil ${profile.name}`} onClick={() => setEditing(profile)}><Pencil size={15}/></button>
        {!profile.system && <button type="button" className="btn-secondary !p-2 text-red-600" aria-label={`Excluir perfil ${profile.name}`} onClick={() => setRemoving(profile)}><Trash2 size={15}/></button>}
      </article>)}
    </section>
    {editing && <ProfileEditor profile={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {removing && <Dialog title="Excluir perfil?" onClose={() => setRemoving(null)}><DialogBody><p className="text-sm">O modelo “{removing.name}” será excluído. As permissões já concedidas aos usuários serão mantidas.</p>{remove.error && <div className="mt-3"><ErrorBox error={remove.error}/></div>}</DialogBody><DialogFooter><button type="button" className="btn-secondary" onClick={() => setRemoving(null)}>Cancelar</button><button type="button" className="btn bg-red-600 text-white hover:bg-red-700" disabled={remove.isPending} onClick={() => remove.mutate(removing.id)}>Excluir perfil</button></DialogFooter></Dialog>}
  </div>
}

function ProfileEditor({ profile, onClose }: { profile?: AccessProfile; onClose: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [name, setName] = useState(profile?.name ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [isAdmin, setIsAdmin] = useState(profile?.isAdmin ?? false)
  const [permissions, setPermissions] = useState<Permission[]>(profile?.permissions ?? [])
  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, description, isAdmin, permissions: isAdmin ? allPermissions : permissions }
      return profile ? api.updateProfile(ctx, profile.id, input) : api.createProfile(ctx, input)
    },
    onSuccess: () => { invalidateAll(client); onClose() },
  })
  return <Dialog title={profile ? 'Editar perfil' : 'Novo perfil'} onClose={onClose} wide>
    <form className="dialog-form flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><DialogBody className="space-y-4">
      <Field label="Nome *"><Input aria-label="Nome do perfil" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Operador da Plataforma" /></Field>
      <Field label="Descrição"><Input aria-label="Descrição do perfil" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Uso deste perfil" /></Field>
      <label className="flex items-center gap-2 text-sm"><Switch aria-label="Perfil administrador" checked={isAdmin} disabled={profile?.id === 'profile-admin'} onCheckedChange={setIsAdmin}/> Administrador com todas as permissões</label>
      {!isAdmin && <><p className="text-xs text-slate-500 dark:text-slate-400">Selecione as permissões iniciais. Elas poderão ser ajustadas em cada unidade.</p><div className="max-h-[55vh] overflow-y-auto pr-1"><PermissionGrid value={permissions} onChange={setPermissions}/></div></>}
      {mutation.error && <ErrorBox error={mutation.error}/>}
      </DialogBody><DialogFooter><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn-primary" disabled={mutation.isPending || !name.trim()}>Salvar perfil</button></DialogFooter>
    </form>
  </Dialog>
}
