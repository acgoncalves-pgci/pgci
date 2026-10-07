import { useState } from 'react'
import { Signature } from 'lucide-react'
import { Dialog, DialogBody, DialogFooter } from './Dialog'
import { Field } from './Feedback'
import { Input } from './Input'
import { useSession } from '../../app/session'
import { useDb } from '../../app/queries'

export function PdfSignatureDialog({ documentTitle, ready, onClose, onSign }: { documentTitle: string; ready: boolean; onClose: () => void; onSign: (value: { signer: string; title: string; reason: string }) => void }) {
  const ctx = useSession()
  const { data: db } = useDb()
  const membership = db?.memberships.find((item) => item.userId === ctx.userId && item.unitId === ctx.activeUnitId && item.active)
  const [title, setTitle] = useState(membership?.title ?? '')
  const [reason, setReason] = useState('')
  return <Dialog title="Assinar eletronicamente" titleIcon={<Signature size={19} className="text-violet-600"/>} titleDescription={documentTitle} onClose={onClose} stacked>
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); if (ready && ctx.user) onSign({ signer: ctx.user.name, title: title.trim(), reason: reason.trim() }) }}>
      <DialogBody className="space-y-4"><Field label="Assinante"><Input value={ctx.user?.name ?? ''} readOnly className="bg-muted/50 text-muted-foreground"/></Field><Field label="Cargo / função"><Input value={title} maxLength={150} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Secretário de Administração"/></Field><Field label="Motivo da assinatura"><textarea className="field min-h-24" rows={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: Aprovo o conteúdo do documento."/></Field><p className="text-xs leading-relaxed text-muted-foreground">Esta assinatura é uma simulação. O arquivo PDF não será alterado e nenhum carimbo ou QR Code será aplicado.</p></DialogBody>
      <DialogFooter><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn bg-violet-600 text-white hover:bg-violet-700" disabled={!ready || !ctx.user}><Signature size={16}/>{ready ? 'Assinar' : 'Carregando PDF…'}</button></DialogFooter>
    </form>
  </Dialog>
}
