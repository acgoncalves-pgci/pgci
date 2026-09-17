import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Copy, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { DocumentType } from '../../domain/model';
import { api } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll, useDb } from '../../app/queries';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback';
export function DocumentTypesPage() {
  const ctx = useSession()
  const { data: db, isLoading } = useDb()
  const [editing, setEditing] = useState<DocumentType | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const admin = ctx.user?.role === 'ADMIN'

  if (isLoading || !db) return <Loading />
  const visible = db.documentTypes.filter((type) => `${type.name} ${type.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))

  return <>
    <PageTitle title="Tipos de documento" action={admin ? <button className="button-primary" onClick={() => setEditing('new')}><Plus size={16} />Novo</button> : undefined} />
    <p className="-mt-3 mb-5 text-sm text-muted-foreground">Configure os documentos disponíveis e seus modelos associados.</p>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input aria-label="Buscar tipo de documento" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome..." className="w-60 pl-9" /></div>
    </div>
    <div className="space-y-1.5">
      {visible.map((type) => <article className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm" key={type.id}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${type.color}1a`, color: type.color }}><FileText size={18} /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{type.name}</h2>{type.active && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Sistema</span>}</div><p className="truncate text-xs text-muted-foreground">{type.description}</p></div>
        <div className="flex shrink-0 items-center gap-2"><button className="button-secondary h-8 px-3"><Copy size={15} />Modelos <ChevronRight size={14} /></button>{admin && <><button className="button-secondary icon-button size-8" aria-label={`Editar ${type.name}`} onClick={() => setEditing(type)}><Pencil size={15} /></button><button className="button-secondary icon-button size-8 text-destructive" aria-label={`Excluir ${type.name}`} disabled><Trash2 size={15} /></button></>}</div>
      </article>)}
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhum tipo de documento encontrado.</p>}
    </div>
    {editing && <DocumentTypeEditor type={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
  </>
}
function DocumentTypeEditor({ type, onClose, onSaved }: {
    type?: DocumentType;
    onClose: () => void;
    onSaved: () => void;
}) { const ctx = useSession(); const client = useQueryClient(); const [name, setName] = useState(type?.name ?? ''); const [description, setDescription] = useState(type?.description ?? ''); const [color, setColor] = useState(type?.color ?? '#17628b'); const [active, setActive] = useState(type?.active ?? true); const mutation = useMutation({ mutationFn: () => { const input = { name, description, color, active }; return type ? api.updateDocumentType(ctx, type.id, input) : api.createDocumentType(ctx, input); }, onSuccess: () => { invalidateAll(client); onSaved(); } }); return <Dialog title={type ? 'Editar tipo de documento' : 'Novo tipo de documento'} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><Field label="Nome *"><Input className="field" value={name} onChange={(event) => setName(event.target.value)}/></Field><Field label="Cor"><Input className="field h-10 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)}/></Field></div><Field label="Descrição *"><textarea className="field min-h-28" value={description} onChange={(event) => setDescription(event.target.value)}/></Field>{type && <label className="block text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Tipo ativo</label>}{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>Salvar</button></div></form></Dialog>; }
