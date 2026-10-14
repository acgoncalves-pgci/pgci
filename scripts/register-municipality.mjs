import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const file = new URL('../src/saas/municipalities.json', import.meta.url)
const args = process.argv.slice(2)
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? (args[index + 1] ?? '').trim() : '' }
const name = value('--name')
const city = value('--city')
const state = value('--state').toUpperCase()
const abbreviation = value('--abbreviation')
if (!name || !city || !/^[A-Z]{2}$/.test(state) || !abbreviation) {
  console.error('Use: node scripts/register-municipality.mjs --name "Prefeitura de Axixá" --city "Axixá" --state MA --abbreviation PMA [--dry-run]')
  process.exit(1)
}
const municipalities = JSON.parse(readFileSync(file, 'utf8'))
if (municipalities.some((item) => item.city.toLocaleLowerCase('pt-BR') === city.toLocaleLowerCase('pt-BR') && item.state === state)) {
  console.error('Esta prefeitura já está cadastrada. Preserve seu ID e slug ao atualizar os dados de exibição.')
  process.exit(1)
}
const base = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 70)
if (!base) { console.error('O nome da cidade não gera um endereço válido.'); process.exit(1) }
const reserved = new Set(['login', 'esqueci-a-senha', 'dashboard', 'relatorios', 'processos', 'protocolos', 'documentos', 'pessoas', 'estrutura', 'tipos-processo', 'categorias-processo', 'situacoes', 'fases', 'tipos-protocolo', 'tipos-documento', 'usuarios', 'perfis', 'configuracoes', 'assets', 'src', 'api', 'admin', 'saas', 'examples', 'pdf-assets'])
const candidate = reserved.has(base) ? `prefeitura${base}` : base
let slug = candidate
let suffix = 2
while (municipalities.some((item) => item.slug === slug)) slug = `${candidate}-${suffix++}`
const municipality = { id: `prefeitura-${randomUUID()}`, slug, name, city, state, abbreviation }
if (!args.includes('--dry-run')) writeFileSync(file, `${JSON.stringify([...municipalities, municipality], null, 2)}\n`)
console.log(JSON.stringify({ ...municipality, path: `/${slug}/`, saved: !args.includes('--dry-run') }, null, 2))
