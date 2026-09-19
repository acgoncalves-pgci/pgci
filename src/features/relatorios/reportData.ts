import type { Context, Database, Protocol } from '../../domain/model';
import { canView, requireActor } from '../../domain/rules';

export interface ReportFilters {
  typeId: string; status: string; unitId: string; interestedId: string;
  from: string; to: string; number: string;
}
export const emptyFilters: ReportFilters = { typeId: '', status: '', unitId: '', interestedId: '', from: '', to: '', number: '' };
// Compare calendar dates in the same timezone used by the interface.
export const calendarDate = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export const inPeriod = (value: string, from: string, to: string) => {
  const date = calendarDate(value);
  return (!from || date >= from) && (!to || date <= to);
};
export function visibleProtocols(db: Database, ctx: Context) {
  requireActor(db, ctx);
  return db.protocols.filter((protocol) => canView(db, protocol, ctx));
}
export function filterProtocols(protocols: Protocol[], filters: ReportFilters) {
  return protocols.filter((p) => (!filters.typeId || p.typeId === filters.typeId)
    && (!filters.status || p.status === filters.status)
    && (!filters.unitId || p.currentUnitId === filters.unitId)
    && (!filters.interestedId || p.interestedPersonId === filters.interestedId)
    && (!filters.number.trim() || p.number.toLowerCase().includes(filters.number.trim().toLowerCase()))
    && inPeriod(p.createdAt, filters.from, filters.to)).sort((a, b) => a.number.localeCompare(b.number));
}
export function consultationUrl(protocol: Protocol, publicUrl: string, enabled: boolean, origin: string) {
  const url = publicUrl.trim();
  if (!enabled || !url) return new URL(`/processos/${encodeURIComponent(protocol.id)}`, origin).href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) throw new Error('Informe um endereço público HTTP ou HTTPS válido nas configurações.');
  const destination = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password)
    throw new Error('Informe um endereço público HTTP ou HTTPS válido nas configurações.');
  destination.searchParams.set('numero', protocol.number);
  return destination.href;
}
