import { useEffect, useState } from 'react'
import { Dialog } from './Dialog'
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
    {error ? <ErrorBox error={error}/> : source ? <>
      <iframe className="h-[65vh] w-full rounded-md border" src={source} title={`Pré-visualização de ${title}`}/>
      {downloadFilename && <div className="mt-4 flex justify-end"><a className="btn-primary" href={source} download={downloadFilename}>{downloadLabel}</a></div>}
    </> : <Loading/>}
  </Dialog>
}
