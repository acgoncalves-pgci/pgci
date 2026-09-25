import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Eraser, Italic, Link, List, ListOrdered, Redo2, Strikethrough, Underline, Undo2 } from 'lucide-react'
import { sanitizeDocumentHtml } from '../../lib/richText'

const DEFAULT_FONT_SIZE = 15
const FONT_SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48, 60, 72, 96]

type CommandButtonProps = { label: string; children: ReactNode; onRun: () => void }

function CommandButton({ label, children, onRun }: CommandButtonProps) {
  return <button type="button" className="rich-editor-button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onRun}>{children}</button>
}

export function RichTextEditor({ value, onChange, ariaLabel = 'Editor do documento', minHeight = '297mm' }: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  minHeight?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef<string | null>(null)
  const selectionRef = useRef<Range | null>(null)
  const pendingFontSizeRef = useRef<number | null>(null)
  const existingFontTagsRef = useRef<Set<Element>>(new Set())
  const fontInputDirtyRef = useRef(false)
  const fontInputRef = useRef<HTMLInputElement>(null)
  const fontSizeControlRef = useRef<HTMLSpanElement>(null)
  const [fontSizeInput, setFontSizeInput] = useState(String(DEFAULT_FONT_SIZE))
  const [showFontSizes, setShowFontSizes] = useState(false)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || value === lastEmittedRef.current) return
    const safeValue = sanitizeDocumentHtml(value)
    if (editor.innerHTML !== safeValue) {
      editor.innerHTML = safeValue
      selectionRef.current = null
    }
  }, [value])

  useEffect(() => {
    const syncFontSize = () => {
      const editor = editorRef.current
      const selection = window.getSelection()
      if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode) || document.activeElement === fontInputRef.current) return
      const range = selection.getRangeAt(0)
      const start = range.startContainer
      const node = start instanceof Element ? start.childNodes[range.startOffset] ?? start : start
      const element = node instanceof Element ? node : node.parentElement
      if (element) setFontSizeInput(String(Math.round(parseFloat(getComputedStyle(element).fontSize))))
    }
    document.addEventListener('selectionchange', syncFontSize)
    return () => document.removeEventListener('selectionchange', syncFontSize)
  }, [])

  useEffect(() => {
    if (!showFontSizes) return
    const closeOutside = (event: PointerEvent) => {
      if (!fontSizeControlRef.current?.contains(event.target as Node)) setShowFontSizes(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [showFontSizes])

  const rememberSelection = useCallback(() => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }, [])

  const emitChange = useCallback(() => {
    const html = sanitizeDocumentHtml((editorRef.current?.innerHTML ?? '').replace(/\u200b/g, ''))
    lastEmittedRef.current = html
    onChange(html)
  }, [onChange])

  const clearCaretMarkers = () => {
    editorRef.current?.querySelectorAll<HTMLElement>('[data-font-size-caret]').forEach((span) => {
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node as Text
        if (text.data.includes('\u200b')) text.data = text.data.replace(/\u200b/g, '')
      }
      span.removeAttribute('data-font-size-caret')
      if (!span.textContent) span.remove()
    })
  }

  const restoreSelection = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection) return null
    if (!selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) {
      const saved = selectionRef.current && editor.contains(selectionRef.current.commonAncestorContainer)
        ? selectionRef.current.cloneRange() : document.createRange()
      if (!selectionRef.current || !editor.contains(selectionRef.current.commonAncestorContainer)) {
        saved.selectNodeContents(editor)
        saved.collapse(false)
      }
      editor.focus()
      selection.removeAllRanges()
      selection.addRange(saved)
    }
    return selection
  }

  const normalizeFontSize = (size: number) => {
    const editor = editorRef.current
    if (!editor) return
    editor.querySelectorAll<HTMLFontElement>('font[size="7"]').forEach((font) => {
      if (existingFontTagsRef.current.has(font)) return
      const span = document.createElement('span')
      span.style.fontSize = `${size}px`
      while (font.firstChild) span.append(font.firstChild)
      span.querySelectorAll<HTMLElement>('[style]').forEach((child) => child.style.removeProperty('font-size'))
      span.querySelectorAll('font[size]').forEach((child) => child.removeAttribute('size'))
      font.replaceWith(span)
    })
  }

  const applyFontSize = (input: string) => {
    const parsed = Number(input.trim().replace(',', '.').replace(/px$/i, ''))
    if (!Number.isFinite(parsed) || parsed < 6 || parsed > 144) {
      window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'error', message: 'Informe um tamanho entre 6 e 144 px.' } }))
      setFontSizeInput(String(DEFAULT_FONT_SIZE))
      fontInputDirtyRef.current = false
      return
    }
    fontInputDirtyRef.current = false
    const size = Math.round(parsed * 10) / 10
    const editor = editorRef.current
    const selection = restoreSelection()
    if (!editor || !selection) return
    if (selection.isCollapsed) {
      const span = document.createElement('span')
      span.style.fontSize = `${size}px`
      span.dataset.fontSizeCaret = ''
      pendingFontSizeRef.current = size
      const marker = document.createTextNode('\u200b')
      span.append(marker)
      const range = selection.getRangeAt(0)
      range.insertNode(span)
      const caret = document.createRange()
      caret.setStart(marker, marker.length)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
      rememberSelection()
      emitChange()
      setFontSizeInput(String(size))
      setShowFontSizes(false)
      fontInputDirtyRef.current = false
      return
    }
    existingFontTagsRef.current = new Set(editor.querySelectorAll('font[size="7"]'))
    pendingFontSizeRef.current = size
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand('fontSize', false, '7')
    normalizeFontSize(size)
    rememberSelection()
    emitChange()
    setFontSizeInput(String(size))
    setShowFontSizes(false)
    fontInputDirtyRef.current = false
  }

  const run = (command: string, argument?: string) => {
    const editor = editorRef.current
    if (!editor) return
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) {
      const range = selectionRef.current && editor.contains(selectionRef.current.commonAncestorContainer)
        ? selectionRef.current
        : document.createRange()
      if (range !== selectionRef.current) {
        range.selectNodeContents(editor)
        range.collapse(false)
      }
      editor.focus()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    document.execCommand(command, false, argument)
    rememberSelection()
    emitChange()
  }
  const clearFormatting = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection) return
    if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
      const range = selectionRef.current && editor.contains(selectionRef.current.commonAncestorContainer)
        ? selectionRef.current : document.createRange()
      if (range !== selectionRef.current) range.selectNodeContents(editor)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    if (selection.isCollapsed) {
      let block = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement
      while (block && block !== editor && !/^(P|DIV|H[1-6]|BLOCKQUOTE|LI)$/.test(block.tagName)) block = block.parentElement
      const range = document.createRange()
      range.selectNodeContents(block && block !== editor ? block : editor)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    editor.focus()
    document.execCommand('removeFormat')
    document.execCommand('formatBlock', false, 'p')
    selection.collapseToEnd()
    rememberSelection()
    emitChange()
  }
  const startPlainParagraph = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return
    const range = selection.getRangeAt(0)
    let block = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement
    while (block && block !== editor && !/^(P|DIV|H[1-6])$/.test(block.tagName)) {
      if (/^(LI|TD|TH)$/.test(block.tagName)) return
      block = block.parentElement
    }
    if (block && block !== editor) {
      const remaining = document.createRange()
      remaining.selectNodeContents(block)
      remaining.setStart(range.endContainer, range.endOffset)
      if (remaining.toString().length) return
    }
    event.preventDefault()
    const paragraph = document.createElement('p')
    paragraph.append(document.createElement('br'))
    if (block && block !== editor) block.after(paragraph)
    else editor.append(paragraph)
    const next = document.createRange()
    next.selectNodeContents(paragraph)
    next.collapse(true)
    selection.removeAllRanges()
    selection.addRange(next)
    selectionRef.current = next.cloneRange()
    emitChange()
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

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const handleBeforeInput = (input: InputEvent) => {
      if (pendingFontSizeRef.current === null || input.inputType !== 'insertText' || input.data === null) return
      const selection = window.getSelection()
      const anchor = selection?.anchorNode
      const span = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest<HTMLElement>('[data-font-size-caret]')
      if (!span || !editor.contains(span)) return
      input.preventDefault()
      const text = span.firstChild instanceof Text ? span.firstChild : span.appendChild(document.createTextNode(''))
      text.data = input.data === ' ' ? '\u00a0' : input.data
      span.removeAttribute('data-font-size-caret')
      pendingFontSizeRef.current = null
      const caret = document.createRange()
      caret.selectNodeContents(text)
      caret.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(caret)
      rememberSelection()
      emitChange()
    }
    editor.addEventListener('beforeinput', handleBeforeInput)
    return () => editor.removeEventListener('beforeinput', handleBeforeInput)
  }, [emitChange, rememberSelection])

  return <div className="rich-editor-shell">
    <div className="rich-editor-toolbar" role="toolbar" aria-label="Formatação do documento">
      <span className="rich-editor-group">
        <CommandButton label="Desfazer" onRun={() => run('undo')}><Undo2 size={16}/></CommandButton>
        <CommandButton label="Refazer" onRun={() => run('redo')}><Redo2 size={16}/></CommandButton>
      </span>
      <span className="rich-editor-group">
        <CommandButton label="Título 1" onRun={() => run('formatBlock', 'h1')}><span className="text-xs font-semibold">H1</span></CommandButton>
        <CommandButton label="Título 2" onRun={() => run('formatBlock', 'h2')}><span className="text-xs font-semibold">H2</span></CommandButton>
        <CommandButton label="Título 3" onRun={() => run('formatBlock', 'h3')}><span className="text-xs font-semibold">H3</span></CommandButton>
      </span>
      <span ref={fontSizeControlRef} className="rich-editor-group rich-editor-font-size" onKeyDown={(event) => { if (event.key === 'Escape') setShowFontSizes(false) }}>
        <input ref={fontInputRef} type="text" inputMode="decimal" className="rich-editor-font-size-input" aria-label="Tamanho da fonte (px)" title="Tamanho da fonte em px (6 a 144)" value={fontSizeInput} onChange={(event) => { fontInputDirtyRef.current = true; setFontSizeInput(event.target.value) }} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); applyFontSize(fontSizeInput) }
          if (event.key === 'Escape') { fontInputDirtyRef.current = false; setFontSizeInput(String(DEFAULT_FONT_SIZE)); setShowFontSizes(false) }
        }} onBlur={() => { if (fontInputDirtyRef.current) applyFontSize(fontSizeInput) }}/>
        <span className="rich-editor-font-size-unit">px</span>
        <button type="button" className="rich-editor-font-size-toggle" aria-label="Escolher tamanho da fonte" aria-expanded={showFontSizes} onMouseDown={(event) => event.preventDefault()} onClick={() => setShowFontSizes((open) => !open)}><ChevronDown size={14}/></button>
        {showFontSizes && <div className="rich-editor-font-size-menu" role="group" aria-label="Tamanhos de fonte">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFontSize(String(DEFAULT_FONT_SIZE))} aria-label="Padrão (15 px)">Padrão · 15 px</button>
          {FONT_SIZE_PRESETS.filter((size) => size !== DEFAULT_FONT_SIZE).map((size) => <button key={size} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFontSize(String(size))} aria-label={`Tamanho ${size} px`}>{size} px</button>)}
        </div>}
      </span>
      <span className="rich-editor-group">
        <CommandButton label="Negrito" onRun={() => run('bold')}><Bold size={16}/></CommandButton>
        <CommandButton label="Itálico" onRun={() => run('italic')}><Italic size={16}/></CommandButton>
        <CommandButton label="Sublinhado" onRun={() => run('underline')}><Underline size={16}/></CommandButton>
        <CommandButton label="Tachado" onRun={() => run('strikeThrough')}><Strikethrough size={16}/></CommandButton>
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
        <CommandButton label="Limpar formatação" onRun={clearFormatting}><Eraser size={16}/></CommandButton>
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
        style={{ height: minHeight }}
        suppressContentEditableWarning
        onKeyDown={startPlainParagraph}
        onInput={() => {
          if (pendingFontSizeRef.current !== null) {
            clearCaretMarkers()
            normalizeFontSize(pendingFontSizeRef.current)
            pendingFontSizeRef.current = null
          }
          rememberSelection()
          emitChange()
        }}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onBlur={() => {
          const editor = editorRef.current
          if (editor) {
            clearCaretMarkers()
            const safeValue = sanitizeDocumentHtml(editor.innerHTML)
            if (editor.innerHTML !== safeValue) editor.innerHTML = safeValue
          }
          emitChange()
        }}
      />
    </div>
  </div>
}
