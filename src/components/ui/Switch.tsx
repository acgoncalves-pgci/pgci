import { forwardRef, useState } from 'react';
import type { ButtonHTMLAttributes, ChangeEvent, ChangeEventHandler } from 'react';
type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'type'> & {
    checked?: boolean;
    defaultChecked?: boolean;
    onChange?: ChangeEventHandler<HTMLInputElement>;
    onCheckedChange?: (checked: boolean) => void;
};
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(({ checked, defaultChecked = false, disabled = false, className = '', onChange, onCheckedChange, ...props }, ref) => {
    const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
    const isControlled = checked !== undefined;
    const currentChecked = isControlled ? checked : uncontrolledChecked;
    const toggle = () => { if (disabled)
        return; const nextChecked = !currentChecked; if (!isControlled)
        setUncontrolledChecked(nextChecked); onCheckedChange?.(nextChecked); onChange?.({ target: { checked: nextChecked }, currentTarget: { checked: nextChecked } } as ChangeEvent<HTMLInputElement>); };
    return <button {...props} ref={ref} type="button" role="switch" aria-checked={currentChecked} disabled={disabled} data-state={currentChecked ? 'checked' : 'unchecked'} onClick={toggle} className={`ui-switch ${className}`}><span aria-hidden="true" className="ui-switch-thumb"/></button>;
});
Switch.displayName = 'Switch';
