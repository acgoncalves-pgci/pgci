import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(({ className = '', ...props }, ref) => <input ref={ref} type="checkbox" className={`ui-checkbox ${className}`} {...props}/>)
Checkbox.displayName = 'Checkbox'