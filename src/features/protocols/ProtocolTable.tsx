import { Link } from 'react-router-dom'
import type { Database, Protocol, ProtocolStatus } from '../../domain/model'
import { isActive, statusLabel } from '../../domain/model'
import { dateOnly } from '../../lib/format'

export const Name = ({ db, userId }: { db: Database; userId?: string }) => <>{db.users.find((user) => user.id === userId)?.name ?? '—'}</>
export const UnitName = ({ db, unitId }: { db: Database; unitId?: string }) => <>{db.units.find((unit) => unit.id === unitId)?.abbreviation ?? '—'}</>

export function StatusBadge({ status }: { status: ProtocolStatus }) {
  const styles: Record<ProtocolStatus, string> = { CADASTRADO: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', EM_ANDAMENTO: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', CONCLUIDO: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200', ARQUIVADO: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100' }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${styles[status]}`}>{statusLabel[status]}</span>
}

function AcknowledgementBadge({ db, protocol }: { db: Database; protocol: Protocol }) {
  const assignment = db.assignments.find((item) => item.id === protocol.currentAssignmentId)
  if (!protocol.currentAssigneeId) return <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aguardando responsável</span>
  if (isActive(protocol) && !assignment?.receivedAt) return <span role="status" className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">Ciência pendente</span>
  return <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Ciência registrada</span>
}

export function ProtocolTable({ db, protocols }: { db: Database; protocols: Protocol[] }) {
  return <>
    <div className="space-y-3 p-3 md:hidden">
      {protocols.map((protocol) => <article className="rounded-md border p-4" key={protocol.id}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><Link className="font-mono text-xs font-bold text-public-700" to={`/protocolos/${protocol.id}`}>{protocol.number}</Link><Link className="mt-1 block font-semibold hover:text-public-700" to={`/protocolos/${protocol.id}`}>{protocol.subject}</Link><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{db.protocolTypes.find((type) => type.id === protocol.typeId)?.name}</p></div>
          <StatusBadge status={protocol.status}/>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div className="min-w-0"><dt className="label">Unidade atual</dt><dd className="mt-1"><UnitName db={db} unitId={protocol.currentUnitId}/></dd></div>
          <div className="min-w-0"><dt className="label">Responsável atual</dt><dd className="mt-1">{protocol.currentAssigneeId ? <Name db={db} userId={protocol.currentAssigneeId}/> : <span className="font-semibold text-amber-700 dark:text-amber-300">Sem responsável</span>}</dd></div>
          <div><dt className="label">Ciência</dt><dd className="mt-1"><AcknowledgementBadge db={db} protocol={protocol}/></dd></div>
          <div><dt className="label">Prazo</dt><dd className={`mt-1 text-xs ${protocol.dueAt && new Date(protocol.dueAt) < new Date() && isActive(protocol) ? 'font-bold text-red-700 dark:text-red-300' : ''}`}>{dateOnly(protocol.dueAt)}</dd></div>
        </dl>
      </article>)}
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[940px] text-sm">
        <thead><tr><th scope="col" className="table-head">Número</th><th scope="col" className="table-head">Assunto</th><th scope="col" className="table-head">Unidade atual</th><th scope="col" className="table-head">Responsável atual</th><th scope="col" className="table-head">Ciência</th><th scope="col" className="table-head">Situação</th><th scope="col" className="table-head">Prazo</th></tr></thead>
        <tbody>{protocols.map((protocol) => <tr key={protocol.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800"><td className="px-3 py-3 font-mono text-xs font-bold text-public-700"><Link to={`/protocolos/${protocol.id}`}>{protocol.number}</Link></td><td className="max-w-[260px] px-3 py-3"><Link className="font-semibold hover:text-public-700" to={`/protocolos/${protocol.id}`}>{protocol.subject}</Link><small className="mt-1 block text-slate-500 dark:text-slate-400">{db.protocolTypes.find((type) => type.id === protocol.typeId)?.name}</small></td><td className="px-3 py-3"><UnitName db={db} unitId={protocol.currentUnitId}/><small className="mt-1 block text-slate-500 dark:text-slate-400">Ciclo atual</small></td><td className="px-3 py-3">{protocol.currentAssigneeId ? <Name db={db} userId={protocol.currentAssigneeId}/> : <span className="font-semibold text-amber-700 dark:text-amber-300">Sem responsável</span>}</td><td className="px-3 py-3"><AcknowledgementBadge db={db} protocol={protocol}/></td><td className="px-3 py-3"><StatusBadge status={protocol.status}/></td><td className={`px-3 py-3 text-xs ${protocol.dueAt && new Date(protocol.dueAt) < new Date() && isActive(protocol) ? 'font-bold text-red-700 dark:text-red-300' : ''}`}>{dateOnly(protocol.dueAt)}</td></tr>)}</tbody>
      </table>
    </div>
  </>
}