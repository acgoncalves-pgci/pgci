import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
type ToastKind = 'success' | 'error';
type Toast = {
    id: number;
    kind: ToastKind;
    message: string;
};
type ToastEvent = {
    kind?: ToastKind;
    message?: string;
};
const isToastEvent = (value: unknown): value is ToastEvent => typeof value === 'object' && value !== null;
export function ToastProvider({ children }: {
    children: ReactNode;
}) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    useEffect(() => {
        const show = (event: Event) => {
            const payload = (event as CustomEvent<unknown>).detail;
            const detail = isToastEvent(payload) ? payload : {};
            const toast: Toast = { id: Date.now() + Math.round(Math.random() * 1000), kind: detail.kind === 'error' ? 'error' : 'success', message: detail.message || 'Alteração salva com sucesso.' };
            setToasts((current) => [...current.slice(-3), toast]);
            window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 4500);
        };
        window.addEventListener('fluxo-publico:toast', show);
        return () => window.removeEventListener('fluxo-publico:toast', show);
    }, []);
    return <>{children}<section aria-label="Notificações" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md flex-col gap-2 sm:left-auto sm:right-4 sm:mx-0">{toasts.map((toast) => <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border p-3 text-sm font-semibold shadow-lg ${toast.kind === 'error' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'}`}><span>{toast.message}</span><button type="button" aria-label="Fechar notificação" className="min-h-6 min-w-6 rounded text-base leading-none" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>×</button></div>)}</section></>;
}
