import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { MaskedInput } from './MaskedInput';

export const CnpjInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <MaskedInput {...props} ref={ref} mask="##.###.###/####-##" maxLength={18} />,
);

CnpjInput.displayName = 'CnpjInput';
