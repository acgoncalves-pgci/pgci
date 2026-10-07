import { Children, createContext, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = '';

const lockBodyScroll = () => {
    if (bodyScrollLockCount === 0)
        bodyOverflowBeforeLock = document.body.style.overflow;
    bodyScrollLockCount += 1;
    document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = () => {
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
    if (bodyScrollLockCount === 0)
        document.body.style.overflow = bodyOverflowBeforeLock;
};

export const OverlayLayerContext = createContext(60);

export function DialogBody({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 ${className}`}>{children}</div>;
}

export function DialogFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <footer className={`dialog-footer flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-white px-5 py-4 dark:bg-slate-900 ${className}`}>{children}</footer>;
}

const containsDialogPart = (children: ReactNode, part: typeof DialogBody | typeof DialogFooter): boolean =>
    Children.toArray(children).some((child) => {
        if (!isValidElement<{ children?: ReactNode }>(child) || child.type === Dialog) return false;
        return child.type === part || containsDialogPart(child.props.children, part);
    });

export function Dialog({ title, children, onClose, wide = false, stacked = false, size = 'default', headerActions, titleIcon, titleDescription, showDefaultFooter = true }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
    stacked?: boolean;
    size?: 'default' | 'large';
    headerActions?: ReactNode;
    titleIcon?: ReactNode;
    titleDescription?: ReactNode;
    showDefaultFooter?: boolean;
}) {
    const contentRef = useRef<HTMLElement>(null);
    const openerRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const closeTimer = useRef<number>();
    const titleId = useId();
    const [closing, setClosing] = useState(false);
    const parentLayer = useContext(OverlayLayerContext);
    const layer = Math.max(stacked ? 140 : 100, parentLayer + 40);

    useEffect(() => {
        const opener = openerRef.current;
        lockBodyScroll();
        const frame = window.requestAnimationFrame(() => {
            const content = contentRef.current;
            const first = content?.querySelector<HTMLElement>(focusableSelector);
            (first ?? content)?.focus();
        });
        return () => {
            window.cancelAnimationFrame(frame);
            if (closeTimer.current)
                window.clearTimeout(closeTimer.current);
            unlockBodyScroll();
            if (opener?.isConnected) opener.focus();
        };
    }, []);

    const requestClose = () => {
        if (closing)
            return;
        setClosing(true);
        closeTimer.current = window.setTimeout(onClose, 160);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            requestClose();
            return;
        }
        if (event.key !== 'Tab')
            return;
        const items = Array.from(contentRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
        if (!items.length) {
            event.preventDefault();
            return;
        }
        const first = items[0];
        const last = items.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return createPortal(
        <OverlayLayerContext.Provider value={layer}>
            <div data-state={closing ? 'closed' : 'open'} style={{ zIndex: layer }} className="dialog-backdrop fixed inset-0 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <section ref={contentRef} tabIndex={-1} onKeyDown={onKeyDown} className={`dialog-content flex max-h-[min(92dvh,100%)] min-w-0 w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900 ${wide ? 'max-w-[calc(100vw-2rem)] sm:max-w-5xl' : size === 'large' ? 'max-w-[calc(100vw-2rem)] sm:max-w-3xl' : 'max-w-[calc(100vw-2rem)] sm:max-w-xl'}`}>
                    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                        <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2">{titleIcon}<h2 id={titleId} className={headerActions ? 'min-w-0 break-words text-sm font-semibold' : 'min-w-0 break-words text-xl font-bold'}>{title}</h2></div>{titleDescription && <p className="mt-1 break-words text-xs text-muted-foreground">{titleDescription}</p>}</div>
                        {headerActions && <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">{headerActions}</div>}
                        <button type="button" aria-label="Fechar diálogo" className="btn-secondary shrink-0 !p-2" onClick={requestClose}><X aria-hidden="true" size={17}/></button>
                    </header>
                    {containsDialogPart(children, DialogBody)
                        ? children
                        : <DialogBody>{children}</DialogBody>}
                    {showDefaultFooter && !containsDialogPart(children, DialogFooter) && <DialogFooter><button type="button" className="btn-secondary" onClick={requestClose}>Fechar</button></DialogFooter>}
                </section>
            </div>
        </OverlayLayerContext.Provider>,
        document.body,
    );
}
