import { Checkbox } from '../../components/ui/Checkbox'
import { permissionGroups } from '../../domain/permissions'
import type { Permission } from '../../domain/permissions'

export function PermissionGrid({ value, onChange }: { value: Permission[]; onChange: (value: Permission[]) => void }) {
  return <div className="space-y-3" aria-label="Permissões detalhadas">
    {permissionGroups.map((group) => <fieldset key={group.label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{group.label}</legend>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {group.items.map(([key, label]) => <label key={key} className="flex min-w-0 items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <Checkbox aria-label={`${group.label}: ${label}`} checked={value.includes(key)} onChange={(event) => onChange(event.target.checked ? [...value, key] : value.filter((item) => item !== key))} />
          <span>{label}</span>
        </label>)}
      </div>
    </fieldset>)}
  </div>
}
