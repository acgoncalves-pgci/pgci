import { Children, forwardRef, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, ChangeEventHandler, KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react'
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
  const options = optionsFromChildren(children); const initialValue = Array.isArray(defaultValue) ? defaultValue[0] : defaultValue
  const [uncontrolledValue, setUncontrolledValue] = useState(String(initialValue ?? options[0]?.value ?? '')); const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null); const listboxId = useId(); const isControlled = value !== undefined; const rawValue = Array.isArray(value) ? value[0] : value; const currentValue = String(isControlled ? rawValue ?? '' : uncontrolledValue)
  const selected = options.find((option) => option.value === currentValue); const selectedLabel = selected?.label ?? 'Selecione'
  useEffect(() => { if (!open) return; const closeOnOutside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }; document.addEventListener('mousedown', closeOnOutside); return () => document.removeEventListener('mousedown', closeOnOutside) }, [open])
  const setInputRef = useCallback((node: HTMLInputElement | null) => { inputRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node }, [ref])
  const eventFor = (nextValue: string) => { const input = inputRef.current; if (input) { input.value = nextValue; return { type: 'change', target: input, currentTarget: input } as unknown as ChangeEvent<HTMLSelectElement> }; return { type: 'change', target: { name, value: nextValue }, currentTarget: { name, value: nextValue } } as ChangeEvent<HTMLSelectElement> }
  const choose = (nextValue: string) => { if (!isControlled) setUncontrolledValue(nextValue); const event = eventFor(nextValue); onChange?.(event); onBlur?.(event); setOpen(false) }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => { if (disabled) return; if (event.key === 'Escape') { setOpen(false); return }; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((current) => !current); return }; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const enabled = options.filter((option) => !option.disabled); const index = enabled.findIndex((option) => option.value === currentValue); const next = enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]; if (next) choose(next.value) } }
  return <div ref={rootRef} className="relative"><input ref={setInputRef} type="hidden" aria-hidden="true" name={name} value={currentValue} disabled={disabled} required={required}/><button {...props} id={id} type="button" role="combobox" aria-label={ariaLabel} aria-invalid={ariaInvalid} aria-expanded={open} aria-controls={listboxId} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={onTriggerKeyDown} className={`field ui-select ${className}`}><span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <div id={listboxId} role="listbox" aria-label={ariaLabel} className="ui-select-content absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white p-1 shadow-lg dark:bg-slate-900">{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === currentValue} disabled={option.disabled} className="ui-select-option" onClick={() => choose(option.value)}><span className="min-w-0 flex-1 truncate">{option.label}</span>{option.value === currentValue && <Check aria-hidden="true" className="size-4 shrink-0 text-public-700"/>}</button>)}</div>}</div>
})
Select.displayName = 'Select'