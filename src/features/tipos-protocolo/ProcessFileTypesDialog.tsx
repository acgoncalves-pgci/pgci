import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProcessFileType, ProtocolType } from '../../domain/model'
import { processFileExtensions, retentionLabel } from '../../domain/processFiles'
import { api } from '../../services/api'
import { useSession } from '../../app/session'
import { invalidateAll } from '../../app/queries'
import { Dialog, DialogBody, DialogFooter } from '../../components/ui/Dialog'
import { Checkbox } from '../../components/ui/Checkbox'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { IconGlyph, IconSelect } from '../../components/ui/IconSelect'
import { ErrorBox, Field } from '../../components/ui/Feedback'

export function ProcessFileTypesDialog({ type, editable, onClose }: { type: ProtocolType; editable: boolean; onClose: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [editing, setEditing] = useState<ProcessFileType | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ProcessFileType | null>(null)
  const remove = useMutation({ mutationFn: (definitionId: string) => api.deleteProcessFileType(ctx, type.id, definitionId), onSuccess: async () => { await invalidateAll(client); setDeleting(null) } })
  return <>
    <Dialog title={`Arquivos — ${type.name}`} onClose={onClose}>
      <DialogBody className="space-y-4">
        <p className="text-sm text-muted-foreground">Defina os tipos de arquivo e as extensões que poderão ser anexados aos processos deste tipo.</p>
        {editable && <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16}/>Novo tipo de arquivo</button></div>}
        {type.fileTypes?.length ? <div className="divide-y rounded-lg border border-border">{type.fileTypes.map((definition) => <article className="flex items-center gap-3 p-3" key={definition.id}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: definition.color + '22', color: definition.color }}><IconGlyph name={definition.icon} size={18}/></span>
          <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{definition.name}</h3><p className="mt-1 text-xs text-muted-foreground">{definition.extensions.map((extension) => extension.toUpperCase()).join(' · ')} · Retenção: {retentionLabel(definition.retentionYears)}</p>{definition.observation && <p className="mt-1 break-words text-xs text-muted-foreground">{definition.observation}</p>}</div>
          {editable && <div className="flex shrink-0 gap-2"><button type="button" className="btn-secondary icon-button size-8" aria-label={`Editar ${definition.name}`} onClick={() => setEditing(definition)}><Pencil size={15}/></button><button type="button" className="btn-secondary icon-button size-8 text-destructive" aria-label={`Excluir ${definition.name}`} onClick={() => setDeleting(definition)}><Trash2 size={15}/></button></div>}
        </article>)}</div> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum tipo de arquivo configurado. Enquanto isso, são aceitos os formatos padrão: PDF, PNG, JPG e TXT.</p>}
      </DialogBody><DialogFooter><button type="button" className="btn-secondary" onClick={onClose}>Fechar</button></DialogFooter>
    </Dialog>
    {editing && <ProcessFileTypeEditor typeId={type.id} definition={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}/>}
    {deleting && <Dialog title="Excluir tipo de arquivo" stacked onClose={() => setDeleting(null)}><DialogBody><p className="text-sm">Excluir a definição <strong>{deleting.name}</strong>? Os arquivos já anexados aos processos serão preservados.</p>{remove.error && <ErrorBox error={remove.error}/>}</DialogBody><DialogFooter><button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="btn-primary" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>Excluir</button></DialogFooter></Dialog>}
  </>
}

function ProcessFileTypeEditor({ typeId, definition, onClose }: { typeId: string; definition?: ProcessFileType; onClose: () => void }) {
  const ctx = useSession()
  const client = useQueryClient()
  const [name, setName] = useState(definition?.name ?? '')
  const [extensions, setExtensions] = useState(definition?.extensions ?? [])
  const [retentionYears, setRetentionYears] = useState<ProcessFileType['retentionYears']>(definition?.retentionYears ?? null)
  const [observation, setObservation] = useState(definition?.observation ?? '')
  const [color, setColor] = useState(definition?.color ?? '#3498DB')
  const [icon, setIcon] = useState(definition?.icon ?? 'Paperclip')
  const save = useMutation({ mutationFn: () => api.saveProcessFileType(ctx, typeId, { name, extensions, retentionYears, observation, color, icon }, definition?.id), onSuccess: async () => { await invalidateAll(client); onClose() } })
  return <Dialog title={definition ? 'Editar tipo de arquivo' : 'Novo tipo de arquivo'} onClose={onClose} stacked>
    <form className="dialog-form flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><DialogBody className="space-y-5">
      <Field label="Nome *"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ex.: Comprovante de residência" required/></Field>
      <fieldset><legend className="label">Extensões permitidas *</legend><div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">{processFileExtensions.map((extension) => <label key={extension} className="flex items-center gap-2 text-sm"><Checkbox checked={extensions.includes(extension)} onChange={(event) => setExtensions(event.target.checked ? [...extensions, extension] : extensions.filter((item) => item !== extension))}/>{extension.toUpperCase()}</label>)}</div></fieldset>
      <Field label="Retenção"><Select aria-label="Retenção" value={retentionYears === null ? 'permanent' : String(retentionYears)} onChange={(event) => setRetentionYears(event.target.value === 'permanent' ? null : Number(event.target.value) as ProcessFileType['retentionYears'])}><option value="1">1 ano</option><option value="2">2 anos</option><option value="3">3 anos</option><option value="4">4 anos</option><option value="permanent">Permanente</option></Select></Field>
      <Field label="Observação"><textarea className="field min-h-24" value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={1000}/></Field>
      <Field label="Cor"><div className="flex max-w-52 items-center gap-2 rounded-lg border border-border bg-background p-1.5"><Input aria-label="Selecionar cor" className="!mt-0 size-8 shrink-0 cursor-pointer border-0 p-0" type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())}/><Input aria-label="Cor hexadecimal" className="!mt-0 border-0 bg-transparent px-1 font-mono text-sm font-semibold shadow-none" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} maxLength={7}/></div></Field>
      <Field label="Ícone"><IconSelect value={icon} onChange={(event) => setIcon(event.target.value)}/></Field>
      {save.error && <ErrorBox error={save.error}/>}
    </DialogBody><DialogFooter><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={save.isPending || !name.trim() || extensions.length === 0}>{save.isPending ? 'Salvando…' : 'Salvar'}</button></DialogFooter></form>
  </Dialog>
}
