import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import type { Person } from '../../domain/model';
import { api } from '../../services/api';
import { useSession } from '../../app/session';
import { invalidateAll } from '../../app/queries';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Switch } from '../../components/ui/Switch';
import { Empty, ErrorBox, Field, Loading, PageTitle } from '../../components/ui/Feedback';
export function PeoplePage() {
    const ctx = useSession();
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Person | 'new' | null>(null);
    const { data, isLoading, error } = useQuery({ queryKey: ['people', ctx.userId, search], queryFn: () => api.listPeople(ctx, search) });
    if (isLoading)
        return <Loading variant="list"/>;
    if (error || !data)
        return <ErrorBox error={error}/>;
    return <><PageTitle title="Pessoas" action={<button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16}/>Cadastrar pessoa</button>}/><div className="panel mb-4 p-3"><label className="relative block"><Search className="absolute left-3 top-2.5 text-slate-400" size={17}/><Input aria-label="Buscar pessoas" className="field !mt-0 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou CPF/CNPJ"/></label></div>{data.items.length ? <div className="grid gap-3 md:grid-cols-2">{data.items.map((person) => <article className="panel p-4" key={person.id}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{person.name}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{person.document ?? 'Sem CPF/CNPJ'} · {person.kind === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}</p></div>{ctx.user?.role === 'ADMIN' && <button className="btn-secondary !py-1" onClick={() => setEditing(person)}>Editar</button>}</div><p className="mt-3 text-sm">{person.roles.map((role) => role === 'INTERESSADO' ? 'Interessado' : 'Credor').join(' e ')} · <span className={person.active ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-semibold text-slate-500 dark:text-slate-400'}>{person.active ? 'Ativa' : 'Inativa'}</span></p></article>)}</div> : <Empty title="Nenhuma pessoa encontrada" detail="Altere a busca ou cadastre uma pessoa."/>}{editing && <PersonEditor person={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)}/>}</>;
}
function PersonEditor({ person, onClose, onSaved }: {
    person?: Person;
    onClose: () => void;
    onSaved: () => void;
}) { const ctx = useSession(); const client = useQueryClient(); const [kind, setKind] = useState<Person['kind']>(person?.kind ?? 'PF'); const [name, setName] = useState(person?.name ?? ''); const [document, setDocument] = useState(person?.document ?? ''); const [email, setEmail] = useState(person?.email ?? ''); const [phone, setPhone] = useState(person?.phone ?? ''); const [interested, setInterested] = useState(person?.roles.includes('INTERESSADO') ?? true); const [creditor, setCreditor] = useState(person?.roles.includes('CREDOR') ?? false); const [active, setActive] = useState(person?.active ?? true); const mutation = useMutation({ mutationFn: () => { const input = { kind, name, document: document || undefined, email: email || undefined, phone: phone || undefined, roles: [interested && 'INTERESSADO', creditor && 'CREDOR'].filter(Boolean) as Person['roles'], active }; return person ? api.updatePerson(ctx, person.id, input) : api.createPerson(ctx, input); }, onSuccess: () => { invalidateAll(client); onSaved(); } }); return <Dialog title={person ? 'Editar pessoa' : 'Cadastrar pessoa'} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo"><Select className="field" value={kind} onChange={(event) => setKind(event.target.value as Person['kind'])}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></Select></Field><Field label={kind === 'PF' ? 'Nome completo *' : 'Razão social *'}><Input className="field" value={name} onChange={(event) => setName(event.target.value)}/></Field><Field label={kind === 'PF' ? 'CPF' : 'CNPJ'}><Input className="field" value={document} onChange={(event) => setDocument(event.target.value)}/></Field><Field label="Telefone"><Input className="field" value={phone} onChange={(event) => setPhone(event.target.value)}/></Field></div><Field label="E-mail"><Input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)}/></Field><div className="flex gap-4 text-sm"><label><Checkbox checked={interested} onChange={(event) => setInterested(event.target.checked)}/> Interessado</label><label><Checkbox checked={creditor} onChange={(event) => setCreditor(event.target.checked)}/> Credor</label>{person && <label><Switch checked={active} onChange={(event) => setActive(event.target.checked)}/> Ativa</label>}</div>{mutation.error && <ErrorBox error={mutation.error}/>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={mutation.isPending}>Salvar</button></div></form></Dialog>; }
