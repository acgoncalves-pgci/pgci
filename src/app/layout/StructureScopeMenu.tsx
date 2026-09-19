import { useCallback, useEffect, useRef, useState } from 'react'
import { BriefcaseBusiness, Check, ChevronDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAll, useDb } from '../queries'
import { useSession } from '../session'
import type { Role } from '../../domain/model'
import { unitPath } from '../../domain/units'

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrador geral',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
  LEITOR: 'Leitor',
}

export function StructureScopeMenu() {
  const { user, activeUnitId, setActiveUnitId, scopeUnitId, setScopeUnitId } = useSession()
  const { data: db } = useDb()
  const client = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [close, open])

  if (!db || !user) return null

  const today = new Date()
  const memberships = db.memberships
    .filter((membership) =>
      membership.userId === user.id &&
      membership.active &&
      new Date(membership.startsAt) <= today &&
      (!membership.endsAt || new Date(membership.endsAt) >= today),
    )
    .map((membership) => ({
      membership,
      unit: db.units.find((unit) => unit.id === membership.unitId && unit.active),
    }))
    .filter((item): item is typeof item & { unit: NonNullable<typeof item.unit> } => Boolean(item.unit))
    .sort((left, right) => unitPath(db.units, left.unit.id).localeCompare(unitPath(db.units, right.unit.id), 'pt-BR'))

  const selectedUnit = scopeUnitId === 'ALL' ? undefined : db.units.find((unit) => unit.id === scopeUnitId)
  const selectedMembership = selectedUnit ? memberships.find((item) => item.unit.id === selectedUnit.id)?.membership : undefined
  const selectedParent = selectedUnit?.parentId ? db.units.find((unit) => unit.id === selectedUnit.parentId) : undefined
  const label = selectedUnit?.name ?? 'Todos'
  const secondaryLabel = selectedParent?.name ?? (selectedMembership ? roleLabels[selectedMembership.role] : undefined)

  const choose = async (unitId: string) => {
    if (unitId === 'ALL') {
      setScopeUnitId('ALL')
    } else {
      setActiveUnitId(unitId)
      setScopeUnitId(unitId)
    }
    close()
    await invalidateAll(client)
  }

  return <div ref={containerRef} className="relative hidden sm:block">
    <button
      type="button"
      className="flex min-h-10 items-center gap-2 rounded-lg border border-current/20 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]"
      aria-label={'Selecionar contexto de estrutura. Atual: ' + label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      <BriefcaseBusiness size={16} className="shrink-0 text-current" aria-hidden="true"/>
      <span className="min-w-0 text-left leading-tight"><span className="block whitespace-nowrap">{label}</span>{secondaryLabel && <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium opacity-70">{secondaryLabel}</span>}</span>
      <ChevronDown size={14} className={'shrink-0 transition-transform ' + (open ? 'rotate-180' : '')} aria-hidden="true"/>
    </button>

    {open && <div role="dialog" aria-label="Contexto ativo" className="structure-scope-popover absolute right-0 top-[calc(100%+.5rem)] z-[95] w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-bold">Contexto ativo</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Escolha em qual setor você quer atuar.</p>
      </div>
      <div className="space-y-1 p-2">
        <button type="button" className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800" aria-current={scopeUnitId === 'ALL' ? 'true' : undefined} onClick={() => void choose('ALL')}>
          <span className="mt-0.5 w-4 shrink-0 text-emerald-600 dark:text-emerald-400">{scopeUnitId === 'ALL' && <Check size={16}/>}</span>
          <span><strong className="block text-sm">Todos</strong><small className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Ver tudo da entidade dentro dos seus acessos</small></span>
        </button>
        {memberships.map(({ membership, unit }) => {
          const selected = scopeUnitId === unit.id
          const parent = unit.parentId ? db.units.find((candidate) => candidate.id === unit.parentId) : undefined
          const context = parent?.name ?? roleLabels[membership.role]
          return <button key={membership.id} type="button" className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800" aria-current={selected ? 'true' : undefined} onClick={() => void choose(unit.id)}>
            <span className="mt-0.5 w-4 shrink-0 text-emerald-600 dark:text-emerald-400">{selected && <Check size={16}/>}</span>
            <span><strong className="block text-sm">{unit.name}</strong><small className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{context}</small></span>
          </button>
        })}
      </div>
      <p className="sr-only">A unidade operacional atual é {db.units.find((unit) => unit.id === activeUnitId)?.name ?? 'não definida'}.</p>
    </div>}
  </div>
}

