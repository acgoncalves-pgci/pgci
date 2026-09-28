import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { MaskedInput } from './MaskedInput';

const phoneMasks = ['(##) ####-####', '(##) #####-####'];

export const BrazilianPhoneInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <MaskedInput {...props} ref={ref} mask={phoneMasks} inputMode="tel" maxLength={15} />,
);

BrazilianPhoneInput.displayName = 'BrazilianPhoneInput';
