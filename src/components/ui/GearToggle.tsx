import { useGameStore } from '../../stores/gameStore'
import { RabbitIcon, TurtleIcon } from './icons'

/**
 * 走る速さの切り替え（ウサギ = はやい / カメ = ゆっくり）。いまの速さの方が光る。
 * 乗っている車両の速さを切り替える（ショベル・ダンプで別々に覚えている）。
 */
export function GearToggle() {
  const gear = useGameStore((s) => s.gears[s.activeVehicle])
  const toggle = useGameStore((s) => s.toggleGear)
  return (
    <button
      type="button"
      className="gear-toggle"
      aria-label={gear === 'fast' ? 'はやい（おすと ゆっくり）' : 'ゆっくり（おすと はやい）'}
      onClick={toggle}
    >
      <span className={`gear-toggle__option${gear === 'fast' ? ' is-on' : ''}`}>
        <RabbitIcon />
      </span>
      <span className={`gear-toggle__option${gear === 'slow' ? ' is-on' : ''}`}>
        <TurtleIcon />
      </span>
    </button>
  )
}
