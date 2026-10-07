import { z } from 'zod'
import type { CSSProperties } from 'react'

export const documentMarginsSchema = z.object({
  top: z.number().min(0).max(50),
  right: z.number().min(0).max(50),
  bottom: z.number().min(0).max(50),
  left: z.number().min(0).max(50),
})
export type DocumentMargins = z.infer<typeof documentMarginsSchema>
export const defaultDocumentMargins: DocumentMargins = { top: 20, right: 20, bottom: 20, left: 20 }
export function readDocumentMargins(value?: unknown): DocumentMargins {
  const result = documentMarginsSchema.safeParse(value)
  return result.success ? result.data : { ...defaultDocumentMargins }
}
export function documentMarginsStyle(value?: DocumentMargins): CSSProperties {
  const margins = readDocumentMargins(value)
  return { '--document-padding': `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm` } as CSSProperties
}
