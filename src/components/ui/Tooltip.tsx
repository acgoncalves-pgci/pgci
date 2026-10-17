import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Tooltip({ content, children, className, style, tabIndex, delay = 180 }: {
  content: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  tabIndex?: number
  delay?: number
}) {
  const id = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const openTimer = useRef<number>()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; maxWidth: string }>()

  const show = () => {
    window.clearTimeout(openTimer.current)
    openTimer.current = window.setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    window.clearTimeout(openTimer.current)
    setOpen(false)
    setPosition(undefined)
  }

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current?.getBoundingClientRect()
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return
    const computedZoom = Number.parseFloat(window.getComputedStyle(document.body).zoom)
    const zoom = Number.isFinite(computedZoom) && computedZoom > 0 ? computedZoom : 1
    const gap = 6
    const padding = 8
    const viewportWidth = window.innerWidth / zoom
    const viewportHeight = window.innerHeight / zoom
    const maxWidth = `min(22rem, ${Math.max(1, viewportWidth - padding * 2)}px)`
    // O portal herda o zoom do body; os retângulos já estão em coordenadas visuais.
    tooltip.style.maxWidth = maxWidth
    const rect = tooltip.getBoundingClientRect()
    const width = rect.width / zoom
    const height = rect.height / zoom
    const top = trigger.top / zoom >= height + gap + padding
      ? trigger.top / zoom - height - gap
      : trigger.bottom / zoom + gap
    setPosition({
      top: Math.max(padding, Math.min(top, viewportHeight - height - padding)),
      left: Math.max(padding, Math.min((trigger.left + trigger.width / 2) / zoom - width / 2, viewportWidth - width - padding)),
      maxWidth,
    })
  }, [open, content])

  useEffect(() => {
    if (!open) return
    const close = () => hide()
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  useEffect(() => () => window.clearTimeout(openTimer.current), [])

  return <>
    <span
      ref={triggerRef}
      className={className ?? 'inline-flex'}
      style={style}
      tabIndex={tabIndex}
      aria-describedby={open ? id : undefined}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => { if (event.key === 'Escape') hide() }}
    >{children}</span>
    {open && createPortal(<span ref={tooltipRef} id={id} role="tooltip" className="ui-tooltip" style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, maxWidth: position?.maxWidth, visibility: position ? 'visible' : 'hidden' }}>{content}</span>, document.body)}
  </>
}
