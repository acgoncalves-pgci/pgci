import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

export function OverflowMarquee({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const textElement = textRef.current
      if (container && textElement) setOverflowing(textElement.getBoundingClientRect().width > container.clientWidth + 1)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    if (containerRef.current) observer?.observe(containerRef.current)
    if (contentRef.current) observer?.observe(contentRef.current)
    if (textRef.current) observer?.observe(textRef.current)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [text])

  const duration = Math.max(7, Math.min(18, text.length * 0.22))
  return <span ref={containerRef} className={`overflow-marquee ${className ?? ''}`} data-overflow={overflowing ? 'true' : 'false'}>
    <span ref={contentRef} className="overflow-marquee-track" style={{ '--marquee-duration': `${duration}s` } as CSSProperties}>
      <span ref={textRef}>{text}</span>
      {overflowing && <span aria-hidden="true">{text}</span>}
    </span>
  </span>
}
