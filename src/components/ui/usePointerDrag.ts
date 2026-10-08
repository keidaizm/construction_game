import { useEffect, useRef, type RefObject } from 'react'

interface DragHandlers {
  onMove: (clientX: number, clientY: number) => void
  onEnd: () => void
}

/**
 * 1 本の指（またはマウス）によるドラッグを追跡する。
 * 複数のレバーを別々の指で同時に操作できるよう、要素ごとに pointerId を 1 つだけ受け持つ。
 * setPointerCapture により、指が要素の外に出ても離すまで追従する。
 *
 * 戻り値はドラッグ中かどうかの ref。
 */
export function usePointerDrag(target: RefObject<HTMLElement | null>, handlers: DragHandlers) {
  const active = useRef<number | null>(null)
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    const el = target.current
    if (!el) return

    const down = (e: PointerEvent) => {
      if (active.current !== null) return
      e.preventDefault()
      active.current = e.pointerId
      el.setPointerCapture(e.pointerId)
      latest.current.onMove(e.clientX, e.clientY)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active.current) return
      latest.current.onMove(e.clientX, e.clientY)
    }
    const end = (e: PointerEvent) => {
      if (e.pointerId !== active.current) return
      active.current = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      latest.current.onEnd()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('lostpointercapture', end)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      el.removeEventListener('lostpointercapture', end)
      if (active.current !== null) {
        active.current = null
        latest.current.onEnd()
      }
    }
  }, [target])

  return active as RefObject<number | null>
}
