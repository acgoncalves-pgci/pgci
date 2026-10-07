import { useState } from 'react'
import { Ruler } from 'lucide-react'
import { Dialog, DialogBody, DialogFooter } from './Dialog'
import { Input } from './Input'
import { Field } from './Feedback'
import { Tooltip } from './Tooltip'
import { defaultDocumentMargins, documentMarginsSchema, readDocumentMargins } from '../../lib/documentMargins'
import type { DocumentMargins } from '../../lib/documentMargins'

export function DocumentMarginSettings({ value, onChange }: { value?: DocumentMargins; onChange: (value: DocumentMargins) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<keyof DocumentMargins, string>>({ top: '20', right: '20', bottom: '20', left: '20' })
  const updateDraft = (value?: DocumentMargins) => setDraft(Object.fromEntries(Object.entries(readDocumentMargins(value)).map(([key, value]) => [key, String(value)])) as typeof draft)
  const parsed = documentMarginsSchema.safeParse(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() ? Number(value) : NaN])))
  return <>
    <Tooltip content="Bordas e margens da página" className="inline-flex"><button type="button" className="rich-editor-button" onClick={() => { updateDraft(value); setOpen(true) }} aria-label="Bordas e margens da página"><Ruler size={16}/></button></Tooltip>
    {open && <Dialog title="Bordas e margens da página" onClose={() => setOpen(false)}>
      <DialogBody className="space-y-4"><p className="text-sm text-slate-500">Defina a distância do texto até cada borda da folha A4. O padrão é 20 mm.</p><div className="grid grid-cols-2 gap-4">{([['top', 'Superior'], ['right', 'Direita'], ['bottom', 'Inferior'], ['left', 'Esquerda']] as const).map(([key, label]) => <Field key={key} label={`${label} (mm)`}><Input className="field" type="number" min={0} max={50} step={1} value={draft[key]} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))}/></Field>)}</div><p className="text-xs text-slate-500">Informe de 0 a 50 mm em cada lado.</p></DialogBody>
      <DialogFooter><button type="button" className="btn-secondary mr-auto" onClick={() => updateDraft(defaultDocumentMargins)}>Restaurar padrão</button><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="btn-primary" disabled={!parsed.success} onClick={() => { if (parsed.success) { onChange(parsed.data); setOpen(false) } }}>Aplicar</button></DialogFooter>
    </Dialog>}
  </>
}
