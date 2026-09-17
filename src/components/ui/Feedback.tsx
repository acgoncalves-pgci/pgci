import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
export function PageTitle({ eyebrow, title, action }: {
    eyebrow?: string;
    title: string;
    action?: ReactNode;
}) { return <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3"><div>{eyebrow && <p className="label mb-1">{eyebrow}</p>}<h1 className="text-3xl font-bold tracking-tight">{title}</h1></div>{action}</div>; }
export function Empty({ title, detail, action }: {
    title: string;
    detail: string;
    action?: ReactNode;
}) { return <div className="panel p-10 text-center"><Inbox className="mx-auto mb-3 text-slate-400" size={30}/><h3 className="text-lg font-bold">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{detail}</p>{action && <div className="mt-4">{action}</div>}</div>; }
export function ErrorBox({ error }: {
    error: unknown;
}) { const message = error instanceof Error ? error.message : 'Não foi possível concluir esta ação.'; useEffect(() => { window.dispatchEvent(new CustomEvent('fluxo-publico:toast', { detail: { kind: 'error', message } })); }, [message]); return <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{message}</div>; }
export function Loading({ variant = 'page' }: {
    variant?: 'page' | 'dashboard' | 'list' | 'detail';
}) { if (variant === 'dashboard')
    return <div aria-label="Carregando painel" className="space-y-6"><div className="h-9 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"/>)}</div><div className="h-72 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"/></div>; if (variant === 'list')
    return <div aria-label="Carregando listagem" className="space-y-3"><div className="h-12 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"/>{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"/>)}</div>; return <div aria-label={variant === 'detail' ? 'Carregando detalhes' : 'Carregando página'} className="space-y-3"><div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800"/><div className="h-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"/></div>; }
export function Field({ label, error, children }: {
    label: string;
    error?: string;
    children: ReactNode;
}) { return <label className="block"><span className="label">{label}</span>{children}{Boolean(error) && <span role="alert" className="mt-1 block text-xs font-semibold text-red-700 dark:text-red-300">{error}</span>}</label>; }
