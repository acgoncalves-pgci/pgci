import { forwardRef, useCallback, useEffect, useRef } from "react";
import type { ChangeEvent, InputHTMLAttributes } from "react";
import { MaskInput } from "maska";
import { Input } from "./Input";

export const CurrencyInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = "", onChange, ...props }, forwardedRef) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const setRefs = useCallback(
    (input: HTMLInputElement | null) => {
      inputRef.current = input;
      if (typeof forwardedRef === "function") forwardedRef(input);
      else if (forwardedRef) forwardedRef.current = input;
    },
    [forwardedRef],
  );

  useEffect(() => {
    if (!inputRef.current) return;

    const mask = new MaskInput(inputRef.current, {
      number: {
        locale: "pt-BR",
        fraction: 2,
        unsigned: true,
      },
      onMaska: () => {
        const input = inputRef.current;
        if (!input) return;
        onChangeRef.current?.({
          target: input,
          currentTarget: input,
          type: "change",
        } as ChangeEvent<HTMLInputElement>);
      },
    });

    return () => mask.destroy();
  }, []);

  return (
    <Input
      {...props}
      ref={setRefs}
      className={["tabular-nums", className].filter(Boolean).join(" ")}
      inputMode="decimal"
      type="text"
    />
  );
});

CurrencyInput.displayName = "CurrencyInput";
