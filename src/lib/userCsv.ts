import type { Database, Role } from '../domain/model';
import { cpfDigits, validCpf } from './cpf';

export type UserImportRow = { line: number; name: string; email: string; role: Role; cpf: string; active: boolean; createPerson: boolean };
export type UserImportResult = { rows: UserImportRow[]; errors: string[] };
const headers = ['nome', 'email', 'perfil', 'cpf', 'ativo', 'criar_pessoa'];
const roles: Role[] = ['ADMIN', 'GESTOR', 'OPERADOR', 'LEITOR'];

const parseRecords = (content: string, delimiter: string) => {
  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let value = '';
  let quoted = false;
  let closed = false;
  let line = 1;
  let recordLine = 1;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else { value += char; if (char === '\n') line += 1; }
    } else if (char === '"') {
      if (value || closed) throw new Error(`Linha ${line}: aspas em posição inválida.`);
      quoted = true;
    } else if (char === delimiter) {
      cells.push(value.trim()); value = ''; closed = false;
    } else if (char === '\n' || char === '\r') {
      cells.push(value.trim());
      if (cells.some(Boolean)) records.push({ line: recordLine, cells });
      cells = []; value = ''; closed = false;
      if (char === '\r' && content[index + 1] === '\n') index += 1;
      line += 1; recordLine = line;
    } else {
      if (closed) throw new Error(`Linha ${line}: texto após aspas de fechamento.`);
      value += char;
    }
  }
  if (quoted) throw new Error(`Linha ${recordLine}: campo entre aspas não foi fechado.`);
  cells.push(value.trim());
  if (cells.some(Boolean)) records.push({ line: recordLine, cells });
  return records;
};

const booleanValue = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase();
  if (['sim', 'true', '1'].includes(normalized)) return true;
  if (['não', 'nao', 'false', '0'].includes(normalized)) return false;
  return undefined;
};

export const validateUserImportRows = (rows: UserImportRow[], db: Database): string[] => {
  const errors: string[] = [];
  const emails = new Set(db.users.map((user) => user.email.toLocaleLowerCase()));
  const cpfs = new Set(db.users.map((user) => cpfDigits(user.cpf ?? '')).filter(Boolean));
  const personCpfs = new Set(db.people.map((person) => cpfDigits(person.document ?? '')).filter(Boolean));
  for (const row of rows) {
    const prefix = `Linha ${row.line}: `;
    if (!row.name.trim()) errors.push(prefix + 'informe o nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push(prefix + 'e-mail inválido.');
    if (!roles.includes(row.role)) errors.push(prefix + 'perfil inválido. Use ADMIN, GESTOR, OPERADOR ou LEITOR.');
    if (typeof row.active !== 'boolean') errors.push(prefix + 'ativo deve ser sim ou não.');
    if (typeof row.createPerson !== 'boolean') errors.push(prefix + 'criar_pessoa deve ser sim ou não.');
    if (row.cpf && !validCpf(row.cpf)) errors.push(prefix + 'CPF inválido.');
    if (emails.has(row.email.toLocaleLowerCase())) errors.push(prefix + 'e-mail duplicado ou já cadastrado.');
    else emails.add(row.email.toLocaleLowerCase());
    const cpf = cpfDigits(row.cpf);
    if (cpf && cpfs.has(cpf)) errors.push(prefix + 'CPF duplicado ou já cadastrado em usuário.');
    else if (cpf) cpfs.add(cpf);
    if (row.createPerson && cpf && personCpfs.has(cpf)) errors.push(prefix + 'já existe pessoa com este CPF.');
    else if (row.createPerson && cpf) personCpfs.add(cpf);
  }
  return errors;
};

export const parseUserCsv = (content: string, db: Database): UserImportResult => {
  try {
    const source = content.replace(/^\uFEFF/, '');
    const firstLine = source.split(/\r?\n/, 1)[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const records = parseRecords(source, delimiter);
    if (!records.length) return { rows: [], errors: ['O arquivo CSV está vazio.'] };
    const names = records[0].cells.map((cell) => cell.toLocaleLowerCase());
    if (names.length !== headers.length || headers.some((header, index) => names[index] !== header))
      return { rows: [], errors: [`Cabeçalho inválido. Use exatamente: ${headers.join(delimiter)}. Não inclua unidades no CSV.`] };
    if (records.length === 1) return { rows: [], errors: ['O CSV não contém usuários.'] };
    if (records.length > 1001) return { rows: [], errors: ['O CSV aceita no máximo 1000 usuários por importação.'] };
    const errors: string[] = [];
    const rows: UserImportRow[] = [];
    for (const record of records.slice(1)) {
      if (record.cells.length !== headers.length) { errors.push(`Linha ${record.line}: quantidade de colunas inválida.`); continue; }
      const [name, email, role, cpf, activeText, personText] = record.cells;
      const active = booleanValue(activeText);
      const createPerson = booleanValue(personText);
      if (active === undefined) errors.push(`Linha ${record.line}: ativo deve ser sim ou não.`);
      if (createPerson === undefined) errors.push(`Linha ${record.line}: criar_pessoa deve ser sim ou não.`);
      rows.push({ line: record.line, name, email: email.toLocaleLowerCase(), role: role.toLocaleUpperCase() as Role, cpf, active: active ?? false, createPerson: createPerson ?? false });
    }
    return { rows, errors: [...errors, ...validateUserImportRows(rows, db)] };
  } catch (error) {
    return { rows: [], errors: [error instanceof Error ? error.message : 'CSV inválido.'] };
  }
};
