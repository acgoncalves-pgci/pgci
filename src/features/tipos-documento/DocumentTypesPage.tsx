import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Copy, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { DocumentTemplate, DocumentType } from '../../domain/model';
import { api } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll, useDb } from '../../app/queries';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { documentText } from '../../lib/richText';
export function DocumentTypesPage() {
  const ctx = useSession()
  const { data: db, isLoading } = useDb()
  const [editing, setEditing] = useState<DocumentType | 'new' | null>(null)
  const [modelsType, setModelsType] = useState<DocumentType | null>(null)
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
        <div className="flex shrink-0 items-center gap-2"><button className="button-secondary h-8 px-3" onClick={() => setModelsType(type)}><Copy size={15} />Modelos <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{db.documentTemplates.filter((template) => template.typeId === type.id).length}</span><ChevronRight size={14} /></button>{admin && <><button className="button-secondary icon-button size-8" aria-label={`Editar ${type.name}`} onClick={() => setEditing(type)}><Pencil size={15} /></button><button className="button-secondary icon-button size-8 text-destructive" aria-label={`Excluir ${type.name}`} disabled><Trash2 size={15} /></button></>}</div>
      </article>)}
      {visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhum tipo de documento encontrado.</p>}
    </div>
    {editing && <DocumentTypeEditor type={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
    {modelsType && <DocumentModelsDialog type={modelsType} templates={db.documentTemplates.filter((template) => template.typeId === modelsType.id)} editable={admin} onClose={() => setModelsType(null)}/>}
  </>
}
function DocumentTypeEditor({ type, onClose, onSaved }: {
    type?: DocumentType;
    onClose: () => void;
    onSaved: () => void;
}) { const ctx = useSession(); const client = useQueryClient(); const [name, setName] = useState(type?.name ?? ''); const [description, setDescription] = useState(type?.description ?? ''); const [color, setColor] = useState(type?.color ?? '#17628b'); const [active, setActive] = useState(type?.active ?? true); const mutation = useMutation({ mutationFn: () => { const input = { name, description, color, active }; return type ? api.updateDocumentType(ctx, type.id, input) : api.createDocumentType(ctx, input); }, onSuccess: () => { invalidateAll(client); onSaved(); } }); return <Dialog title={type ? 'Editar tipo de documento' : 'Novo tipo de documento'} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><Field label="Nome *"><Input className="field" value={name} onChange={(event) => setName(event.target.value)}/></Field><Field label="Cor"><Input className="field h-10 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)}/></Field></div><Field label="Descrição *"><textarea className="field min-h-28" value={description} onChange={(event) => setDescription(event.target.value)}/></Field>{type && <label className="flex items-center gap-2 text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Tipo ativo</label>}{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>Salvar</button></div></form></Dialog>; }

function DocumentModelsDialog({ type, templates, editable, onClose }: { type: DocumentType; templates: DocumentTemplate[]; editable: boolean; onClose: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [editing, setEditing] = useState<DocumentTemplate | 'new' | null>(null)
  const remove = useMutation({ mutationFn: (templateId: string) => api.deleteDocumentTemplate(ctx, templateId), onSuccess: () => invalidateAll(client) })
  return <>
    <Dialog title={`Modelos — ${type.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Os modelos preenchem assunto e conteúdo ao redigir um novo documento.</p>{editable && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16}/>Novo modelo</button>}</div>
        {templates.length ? <div className="divide-y rounded-lg border">{templates.map((template) => <article key={template.id} className="flex items-center gap-3 p-3"><Copy className="shrink-0 text-muted-foreground" size={17}/><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium">{template.name}</h3><p className="truncate text-xs text-muted-foreground">{template.subject} · {documentText(template.body)}</p></div>{!template.active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Inativo</span>}{editable && <><button className="btn-secondary !p-2" aria-label={`Editar modelo ${template.name}`} onClick={() => setEditing(template)}><Pencil size={15}/></button><button className="btn-secondary !p-2 text-destructive" aria-label={`Excluir modelo ${template.name}`} disabled={remove.isPending} onClick={() => remove.mutate(template.id)}><Trash2 size={15}/></button></>}</article>)}</div> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum modelo cadastrado para este tipo.</p>}
        {remove.error && <ErrorBox error={remove.error}/>}<div className="flex justify-end"><button className="btn-secondary" onClick={onClose}>Fechar</button></div>
      </div>
    </Dialog>
    {editing && <DocumentTemplateEditor type={type} template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)}/>}
  </>
}

function DocumentTemplateEditor({ type, template, onClose, onSaved }: { type: DocumentType; template?: DocumentTemplate; onClose: () => void; onSaved: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [active, setActive] = useState(template?.active ?? true)
  const save = useMutation({
    mutationFn: () => {
      const input = { typeId: type.id, name, subject, body, active }
      return template ? api.updateDocumentTemplate(ctx, template.id, input) : api.createDocumentTemplate(ctx, input)
    },
    onSuccess: async () => { await invalidateAll(client); onSaved() },
  })
  return <Dialog title={template ? 'Editar modelo' : 'Novo modelo'} onClose={onClose} wide stacked><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do modelo *"><Input value={name} onChange={(event) => setName(event.target.value)}/></Field><Field label="Assunto sugerido *"><Input value={subject} onChange={(event) => setSubject(event.target.value)}/></Field></div><div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><strong className="font-medium text-foreground">Campos disponíveis:</strong> {'{{numero_processo}}'}, {'{{assunto_processo}}'}, {'{{destinatario}}'}, {'{{data_atual}}'}, {'{{usuario}}'} e {'{{unidade}}'}.</div><Field label="Conteúdo do modelo *"><RichTextEditor value={body} onChange={setBody} minHeight="150mm"/></Field><label className="flex items-center gap-2 text-sm"><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Modelo ativo</label>{save.error && <ErrorBox error={save.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={save.isPending || !name.trim() || !subject.trim() || !documentText(body)}>Salvar modelo</button></div></form></Dialog>
}
