import { forwardRef, useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { MaskInput } from 'maska';
import type { MaskInputOptions } from 'maska';
import { Input } from './Input';

type MaskedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & Pick<MaskInputOptions, 'mask' | 'tokens'>;

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, tokens, onChange, inputMode = 'numeric', ...props }, forwardedRef) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const onChangeRef = useRef(onChange);

    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const setRefs = useCallback((input: HTMLInputElement | null) => {
      inputRef.current = input;
      if (typeof forwardedRef === 'function') forwardedRef(input);
      else if (forwardedRef) forwardedRef.current = input;
    }, [forwardedRef]);

    useEffect(() => {
      const input = inputRef.current;
      if (!input) return;
      const instance = new MaskInput(input, {
        mask,
        tokens,
        onMaska: () => {
          onChangeRef.current?.({ target: input, currentTarget: input, type: 'change' } as ChangeEvent<HTMLInputElement>);
        },
      });
      instance.updateValue(input);
      return () => instance.destroy();
    }, [mask, tokens]);

    return <Input {...props} ref={setRefs} type="text" inputMode={inputMode} onChange={() => undefined} />;
  },
);

MaskedInput.displayName = 'MaskedInput';
