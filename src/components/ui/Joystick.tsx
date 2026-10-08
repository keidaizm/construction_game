import { useEffect, useRef, type ReactNode } from 'react'
import { useInputStore } from '../../stores/inputStore'
import { CrawlerIcon } from './icons'
import { usePointerDrag } from './usePointerDrag'

/**
 * 走行用ジョイスティック。上 = 前進、下 = 後退、左右 = 旋回（ダンプはハンドル）。
 * icon：つまみに描く絵（どの車両を運転しているか分かるように）
 * 周りの余白もタッチ領域に含め、指が多少ずれても操作が途切れないようにする。
 */
export function Joystick({ icon = <CrawlerIcon />, label = 'はしる' }: { icon?: ReactNode; label?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)

  const show = (x: number, y: number, animate: boolean) => {
    const b = base.current
    const k = knob.current
    if (!b || !k) return
    const r = (b.clientWidth - k.offsetWidth) / 2
    k.style.transition = animate ? 'transform 120ms ease-out' : 'none'
    k.style.transform = `translate(calc(-50% + ${x * r}px), calc(-50% + ${-y * r}px))`
    root.current?.classList.toggle('is-active', x !== 0 || y !== 0)
  }

  const dragging = usePointerDrag(root, {
    onMove: (cx, cy) => {
      const rect = base.current!.getBoundingClientRect()
      const r = (rect.width - knob.current!.offsetWidth) / 2
      let x = (cx - (rect.left + rect.width / 2)) / r
      let y = -(cy - (rect.top + rect.height / 2)) / r
      const len = Math.hypot(x, y)
      if (len > 1) {
        x /= len
        y /= len
      }
      useInputStore.getState().setAxes('touch', { driveX: x, driveY: y })
      show(x, y, false)
    },
    onEnd: () => {
      useInputStore.getState().setAxes('touch', { driveX: 0, driveY: 0 })
      const k = useInputStore.getState().sources.keyboard
      show(k.driveX, k.driveY, true)
    },
  })

  useEffect(() => {
    show(0, 0, false)
    return useInputStore.subscribe((s, prev) => {
      const k = s.sources.keyboard
      if (dragging.current) return
      if (k.driveX !== prev.sources.keyboard.driveX || k.driveY !== prev.sources.keyboard.driveY) {
        const len = Math.max(1, Math.hypot(k.driveX, k.driveY))
        show(k.driveX / len, k.driveY / len, true)
      }
    })
  }, [dragging])

  return (
    <div ref={root} className="joystick" role="slider" aria-label={label}>
      <div ref={base} className="joystick__base">
        <span className="joystick__arrow joystick__arrow--up">▲</span>
        <span className="joystick__arrow joystick__arrow--down">▼</span>
        <span className="joystick__arrow joystick__arrow--left">◀</span>
        <span className="joystick__arrow joystick__arrow--right">▶</span>
        <div ref={knob} className="joystick__knob">
          {icon}
        </div>
      </div>
    </div>
  )
}
