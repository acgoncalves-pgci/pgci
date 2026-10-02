import { useEffect, useState } from 'react'
import { Dialog, DialogBody, DialogFooter } from './Dialog'
import { ErrorBox, Loading } from './Feedback'

export function PdfViewerDialog({ title, url, blob, downloadFilename, downloadLabel = 'Baixar PDF', error, onClose }: { title: string; url?: string; blob?: Blob; downloadFilename?: string; downloadLabel?: string; error?: unknown; onClose: () => void }) {
  const [temporaryUrl, setTemporaryUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    setTemporaryUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  const source = url ?? temporaryUrl
  return <Dialog title={title} onClose={onClose} wide>
    <DialogBody>{error ? <ErrorBox error={error}/> : source ? <>
      <iframe className="h-[65vh] w-full rounded-md border" src={source} title={`Pré-visualização de ${title}`}/>
    </> : <Loading/>}</DialogBody>
    <DialogFooter><button type="button" className="btn-secondary" onClick={onClose}>Fechar</button>{source && !error && downloadFilename && <a className="btn-primary" href={source} download={downloadFilename}>{downloadLabel}</a>}</DialogFooter>
  </Dialog>
}
