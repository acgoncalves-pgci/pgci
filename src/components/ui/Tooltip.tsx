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
  const [position, setPosition] = useState<{ top: number; left: number }>()

  const show = () => {
    window.clearTimeout(openTimer.current)
    openTimer.current = window.setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    window.clearTimeout(openTimer.current)
    setOpen(false)
  }

  useLayoutEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const tooltip = tooltipRef.current?.getBoundingClientRect()
      if (!trigger || !tooltip) return
      const gap = 8
      const top = trigger.top >= tooltip.height + gap
        ? trigger.top - tooltip.height - gap
        : trigger.bottom + gap
      setPosition({
        top: Math.max(gap, Math.min(top, window.innerHeight - tooltip.height - gap)),
        left: Math.max(gap, Math.min(trigger.left + trigger.width / 2 - tooltip.width / 2, window.innerWidth - tooltip.width - gap)),
      })
    })
    return () => window.cancelAnimationFrame(frame)
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
      className={className}
      style={style}
      tabIndex={tabIndex}
      aria-describedby={open ? id : undefined}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => { if (event.key === 'Escape') hide() }}
    >{children}</span>
    {open && createPortal(<span ref={tooltipRef} id={id} role="tooltip" className="ui-tooltip" style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, visibility: position ? 'visible' : 'hidden' }}>{content}</span>, document.body)}
  </>
}
