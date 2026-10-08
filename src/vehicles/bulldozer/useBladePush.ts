import { useEffect, type RefObject } from 'react'
import * as THREE from 'three'
import { rockRegistry } from '../../cargo/rocks/rockRegistry'
import type { RigListener } from '../shared/rig'
import { BULLDOZER } from './bulldozerConfig'
import { bulldozerSensors } from './bulldozerSensors'

const { bladeWidth: W, bladeHeight: H } = BULLDOZER.geometry
/** 押している石が、排土板より先へ転がっていってよい速さ [m/s] */
const AHEAD_MARGIN = 0.3
/** 排土板の前のこの距離 [m] までの石を「押している石」とみなす（はじかれて少し先へ出た石も、追いつくまで待たせる） */
const PUSH_REACH = 1.2
/** 押している石の横すべりを、1 フレームごとに弱める割合 */
const SIDE_KEEP = 0.6

const inv = new THREE.Matrix4()
const local = new THREE.Vector3()
const fwd = new THREE.Vector3()
const side = new THREE.Vector3()

/**
 * 排土板のすぐ前にある石を、ブルドーザーといっしょに進ませる（押して運ぶ手ごたえ）。
 * 物理だけだと、ぶつかった石が勢いよく転がっていったり横へこぼれたりして、
 * 6 才には「押している」感じがしにくいため、前に進む速さと横すべりだけをおさえる。
 */
export function useBladePush(blade: RefObject<THREE.Group | null>, listeners: RefObject<RigListener[]>) {
  useEffect(() => {
    const listener: RigListener = {
      update() {
        const b = blade.current
        const speed = bulldozerSensors.speed
        if (!b || speed < 0.2) return
        inv.copy(b.matrixWorld).invert()
        fwd.set(0, 0, 1).transformDirection(b.matrixWorld)
        fwd.y = 0
        fwd.normalize()
        side.set(fwd.z, 0, -fwd.x)
        for (const rock of rockRegistry.rocks) {
          if (rock.state !== 'free') continue
          const p = rock.body.translation()
          local.set(p.x, p.y, p.z).applyMatrix4(inv)
          if (Math.abs(local.x) > W / 2 || local.y > H || local.z < 0 || local.z > PUSH_REACH) continue
          const v = rock.body.linvel()
          const vf = v.x * fwd.x + v.z * fwd.z
          const vs = v.x * side.x + v.z * side.z
          // 板に触れている石は板と同じ速さで進み、少し先へ出た石はブルドーザーが追いつくまでゆっくりになる
          const f = Math.min(Math.max(vf, local.z < 0.15 + rock.radius + 0.1 ? speed : 0), speed + AHEAD_MARGIN)
          const s = vs * SIDE_KEEP
          rock.body.setLinvel({ x: fwd.x * f + side.x * s, y: v.y, z: fwd.z * f + side.z * s }, true)
        }
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [blade, listeners])
}
