import { useEffect, type RefObject } from 'react'
import { dirtRegistry } from '../../cargo/dirt/dirtRegistry'
import { rollDrop } from '../../cargo/dirt/dirtConfig'
import { useGameStore } from '../../stores/gameStore'
import { rockRegistry } from '../../cargo/rocks/rockRegistry'
import { useCollectionStore } from '../../stores/collectionStore'
import { digEffects } from '../../effects/DigEffects'
import { audio } from '../../audio/AudioManager'
import { excavatorSensors } from './excavatorSensors'
import type { RigListener } from '../shared/rig'

/** ブロックを崩す間隔の最小 [s]（一度にごっそり崩れすぎないように） */
const DIG_INTERVAL = 0.15

/**
 * バケットの先が土の山に入ったら、ブロックを 1 こ崩す。
 * 崩すと土ぼこりが出て、ときどき石（その場でバケットに入りやすい）や鉱石が出てくる。
 */
export function useBucketDig(listeners: RefObject<RigListener[]>) {
  useEffect(() => {
    let cooldown = 0
    const listener: RigListener = {
      update(dt) {
        cooldown -= dt
        if (cooldown > 0) return
        // 土の山を崩すのはバケットだけ（ブレーカーは大きな岩を割る、グラップルは木材をつかむ）
        if (excavatorSensors.tool !== 'bucket') return
        const tip = excavatorSensors.bucketTip
        for (const mound of dirtRegistry.mounds) {
          if (Math.hypot(tip.x - mound.center[0], tip.z - mound.center[1]) > 3) continue
          const hit = mound.tryDig(tip.x, tip.y, tip.z)
          if (!hit) continue
          cooldown = DIG_INTERVAL
          digEffects.dust(hit.x, hit.y, hit.z)
          audio.play('dig')
          const drop = rollDrop(useGameStore.getState().timeOfDay, mound.treasure)
          if (drop.kind === 'rock') {
            rockRegistry.spawn?.(drop.color, hit.x, hit.y + 0.3, hit.z)
          } else if (drop.kind === 'ore') {
            const isNew = useCollectionStore.getState().add(drop.ore)
            digEffects.ore(drop.ore, hit.x, hit.y, hit.z)
            audio.play(isNew ? 'findNew' : 'find')
          }
          return
        }
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [listeners])
}
