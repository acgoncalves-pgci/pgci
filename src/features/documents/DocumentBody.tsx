import type { AppDocument } from '../../domain/model'
import { isRichDocument, sanitizeDocumentHtml } from '../../lib/richText'

export function DocumentBody({ document }: { document: AppDocument }) {
  return isRichDocument(document.body)
    ? <div className="document-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(document.body) }}/>
    : <div className="whitespace-pre-wrap">{document.body}</div>
}
