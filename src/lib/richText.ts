const forbidden = 'script,style,iframe,object,embed,form,input,button,textarea,select,link,meta'

export const sanitizeDocumentHtml = (value: string) => {
  const source = value.trim()
  if (!source) return ''
  if (typeof DOMParser === 'undefined') return source
  const parsed = new DOMParser().parseFromString(source, 'text/html')
  parsed.body.querySelectorAll(forbidden).forEach((node) => node.remove())
  parsed.body.querySelectorAll<HTMLElement>('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLocaleLowerCase()
      const unsafeUrl = (name === 'href' || name === 'src') && /^\s*javascript:/i.test(attribute.value)
      if (name.startsWith('on') || unsafeUrl) node.removeAttribute(attribute.name)
    }
  })
  return parsed.body.innerHTML.trim()
}

export const documentText = (value: string) => {
  if (typeof DOMParser === 'undefined') return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return new DOMParser().parseFromString(value, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export const isRichDocument = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)
