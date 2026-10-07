import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

function menuPosition(trigger: HTMLButtonElement, count: number, menu?: HTMLDivElement | null) {
  const box = trigger.getBoundingClientRect()
  // Client rectangles use viewport pixels; the body portal inherits the interface zoom.
  const scale = menu?.offsetWidth ? menu.getBoundingClientRect().width / menu.offsetWidth : Number.parseFloat(getComputedStyle(document.body).zoom) || 1
  const width = menu ? menu.getBoundingClientRect().width : 200 * scale
  const maxHeight = (window.innerHeight - 16) / scale
  const height = Math.min(menu ? menu.getBoundingClientRect().height : (count * 40 + 12) * scale, window.innerHeight - 16)
  return {
    left: Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8)) / scale,
    top: (box.bottom + height + 6 <= window.innerHeight - 8 ? box.bottom + 6 : Math.max(8, box.top - height - 6)) / scale,
    maxHeight,
  }
}

export function ActionMenu({ label, items }: { label: string; items: Array<{ label: string; icon: ReactNode; action: () => void; danger?: boolean }> }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number }>()
  const expanded = Boolean(position)
  const close = () => { setPosition(undefined); trigger.current?.focus({ preventScroll: true }) }
  const open = () => {
    if (trigger.current) setPosition(menuPosition(trigger.current, items.length))
  }
  useLayoutEffect(() => {
    if (expanded && trigger.current) setPosition(menuPosition(trigger.current, items.length, menu.current))
  }, [expanded, items.length])
  useEffect(() => {
    if (!expanded) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(undefined) }
    const reposition = () => { if (trigger.current) setPosition(menuPosition(trigger.current, items.length, menu.current)) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true) }
  }, [expanded, items.length])
  return <>
    <button ref={trigger} type="button" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={label} title="Mais ações" aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? id : undefined} onClick={() => position ? close() : open()} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); open() } }}><MoreVertical size={17}/></button>
    {position && createPortal(<div id={id} ref={menu} role="menu" aria-label={label} className="fixed z-[180] w-[200px] overflow-y-auto rounded-lg border bg-white p-1.5 shadow-lg dark:bg-slate-900" style={position} onKeyDown={(event) => {
      const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus({ preventScroll: true }) }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
      if (event.key === 'Tab') close()
    }}>{items.map((item) => <button key={item.label} role="menuitem" type="button" className={`flex min-h-10 w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none ${item.danger ? 'mt-1 border-t text-destructive' : 'text-foreground'}`} onClick={() => { close(); item.action() }}>{item.icon}{item.label}</button>)}</div>, document.body)}
  </>
}
