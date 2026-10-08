import { useEffect, useState } from 'react'
import { explorePercent, useExplorationStore } from '../../stores/explorationStore'
import { useProgressStore } from '../../stores/progressStore'
import { audio } from '../../audio/AudioManager'
import { Overlay } from './MissionUI'
import { useCelebrationStore } from '../../stores/celebrationStore'

/** 地図を全部探検したときにもらえる星 */
const MAP_COMPLETE_STARS = 5

/**
 * 地図の探検が 100% になったときのお祝い（ユーザー要望）。1 回だけ星 +5 と、花吹雪の「ちず コンプリート！」。
 * 星でグレードアップしたら、閉じたあとにグレードアップのお祝い（LevelUpCelebration）が出る。
 */
export function MapCompleteOverlay() {
  const cells = useExplorationStore((s) => s.cells)
  const rewarded = useExplorationStore((s) => s.completeRewarded)
  const [shown, setShown] = useState(false)
  // 出ている間は、グレードアップのお祝いを待たせる（閉じたあとに出る）
  const setCelebrating = useCelebrationStore((s) => s.setMapComplete)
  useEffect(() => setCelebrating(shown), [shown, setCelebrating])

  useEffect(() => {
    if (rewarded || explorePercent(cells) < 100) return
    useExplorationStore.getState().setCompleteRewarded()
    useProgressStore.getState().addStars(MAP_COMPLETE_STARS)
    audio.play('missionClear')
    setShown(true)
  }, [cells, rewarded])

  if (!shown) return null
  return (
    <Overlay confetti>
      <div className="mapdone__icon" aria-hidden>
        🗺️
      </div>
      <div className="clear__title">ちず コンプリート！</div>
      <div className="levelup__text">ぜんぶの ばしょを たんけんしたよ！</div>
      <div className="mapdone__stars">★ +{MAP_COMPLETE_STARS}</div>
      <button type="button" className="clear__next" onClick={() => setShown(false)}>
        やったね！
      </button>
    </Overlay>
  )
}
