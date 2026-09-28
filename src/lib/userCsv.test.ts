import { beforeEach, describe, expect, it } from 'vitest';
import { seedDatabase } from '../mocks/seed';
import { api } from '../services/api';
import { loadDb, saveDb } from '../storage/database';
import { parseUserCsv } from './userCsv';

const admin = { userId: 'usr-admin', activeUnitId: 'u-prot' };

describe('importação de usuários', () => {
  beforeEach(() => { localStorage.clear(); saveDb(seedDatabase()); });

  it('lê CSV com BOM, aspas e CPF opcional sem incluir unidade', () => {
    const result = parseUserCsv('\uFEFFnome;email;perfil;cpf;ativo;criar_pessoa\r\n"Ana; Souza";ana@example.com;OPERADOR;;sim;sim\r\nBeto;beto@example.com;LEITOR;;não;não', loadDb());
    expect(result.errors).toEqual([]);
    expect(result.rows).toMatchObject([
      { line: 2, name: 'Ana; Souza', active: true, createPerson: true },
      { line: 3, name: 'Beto', active: false, createPerson: false },
    ]);
  });

  it('recusa cabeçalho com unidade e indica linhas inválidas ou duplicadas', () => {
    expect(parseUserCsv('nome;email;perfil;cpf;ativo;criar_pessoa;unidade\nAna;ana@example.com;OPERADOR;;sim;sim;u-prot', loadDb()).errors[0]).toContain('Não inclua unidades');
    const result = parseUserCsv('nome,email,perfil,cpf,ativo,criar_pessoa\nAna,ana@example.com,OPERADOR,123,sim,sim\nBeto,ana@example.com,LEITOR,,talvez,não', loadDb());
    expect(result.errors.join(' ')).toContain('Linha 2: CPF inválido');
    expect(result.errors.join(' ')).toContain('Linha 3: ativo deve ser sim ou não');
    expect(result.errors.join(' ')).toContain('Linha 3: e-mail duplicado');
  });

  it('cria usuário e pessoa opcional, sem vínculo, e usa a primeira unidade adicionada como principal', async () => {
    const result = parseUserCsv('nome;email;perfil;cpf;ativo;criar_pessoa\nAna;ana@example.com;OPERADOR;;sim;sim\nBeto;beto@example.com;LEITOR;;sim;não', loadDb());
    await api.importUsers(admin, result.rows);
    const db = loadDb();
    const ana = db.users.find((user) => user.email === 'ana@example.com')!;
    expect(ana.unitId).toBe('');
    expect(db.memberships.some((membership) => membership.userId === ana.id)).toBe(false);
    expect(db.people.some((person) => person.name === 'Ana' && person.email === ana.email && person.roles.includes('INTERESSADO'))).toBe(true);
    expect(db.people.some((person) => person.name === 'Beto')).toBe(false);
    await api.saveUserMembership(admin, ana.id, undefined, { unitId: 'u-edu', role: 'OPERADOR' });
    expect(loadDb().users.find((user) => user.id === ana.id)?.unitId).toBe('u-edu');
  });

  it('não grava nenhuma linha quando há erro de duplicidade no momento de importar', async () => {
    const rows = parseUserCsv('nome;email;perfil;cpf;ativo;criar_pessoa\nAna;ana@example.com;OPERADOR;;sim;sim\nBeto;beto@example.com;LEITOR;;sim;não', loadDb()).rows;
    rows[1].email = 'ana@example.com';
    const before = loadDb();
    await expect(api.importUsers(admin, rows)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(loadDb().users).toHaveLength(before.users.length);
    expect(loadDb().people).toHaveLength(before.people.length);
  });

  it('valida CPF opcional e cria pessoa com o mesmo CPF no cadastro individual', async () => {
    const created = await api.createUser(admin, { name: 'Cláudia Nova', email: 'claudia.nova@example.com', role: 'GESTOR', cpf: '529.982.247-25', active: true, createPerson: true });
    expect(created.cpf).toBe('52998224725');
    expect(loadDb().people).toEqual(expect.arrayContaining([expect.objectContaining({ name: created.name, document: created.cpf, email: created.email })]));
    await expect(api.createUser(admin, { name: 'Outro CPF', email: 'outro@example.com', role: 'LEITOR', cpf: '52998224725', active: true })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(api.createUser(admin, { name: 'CPF ruim', email: 'ruim@example.com', role: 'LEITOR', cpf: '11111111111', active: true })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
