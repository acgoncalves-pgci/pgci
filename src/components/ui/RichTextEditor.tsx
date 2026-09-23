import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eraser, Italic, Link, List, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react'
import { sanitizeDocumentHtml } from '../../lib/richText'
import { documentText } from '../../lib/richText'

type CommandButtonProps = { label: string; children: ReactNode; onRun: () => void }

function CommandButton({ label, children, onRun }: CommandButtonProps) {
  return <button type="button" className="rich-editor-button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onRun}>{children}</button>
}

export function RichTextEditor({ value, onChange, ariaLabel = 'Editor do documento', minHeight = '220mm' }: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  minHeight?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value
  }, [value])

  const run = (command: string, argument?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, argument)
    onChange(sanitizeDocumentHtml(editorRef.current?.innerHTML ?? ''))
  }
  const link = () => {
    const address = window.prompt('Informe o endereço do link (https://…)')?.trim()
    if (!address) return
    try {
      const url = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`)
      if (!['http:', 'https:'].includes(url.protocol)) return
      run('createLink', url.toString())
    } catch {
      window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'error', message: 'Informe um endereço HTTP ou HTTPS válido.' } }))
    }
  }

  return <div className="rich-editor-shell">
    <textarea className="sr-only" aria-label={ariaLabel} value={documentText(value)} onChange={(event) => onChange(event.target.value)}/>
    <div className="rich-editor-toolbar" role="toolbar" aria-label="Formatação do documento">
      <span className="rich-editor-group">
        <CommandButton label="Desfazer" onRun={() => run('undo')}><Undo2 size={16}/></CommandButton>
        <CommandButton label="Refazer" onRun={() => run('redo')}><Redo2 size={16}/></CommandButton>
      </span>
      <span className="rich-editor-group">
        <CommandButton label="Negrito" onRun={() => run('bold')}><Bold size={16}/></CommandButton>
        <CommandButton label="Itálico" onRun={() => run('italic')}><Italic size={16}/></CommandButton>
        <CommandButton label="Sublinhado" onRun={() => run('underline')}><Underline size={16}/></CommandButton>
      </span>
      <span className="rich-editor-group">
        <CommandButton label="Alinhar à esquerda" onRun={() => run('justifyLeft')}><AlignLeft size={16}/></CommandButton>
        <CommandButton label="Centralizar" onRun={() => run('justifyCenter')}><AlignCenter size={16}/></CommandButton>
        <CommandButton label="Alinhar à direita" onRun={() => run('justifyRight')}><AlignRight size={16}/></CommandButton>
        <CommandButton label="Justificar" onRun={() => run('justifyFull')}><AlignJustify size={16}/></CommandButton>
      </span>
      <span className="rich-editor-group">
        <CommandButton label="Lista com marcadores" onRun={() => run('insertUnorderedList')}><List size={16}/></CommandButton>
        <CommandButton label="Lista numerada" onRun={() => run('insertOrderedList')}><ListOrdered size={16}/></CommandButton>
        <CommandButton label="Inserir link" onRun={link}><Link size={16}/></CommandButton>
        <CommandButton label="Limpar formatação" onRun={() => run('removeFormat')}><Eraser size={16}/></CommandButton>
      </span>
    </div>
    <div className="a4-editor-viewport">
      <div
        ref={editorRef}
        className="a4-page rich-editor-content"
        contentEditable
        role="textbox"
        aria-label={`${ariaLabel} visual`}
        aria-multiline="true"
        data-placeholder="Comece a redigir o documento…"
        style={{ minHeight }}
        suppressContentEditableWarning
        onInput={(event) => onChange(sanitizeDocumentHtml(event.currentTarget.innerHTML))}
        onBlur={(event) => onChange(sanitizeDocumentHtml(event.currentTarget.innerHTML))}
      />
    </div>
  </div>
}
