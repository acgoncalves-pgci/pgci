import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronRight, Copy, FileText, Sparkles } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../app/session'
import { invalidateAll, useDb } from '../../app/queries'
import { ErrorBox, Field, Loading } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Input'
import { RichTextEditor } from '../../components/ui/RichTextEditor'
import { Switch } from '../../components/ui/Switch'
import { documentText } from '../../lib/richText'
import { templateVariables, validateTemplateContent } from '../../lib/documentTemplate'
import { api } from '../../services/api'
import { generateDocumentTemplate } from '../../services/documentTemplateAi'

export function DocumentTemplatePage() {
  const { typeId = '', templateId } = useParams()
  const ctx = useSession()
  const { data: db, isLoading } = useDb()
  if (isLoading || !db) return <Loading variant="detail" />
  if (ctx.user?.role !== 'ADMIN') return <ErrorBox error={new Error('Apenas administradores podem cadastrar modelos de documento.')}/>
  const type = db.documentTypes.find((item) => item.id === typeId)
  const template = db.documentTemplates.find((item) => item.id === templateId && item.typeId === typeId)
  if (!type || (templateId && !template)) return <ErrorBox error={new Error('Tipo ou modelo de documento não encontrado.')}/>
  return <DocumentTemplateForm key={template?.id ?? type.id} typeId={type.id} typeName={type.name} template={template}/>
}

