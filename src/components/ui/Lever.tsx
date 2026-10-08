import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useInputStore, type AxisName } from '../../stores/inputStore'
import { clamp } from '../../controls/inputMath'
import { usePointerDrag } from './usePointerDrag'

interface LeverProps {
  axis: AxisName
  orientation: 'vertical' | 'horizontal'
  color: string
  /** 縦：上端 / 横：右端 に表示（値 +1 側） */
  positiveIcon: ReactNode
  /** 縦：下端 / 横：左端 に表示（値 -1 側） */
  negativeIcon: ReactNode
  label: string
}

/**
 * 作業機用レバー。
 * - 押した量に比例して速さが変わる（離すと中央に戻る）
 * - アイコンを含むレバー全体がタッチ領域。端のアイコンを押すと最大入力
 * - 指がレバーの外へずれても、離すまで操作が続く（pointer capture）
 */
export function Lever({ axis, orientation, color, positiveIcon, negativeIcon, label }: LeverProps) {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const vertical = orientation === 'vertical'

  const show = (value: number, animate: boolean) => {
    const t = track.current
    const k = knob.current
    if (!t || !k) return
    const half = ((vertical ? t.clientHeight : t.clientWidth) - (vertical ? k.offsetHeight : k.offsetWidth)) / 2
    const px = value * half
    k.style.transition = animate ? 'transform 120ms ease-out' : 'none'
    k.style.transform = vertical ? `translate(-50%, calc(-50% + ${-px}px))` : `translate(calc(-50% + ${px}px), -50%)`
    root.current?.classList.toggle('is-active', value !== 0)
  }

  const dragging = usePointerDrag(root, {
    onMove: (x, y) => {
      const t = track.current!.getBoundingClientRect()
      const k = knob.current!
      const half = ((vertical ? t.height : t.width) - (vertical ? k.offsetHeight : k.offsetWidth)) / 2
      const value = vertical
        ? clamp(-(y - (t.top + t.height / 2)) / half, -1, 1)
        : clamp((x - (t.left + t.width / 2)) / half, -1, 1)
      useInputStore.getState().setAxis('touch', axis, value)
      show(value, false)
    },
    onEnd: () => {
      useInputStore.getState().setAxis('touch', axis, 0)
      show(useInputStore.getState().sources.keyboard[axis], true)
    },
  })

  // キーボード操作中もレバーが動いて見えるようにする（対応関係を覚えやすい）
  useEffect(() => {
    show(0, false)
    return useInputStore.subscribe((s, prev) => {
      const v = s.sources.keyboard[axis]
      if (v !== prev.sources.keyboard[axis] && !dragging.current) show(v, true)
    })
    // show は ref のみ参照するため依存に含めない
  }, [axis, dragging])

  return (
    <div
      ref={root}
      className={`lever lever--${orientation}`}
      style={{ '--accent': color } as CSSProperties}
      role="slider"
      aria-label={label}
      aria-orientation={orientation}
    >
      <div className="lever__icon">{vertical ? positiveIcon : negativeIcon}</div>
      <div ref={track} className="lever__track">
        <div className="lever__groove" />
        <div ref={knob} className="lever__knob" />
      </div>
      <div className="lever__icon">{vertical ? negativeIcon : positiveIcon}</div>
    </div>
  )
}
