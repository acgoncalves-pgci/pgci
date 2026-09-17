import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => <input ref={ref} className={`field ui-input ${className}`} {...props}/>);
Input.displayName = 'Input';
