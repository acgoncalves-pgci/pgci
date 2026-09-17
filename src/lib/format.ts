export const dateTime = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '—';
export const dateOnly = (value?: string) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Sem prazo';
export const money = (cents?: number) => cents === undefined ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const isoDaysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
export const cn = (...items: Array<string | false | undefined>) => items.filter(Boolean).join(' ');