function DocumentTemplateForm({ typeId, typeName, template }: { typeId: string; typeName: string; template?: NonNullable<ReturnType<typeof useDb>['data']>['documentTemplates'][number] }) {
  const ctx = useSession()
  const navigate = useNavigate()
  const client = useQueryClient()
  const back = `/tipos-documento?modelos=${encodeURIComponent(typeId)}`
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [active, setActive] = useState(template?.active ?? true)
  const [isDefault, setIsDefault] = useState(Boolean(template?.isDefault))
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [prompt, setPrompt] = useState('')
  const [fileName, setFileName] = useState('')
  const [copied, setCopied] = useState('')
  const validation = validateTemplateContent(subject, body)
  const save = useMutation({
    mutationFn: () => {
      const input = { typeId, name, subject, description, body, active, isDefault }
      return template ? api.updateDocumentTemplate(ctx, template.id, input) : api.createDocumentTemplate(ctx, input)
    },
    onSuccess: async () => { await invalidateAll(client); navigate(back) },
  })
  const generate = useMutation({ mutationFn: () => generateDocumentTemplate(prompt), onSuccess: (html) => { setBody(html); setMode('text') } })
  const copyVariable = async (key: string) => {
    try {
      await navigator.clipboard.writeText(`{{${key}}}`)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => current === key ? '' : current), 2000)
    } catch {
      window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'error', message: 'Não foi possível copiar a variável.' } }))
    }
  }
  const readFile = async (file?: File) => {
    if (!file) return
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 1024 * 1024) {
      setPrompt('')
      setFileName('')
      window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'error', message: 'Selecione um arquivo .txt ou .md de até 1 MB.' } }))
      return
    }
    setPrompt(await file.text())
    setFileName(file.name)
  }

  return <div className="mx-auto max-w-7xl space-y-5 pb-8">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight">{template ? 'Editar Modelo' : 'Novo Modelo'}</h1><p className="text-sm text-muted-foreground">Tipo: {typeName}</p></div>
      <Link to={back} className="btn-secondary icon-button" aria-label="Voltar aos modelos"><ArrowLeft size={17}/></Link>
    </div>
    <nav aria-label="Caminho" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link className="hover:underline" to="/tipos-documento"><FileText size={14} className="mr-1 inline"/>Tipos de Documento</Link><ChevronRight size={13}/>
      <Link className="hover:underline" to={back}>{typeName}</Link><ChevronRight size={13}/>
      <Link className="hover:underline" to={back}>Modelos</Link><ChevronRight size={13}/>
      <span className="font-medium text-foreground">{template ? 'Editar modelo' : 'Novo modelo'}</span>
    </nav>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (!validation && name.trim()) save.mutate() }}>
      <section className="panel space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do modelo *"><Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160}/></Field>
          <Field label="Assunto padrão"><Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={300}/></Field>
        </div>
        <Field label="Descrição"><textarea className="field min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000}/></Field>
        <div className="divide-y rounded-lg border">
          <div className="flex items-center justify-between gap-4 p-3"><div><p className="text-sm font-medium">Modelo padrão deste tipo</p><p className="text-xs text-muted-foreground">Ao selecionar este tipo em um novo documento, o texto já vem preenchido com este modelo.</p></div><Switch aria-label="Modelo padrão deste tipo" checked={isDefault} onCheckedChange={(checked) => { setIsDefault(checked); if (checked) setActive(true) }}/></div>
          <div className="flex items-center justify-between gap-4 p-3"><div><p className="text-sm font-medium">Ativo</p><p className="text-xs text-muted-foreground">Modelos inativos continuam cadastrados, mas não aparecem na seleção ao redigir documentos.</p></div><Switch aria-label="Modelo ativo" checked={active} onCheckedChange={(checked) => { setActive(checked); if (!checked) setIsDefault(false) }}/></div>
        </div>
      </section>
      <section className="panel space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conteúdo</h2>
        <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label="Origem do conteúdo">
          <button type="button" role="tab" aria-selected={mode === 'text'} className={`rounded-md px-3 py-1.5 text-sm ${mode === 'text' ? 'bg-white font-medium shadow-sm dark:bg-slate-800' : ''}`} onClick={() => setMode('text')}>Texto</button>
          <button type="button" role="tab" aria-selected={mode === 'file'} className={`rounded-md px-3 py-1.5 text-sm ${mode === 'file' ? 'bg-white font-medium shadow-sm dark:bg-slate-800' : ''}`} onClick={() => setMode('file')}>Arquivo com IA</button>
        </div>
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <div><p className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-primary"/>{mode === 'file' ? 'Criar a partir de arquivo com IA' : 'Criar o texto com IA'}</p><p className="mt-1 text-xs text-muted-foreground">{mode === 'file' ? 'Envie um texto de referência (.txt ou .md). Revise o resultado antes de salvar.' : 'Descreva o documento que você precisa. A IA redige o texto usando apenas as variáveis do sistema.'}</p></div>
          {mode === 'file' && <label className="block text-sm">Arquivo de referência <input type="file" accept=".txt,.md,text/plain,text/markdown" className="mt-2 block w-full text-sm" onChange={(event) => void readFile(event.target.files?.[0])}/>{fileName && <span className="mt-1 block text-xs text-muted-foreground">{fileName}</span>}</label>}
          <textarea aria-label="Descrição para IA" className="field min-h-20" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === 'file' ? 'O conteúdo do arquivo aparece aqui e pode ser complementado...' : 'Ex.: ofício de encaminhamento de processo à Secretaria de Finanças solicitando parecer em 5 dias úteis'}/>
          <div className="flex justify-end"><button type="button" className="btn-secondary" disabled={generate.isPending || prompt.trim().length < 20} onClick={() => generate.mutate()}><Sparkles size={15}/>{generate.isPending ? 'Gerando…' : 'Gerar texto com IA'}</button></div>
          {generate.error && <ErrorBox error={generate.error}/>}
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="min-w-0"><span className="label mb-1 block">Corpo do modelo *</span><RichTextEditor ariaLabel="Corpo do modelo" value={body} onChange={setBody} minHeight="297mm"/><p className="mt-2 text-xs text-muted-foreground">Texto normal por padrão. Use a barra de ferramentas para aplicar negrito apenas onde desejar.</p></div>
          <aside className="rounded-lg border bg-card p-3" aria-label="Variáveis do modelo"><p className="text-xs text-muted-foreground">Clique em uma variável para copiar e cole no texto. Ela será substituída ao usar o modelo.</p>
            {templateVariables.map((group) => <div className="mt-4" key={group.group}><h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.group}</h3><div className="space-y-0.5">{group.items.map((variable) => <button key={variable.key} type="button" className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" title={`Copiar {{${variable.key}}}`} onClick={() => void copyVariable(variable.key)}>{copied === variable.key ? <Check size={14}/> : <Copy size={14}/>}<span>{variable.label}</span></button>)}</div></div>)}
          </aside>
        </div>
      </section>
      {validation && body && <p role="alert" className="text-sm text-destructive">{validation}</p>}
      {save.error && <ErrorBox error={save.error}/>}
      <div className="flex justify-end gap-2 border-t pt-4"><Link className="btn-secondary" to={back}>Cancelar</Link><button className="btn-primary" disabled={save.isPending || !name.trim() || !documentText(body) || Boolean(validation)}>{save.isPending ? 'Salvando…' : 'Salvar modelo'}</button></div>
    </form>
  </div>
}
