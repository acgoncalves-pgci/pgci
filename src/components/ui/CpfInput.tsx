import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { MaskedInput } from './MaskedInput';

export const CpfInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <MaskedInput {...props} ref={ref} mask="###.###.###-##" maxLength={14} />,
);

CpfInput.displayName = 'CpfInput';
