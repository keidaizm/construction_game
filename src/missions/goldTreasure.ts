import type { RockEntry } from '../cargo/rocks/rockRegistry'
import { rockRegistry } from '../cargo/rocks/rockRegistry'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'
import { useProgressStore } from '../stores/progressStore'
import { useToastStore } from '../stores/toastStore'
import { isKeepClear, STATIC_OBSTACLES, FIELD } from '../world/fieldLayout'

/** 1 つのミッションで金色の石が出る確率 */
export const GOLD_CHANCE = 0.5

/** 金色の石を置く場所を決める（木・岩・置き場・おきばから離れた、ふつうの地面） */
function pickSpot(): [number, number] | null {
  for (let i = 0; i < 200; i++) {
    const a = Math.random() * Math.PI * 2
    const d = 35 + Math.random() * (FIELD.driveLimit - 45)
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (isKeepClear(x, z)) continue
    if (STATIC_OBSTACLES.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 4)) continue
    return [x, z]
  }
  return null
}

/** ミッションのはじめに、ときどき金色の石をどこかに置く */
export function maybePlaceGoldRock() {
  if (Math.random() > GOLD_CHANCE) return
  const spot = pickSpot()
  if (spot) rockRegistry.spawn?.('gold', spot[0], 0.6, spot[1])
}

/** バケットで金色の石をすくった：星 +1、きらきら、控えに戻す */
export function findGoldRock(rock: RockEntry) {
  const p = rock.body.translation()
  digEffects.ore('gold', p.x, p.y, p.z)
  audio.play('findNew')
  useProgressStore.getState().addStars(1)
  useToastStore.getState().show({ title: 'きんいろの いしを みつけた！ ほし +1', icon: 'star', color: '#ffc933', stars: 0, isNew: false })
  rockRegistry.despawn?.(rock)
}
