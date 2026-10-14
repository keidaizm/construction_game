import { availableTools, useGameStore, type ExcavatorTool } from '../../stores/gameStore'
import { useLevel } from '../../stores/progressStore'
import { BreakerToolIcon, BucketToolIcon, GrappleToolIcon, SkeletonToolIcon } from './icons'

const ICONS: Record<ExcavatorTool, () => React.JSX.Element> = {
  bucket: BucketToolIcon,
  breaker: BreakerToolIcon,
  grapple: GrappleToolIcon,
  skeleton: SkeletonToolIcon,
}
const NAMES: Record<ExcavatorTool, string> = { bucket: 'バケット', breaker: 'ブレーカー', grapple: 'グラップル', skeleton: 'スケルトンバケット' }

/**
 * ショベルのアタッチメントの切り替え（バケット → ブレーカー（Lv4）→ グラップル（Lv6）→ スケルトンバケット（Lv7））。
 * 使えるようになったものだけ並べ、いま付いている方が光る。押すと次へ。
 */
export function ToolToggle() {
  const level = useLevel()
  const tool = useGameStore((s) => s.excavatorTool)
  const toggle = useGameStore((s) => s.toggleExcavatorTool)
  const tools = availableTools(level.level)
  if (tools.length < 2) return null
  return (
    <button type="button" className="gear-toggle tool-toggle" aria-label={`${NAMES[tool]}（おすと つぎの アタッチメント）`} onClick={toggle}>
      {tools.map((t) => {
        const Icon = ICONS[t]
        return (
          <span key={t} className={`gear-toggle__option${tool === t ? ' is-on' : ''}`}>
            <Icon />
          </span>
        )
      })}
    </button>
  )
}
