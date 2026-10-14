import { useEffect, type RefObject } from 'react'
import { BOULDERS } from '../../world/fieldLayout'
import { BOULDER_ROCK_COLOR, boulderDirty, boulderShape, boulderStates, useBoulderStore } from '../../world/boulders'
import { rockRegistry } from '../../cargo/rocks/rockRegistry'
import { ORES, type OreId } from '../../cargo/ores/oreTypes'
import { useCollectionStore } from '../../stores/collectionStore'
import { digEffects } from '../../effects/DigEffects'
import { audio } from '../../audio/AudioManager'
import { excavatorSensors } from './excavatorSensors'
import type { RigListener } from '../shared/rig'
import { buildingActive, hitBuilding, touchingBuilding } from '../../world/demolition'

/** のみの先が岩の形（だ円体）のこの倍まで近ければ「当たっている」（先は岩の上で止まるので、少し広めに） */
const CONTACT = 1.2
/** 叩く音・土ぼこりの間隔 [s] */
const HIT_INTERVAL = 0.11
/** 割れたときに、岩だけの鉱石が出る確率（どれか 1 つ） */
const BOULDER_ORES = ORES.filter((o) => o.fromBoulder)

function rollBoulderOre(): OreId | null {
  let r = Math.random() * 100
  for (const o of BOULDER_ORES) {
    if (r < o.weight) return o.id
    r -= o.weight
  }
  return null
}

/** のみの先がどの岩に当たっているか（なければ -1） */
function touchingBoulder(x: number, y: number, z: number) {
  for (let i = 0; i < BOULDERS.length; i++) {
    if (boulderStates[i].broken) continue
    const b = BOULDERS[i]
    if (Math.abs(x - b.x) > 5 || Math.abs(z - b.z) > 5) continue
    const sh = boulderShape(i)
    // 岩の向きにそった座標で、だ円体の中か
    const dx = x - sh.cx
    const dz = z - sh.cz
    const c = Math.cos(sh.yaw)
    const s = Math.sin(sh.yaw)
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    const e = Math.hypot(lx / sh.rx, (y - sh.cy) / sh.ry, lz / sh.rz)
    if (e < CONTACT) return i
  }
  return -1
}

/** 岩が割れた：消して、小さな石と（ときどき）鉱石を出す */
function breakBoulder(i: number) {
  const st = boulderStates[i]
  st.broken = true
  st.hp = 0
  boulderDirty.value = true
  useBoulderStore.getState().setBroken(boulderStates.flatMap((s, k) => (s.broken ? [k] : [])))
  const sh = boulderShape(i)
  const b = BOULDERS[i]
  audio.play('crack')
  for (let k = 0; k < 6; k++) digEffects.dust(sh.cx + (Math.random() - 0.5) * sh.rx, sh.cy + Math.random() * sh.ry, sh.cz + (Math.random() - 0.5) * sh.rz)
  // 小さな石：大きい岩ほど多く（3〜5 こ）。ミッションにも使える
  const count = 3 + Math.round((b.scale - 0.8) * 2.5)
  const color = BOULDER_ROCK_COLOR[b.biome]
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + Math.random() * 0.5
    const r = sh.rx * 0.45
    rockRegistry.spawn?.(color, sh.cx + Math.cos(a) * r, sh.cy + 0.2 + k * 0.15, sh.cz + Math.sin(a) * r)
  }
  const ore = rollBoulderOre()
  if (ore) {
    const isNew = useCollectionStore.getState().add(ore)
    digEffects.ore(ore, sh.cx, sh.cy + sh.ry, sh.cz)
    setTimeout(() => audio.play(isNew ? 'findNew' : 'find'), 250)
  }
}

/**
 * 油圧ブレーカー（Lv4）：のみの先を大きな岩に当てている間、自動で「ガガガ」と叩く（ユーザー判断：ボタンなし）。
 * 叩いている時間ぶん岩の固さが減り、ヒビ（色が暗くなる）が入って、0 で割れる。
 */
export function useBreaker(listeners: RefObject<{ update: (dt: number) => void }[]>) {
  useEffect(() => {
    let hitTimer = 0
    const listener: RigListener = {
      update(dt) {
        excavatorSensors.hammering = false
        if (excavatorSensors.tool !== 'breaker') return
        const tip = excavatorSensors.bucketTip
        // 古いビル（Lv7 で出てくる。出ていない間は当たらない）
        if (buildingActive.value && touchingBuilding(tip.x, tip.y, tip.z)) {
          excavatorSensors.hammering = true
          hitBuilding(dt, excavatorSensors.x, excavatorSensors.z)
          hitTimer -= dt
          if (hitTimer <= 0) {
            hitTimer = HIT_INTERVAL
            audio.play('hammer')
            digEffects.dust(tip.x, tip.y, tip.z)
          }
          return
        }
        const i = touchingBoulder(tip.x, tip.y, tip.z)
        if (i < 0) {
          hitTimer = 0
          return
        }
        excavatorSensors.hammering = true
        const st = boulderStates[i]
        st.hp -= dt
        st.shake = 1
        boulderDirty.value = true
        hitTimer -= dt
        if (hitTimer <= 0) {
          hitTimer = HIT_INTERVAL
          audio.play('hammer')
          digEffects.dust(tip.x, tip.y, tip.z)
        }
        if (st.hp <= 0) breakBoulder(i)
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [listeners])
}
