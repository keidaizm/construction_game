import { useEffect, useRef } from 'react'

/** 開発用の FPS 表示。URL に ?fps を付けたときだけ表示する。 */
export function FpsMeter() {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let id = 0
    const tick = (now: number) => {
      frames++
      if (now - last >= 500) {
        if (el.current) el.current.textContent = `${Math.round((frames * 1000) / (now - last))} fps`
        frames = 0
        last = now
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])
  return <div ref={el} className="fps-meter" />
}
