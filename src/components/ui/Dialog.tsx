import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Printer, X } from 'lucide-react';
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function Dialog({ title, children, onClose, wide = false }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) {
    const contentRef = useRef<HTMLElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const closeTimer = useRef<number>();
    const titleId = useId();
    const [closing, setClosing] = useState(false);
    useEffect(() => {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const frame = window.requestAnimationFrame(() => { const content = contentRef.current; const first = content?.querySelector<HTMLElement>(focusableSelector); (first ?? content)?.focus(); });
        return () => { window.cancelAnimationFrame(frame); if (closeTimer.current)
            window.clearTimeout(closeTimer.current); openerRef.current?.focus(); };
    }, []);
    const requestClose = () => { if (closing)
        return; setClosing(true); closeTimer.current = window.setTimeout(onClose, 160); };
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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
    return <div data-state={closing ? 'closed' : 'open'} className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId}><section ref={contentRef} tabIndex={-1} onKeyDown={onKeyDown} className={`dialog-content max-h-[92vh] w-full overflow-auto rounded-xl bg-white shadow-2xl dark:bg-slate-900 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}><header className="flex items-center justify-between border-b px-5 py-4"><h2 id={titleId} className="text-xl font-bold">{title}</h2><button type="button" aria-label="Fechar diálogo" className="btn-secondary !p-2" onClick={requestClose}><X aria-hidden="true" size={17}/></button></header><div className="p-5">{children}</div></section></div>;
}
export function PrintPreviewDialog({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    return <Dialog title={`Prévia de impressão — ${title}`} onClose={onClose} wide><p className="no-print mb-4 text-sm text-slate-600 dark:text-slate-300">Confira o conteúdo abaixo. Menus e ações não serão impressos.</p><article className="print-preview mx-auto max-w-3xl bg-white p-6 text-slate-900 sm:p-8">{children}</article><div className="no-print mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Fechar</button><button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={16}/>Imprimir</button></div></Dialog>;
}
