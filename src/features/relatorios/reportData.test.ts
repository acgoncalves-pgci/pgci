import { describe, expect, it } from 'vitest';
import { seedDatabase } from '../../mocks/seed';
import { calendarDate, consultationUrl, emptyFilters, filterProtocols, visibleProtocols } from './reportData';

describe('filtros e consulta dos relatórios', () => {
  it('inclui o dia final inteiro no fuso do sistema', () => {
    const db = seedDatabase();
    const p = { ...db.protocols[0], createdAt: '2026-09-18T02:59:00Z' };
    expect(calendarDate(p.createdAt)).toBe('2026-09-17');
    expect(filterProtocols([p], { ...emptyFilters, from: '2026-09-17', to: '2026-09-17' })).toHaveLength(1);
    expect(filterProtocols([{ ...p, createdAt: '2026-09-18T03:00:00Z' }], { ...emptyFilters, to: '2026-09-17' })).toHaveLength(0);
  });
  it('combina os filtros sem perder a busca pelo número', () => {
    const db = seedDatabase(); const p = db.protocols[0];
    expect(filterProtocols(db.protocols, { ...emptyFilters, typeId: p.typeId, status: p.status, unitId: p.currentUnitId, number: p.number, interestedId: p.interestedPersonId ?? '' })).toEqual([p]);
    expect(filterProtocols([p], { ...emptyFilters, status: 'INEXISTENTE' })).toHaveLength(0);
  });
  it('respeita a visibilidade e rejeita um vínculo inválido', () => {
    const db = seedDatabase(); const operator = db.users.find((u) => u.role === 'OPERADOR')!;
    const ctx = { userId: operator.id, activeUnitId: operator.unitId };
    const privateProtocol = { ...db.protocols[0], id: 'private', currentUnitId: 'other', createdById: 'other', currentAssigneeId: 'other' };
    db.protocols.push(privateProtocol);
    expect(visibleProtocols(db, ctx).some((p) => p.id === 'private')).toBe(false);
    expect(() => visibleProtocols(db, { ...ctx, activeUnitId: 'invalid' })).toThrow();
  });
  it('usa o portal configurado preservando parâmetros e o número completo', () => {
    const p = seedDatabase().protocols[0];
    const result = new URL(consultationUrl(p, 'portal.entidade.gov.br/consulta?entidade=1', true, 'https://sistema.gov.br'));
    expect(() => consultationUrl(p, 'ftp://portal.gov.br', true, 'https://sistema.gov.br')).toThrow();
    expect(result.protocol).toBe('https:'); expect(result.searchParams.get('numero')).toBe(p.number); expect(result.searchParams.get('entidade')).toBe('1');
    expect(consultationUrl(p, '', true, 'https://sistema.gov.br')).toBe(`https://sistema.gov.br/processos/${p.id}`);
    expect(consultationUrl(p, 'https://portal.gov.br', false, 'https://sistema.gov.br')).toBe(`https://sistema.gov.br/processos/${p.id}`);
  });
});
