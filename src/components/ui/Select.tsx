import { Children, forwardRef, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, ChangeEvent, ChangeEventHandler, CSSProperties, KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Option = { disabled: boolean; label: ReactNode; value: string }
type NativeProps = SelectHTMLAttributes<HTMLSelectElement>
export type SelectProps = Omit<NativeProps, 'children' | 'value' | 'defaultValue' | 'onChange' | 'onBlur'> & {
  children: ReactNode
  value?: string | number | readonly string[]
  defaultValue?: string | number | readonly string[]
  onChange?: ChangeEventHandler<HTMLSelectElement>
  onBlur?: ChangeEventHandler<HTMLSelectElement>
}

const optionsFromChildren = (children: ReactNode): Option[] => Children.toArray(children).flatMap((child) => {
  if (!isValidElement(child) || child.type !== 'option') return []
  const props = child.props as { children?: ReactNode; disabled?: boolean; value?: string | number }
  return [{ disabled: Boolean(props.disabled), label: props.children, value: String(props.value ?? props.children ?? '') }]
})

export const Select = forwardRef<HTMLInputElement, SelectProps>(({ children, className = '', value, defaultValue, name, id, disabled = false, required, onChange, onBlur, 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, ...props }, ref) => {
  const options = optionsFromChildren(children)
  const initialValue = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue
  const [uncontrolledValue, setUncontrolledValue] = useState(String(initialValue ?? options[0]?.value ?? ''))
  const [open, setOpen] = useState(false)
  const [contentStyle, setContentStyle] = useState<CSSProperties | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listboxId = useId()
  const isControlled = value !== undefined
  const rawValue = Array.isArray(value) ? value[0] : value
  const currentValue = String(isControlled ? rawValue ?? '' : uncontrolledValue)
  const selected = options.find((option) => option.value === currentValue)
  const selectedLabel = selected?.label ?? 'Selecione'

  const updateContentPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const padding = 8
    const gap = 4
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const spaceAbove = Math.max(0, rect.top - padding)
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - padding)
    const estimatedHeight = Math.min(320, Math.max(88, options.length * 44 + 8))
    const opensUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
    const maxHeight = Math.max(1, Math.min(320, (opensUpward ? spaceAbove : spaceBelow) - gap))
    const maxWidth = Math.max(1, viewportWidth - padding * 2)
    const width = Math.min(Math.max(rect.width, Math.min(240, maxWidth)), maxWidth)
    const left = Math.min(Math.max(padding, rect.left), Math.max(padding, viewportWidth - width - padding))
    setContentStyle(opensUpward
      ? { position: 'fixed', zIndex: 80, bottom: viewportHeight - rect.top + gap, left, width, maxHeight }
      : { position: 'fixed', zIndex: 80, top: rect.bottom + gap, left, width, maxHeight })
  }, [options.length])

  useEffect(() => {
    if (!open) { setContentStyle(null); return }
    updateContentPosition()
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !contentRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    window.addEventListener('resize', updateContentPosition)
    document.addEventListener('scroll', updateContentPosition, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      window.removeEventListener('resize', updateContentPosition)
      document.removeEventListener('scroll', updateContentPosition, true)
    }
  }, [open, updateContentPosition])

  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) Object.assign(ref, { current: node })
  }, [ref])
  const eventFor = (nextValue: string) => {
    const input = inputRef.current
    if (input) {
      input.value = nextValue
      return { type: 'change', target: input, currentTarget: input } as unknown as ChangeEvent<HTMLSelectElement>
    }
    return { type: 'change', target: { name, value: nextValue }, currentTarget: { name, value: nextValue } } as ChangeEvent<HTMLSelectElement>
  }
  const choose = (nextValue: string) => {
    if (!isControlled) setUncontrolledValue(nextValue)
    const event = eventFor(nextValue)
    onChange?.(event)
    onBlur?.(event)
    setOpen(false)
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((current) => !current); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const enabled = options.filter((option) => !option.disabled)
      const index = enabled.findIndex((option) => option.value === currentValue)
      const next = enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]
      if (next) choose(next.value)
    }
  }
  const triggerProps = props as unknown as ButtonHTMLAttributes<HTMLButtonElement>
  const content = open && contentStyle && <div ref={contentRef} id={listboxId} role="listbox" aria-label={ariaLabel} style={contentStyle} className="ui-select-content overflow-y-auto rounded-md border bg-white p-1 shadow-lg dark:bg-slate-900">{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === currentValue} disabled={option.disabled} className="ui-select-option" onClick={() => choose(option.value)}><span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-5 text-pretty">{option.label}</span>{option.value === currentValue && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-public-700"/>}</button>)}</div>

  return <div ref={rootRef} className="relative"><input ref={setInputRef} type="hidden" aria-hidden="true" name={name} value={currentValue} disabled={disabled} required={required}/><button {...triggerProps} ref={triggerRef} id={id} type="button" role="combobox" aria-label={ariaLabel} aria-invalid={ariaInvalid} aria-expanded={open} aria-controls={listboxId} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={onTriggerKeyDown} className={`field ui-select ${className}`}><span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-5 text-pretty">{selectedLabel}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{content && createPortal(content, document.body)}</div>
})
Select.displayName = 'Select'




