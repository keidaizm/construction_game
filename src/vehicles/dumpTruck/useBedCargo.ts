import { useEffect, useRef, type RefObject } from 'react'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { rockRegistry, type RockEntry } from '../../cargo/rocks/rockRegistry'
import { logRegistry, type LogEntry } from '../../cargo/logs/logRegistry'
import { useGameStore } from '../../stores/gameStore'
import { audio } from '../../audio/AudioManager'
import type { RigListener } from '../shared/rig'
import { DUMP_TRUCK, truckShape } from './dumpTruckConfig'
import { dumpTruckSensors } from './dumpTruckSensors'

const { cargo: C } = DUMP_TRUCK

/** 荷台に載せられるもの：岩と木材（Lv6） */
type Cargo = RockEntry | LogEntry
const isRock = (c: Cargo): c is RockEntry => 'batchId' in c

interface Loaded {
  rock: Cargo
  /** 荷台に対する岩の位置と向き */
  local: THREE.Matrix4
  prevWorld: THREE.Vector3
  velocity: THREE.Vector3
}

const inv = new THREE.Matrix4()
const m = new THREE.Matrix4()
const p = new THREE.Vector3()
const q = new THREE.Quaternion()
const sc = new THREE.Vector3()
const one = new THREE.Vector3(1, 1, 1)
const downhill = new THREE.Vector3()
const vel = new THREE.Vector3()

/**
 * 荷台に岩を載せる・降ろす補助ロジック。
 *
 * 走っている荷台の上で岩を物理演算させると、滑ったり跳ねたりして落ちやすい。そこで、
 * 荷台が下りているときに荷台の中で落ち着いた岩は、荷台に固定して一緒に動かす。
 * 荷台を上げたら物理に戻し、傾きで後ろへ滑り落ちるようにする。
 * 木材（Lv6、グラップルで積む）も岩と同じように載せて運ぶ。
 */
export function useBedCargo(
  bed: RefObject<THREE.Group | null>,
  listeners: RefObject<RigListener[]>,
) {
  const { rapier } = useRapier()
  const loaded = useRef<Loaded[]>([])
  /** 荷台を上げて降ろしている最中の岩（荷台から出るまで後ろへ押す） */
  const unloading = useRef<Cargo[]>([])
  const resetToken = useGameStore((s) => s.resetToken)

  // リセット時は岩側（RockPile）が岩を元に戻すので、載せている記録だけ消す
  useEffect(() => {
    loaded.current = []
    unloading.current = []
  }, [resetToken])

  useEffect(() => {
    const load = (rock: Cargo, bedMatrix: THREE.Matrix4) => {
      const t = rock.body.translation()
      const r = rock.body.rotation()
      rock.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
      rock.state = 'truck'
      loaded.current.push({
        rock,
        local: new THREE.Matrix4()
          .copy(bedMatrix)
          .invert()
          .multiply(m.compose(p.set(t.x, t.y, t.z), q.set(r.x, r.y, r.z, r.w), one)),
        prevWorld: new THREE.Vector3(t.x, t.y, t.z),
        velocity: new THREE.Vector3(),
      })
    }

    const unload = (l: Loaded, batchId: number) => {
      l.rock.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
      l.rock.body.setLinvel(l.velocity.clampLength(0, 6), true)
      l.rock.state = 'free'
      if (isRock(l.rock)) l.rock.batchId = batchId
      unloading.current.push(l.rock)
      audio.play('rockDrop')
    }

    const listener: RigListener = {
      update(dt) {
        const b = bed.current
        if (!b) return
        // いまのダンプの荷台の大きさ（Lv5 から重ダンプ）
        const G = truckShape.current
        const INNER_HALF_WIDTH = G.bedWidth / 2 - G.bedWallThickness
        const INNER_LENGTH = G.bedLength - G.bedWallThickness
        const TOP = G.bedFloorThickness + G.bedWallHeight + 0.3
        const angle = dumpTruckSensors.bedAngle
        // ショベルですくい出された岩（state が truck でなくなった）は荷台の記録から外す
        loaded.current = loaded.current.filter((l) => l.rock.state === 'truck')

        // --- 荷台を上げたら降ろす ---
        if (angle > C.releaseAboveAngle && loaded.current.length > 0) {
          // 1 回の荷下ろしで降ろした岩は、足し算の式の 1 つの数になる
          const batchId = rockRegistry.nextBatchId()
          for (const l of loaded.current) unload(l, batchId)
          loaded.current = []
        }

        // 荷台の端の角に引っかかって止まらないよう、荷台の中にいる間は後ろ向きに少し押し続ける
        if (angle > C.slideAssistAboveAngle && unloading.current.length > 0) {
          inv.copy(b.matrixWorld).invert()
          downhill.set(0, 0, -1).transformDirection(b.matrixWorld)
          unloading.current = unloading.current.filter((rock) => {
            if (rock.state !== 'free') return false
            const t = rock.body.translation()
            p.set(t.x, t.y, t.z).applyMatrix4(inv)
            const inBed = Math.abs(p.x) < G.bedWidth / 2 + 0.1 && p.z > -0.35 && p.z < G.bedLength && p.y < TOP + 0.5
            if (!inBed) return false
            const v = rock.body.linvel()
            vel.set(v.x, v.y, v.z)
            const along = vel.dot(downhill)
            if (along < C.slideOutSpeed) rock.body.setLinvel(vel.addScaledVector(downhill, C.slideOutSpeed - along), true)
            return true
          })
        } else if (angle <= C.releaseAboveAngle) {
          unloading.current = []
        }

        // --- 荷台の中で落ち着いた岩を固定する ---
        if (angle < C.attachBelowAngle && Math.abs(dumpTruckSensors.speed) < 0.3) {
          inv.copy(b.matrixWorld).invert()
          for (const rock of [...rockRegistry.rocks, ...logRegistry.logs]) {
            if (rock.state !== 'free') continue
            const t = rock.body.translation()
            p.set(t.x, t.y, t.z).applyMatrix4(inv)
            if (Math.abs(p.x) > INNER_HALF_WIDTH || p.z < 0 || p.z > INNER_LENGTH || p.y > TOP || p.y < -0.2) continue
            const v = rock.body.linvel()
            if (Math.hypot(v.x, v.y, v.z) > C.settleSpeed) continue
            load(rock, b.matrixWorld)
            audio.play('rockLoad')
          }
        }

        // --- 載っている岩を荷台に追従させる ---
        for (const l of loaded.current) {
          m.multiplyMatrices(b.matrixWorld, l.local).decompose(p, q, sc)
          if (dt > 0) l.velocity.subVectors(p, l.prevWorld).divideScalar(dt)
          l.prevWorld.copy(p)
          l.rock.body.setNextKinematicTranslation(p)
          l.rock.body.setNextKinematicRotation(q)
        }

        // 数える（札・ミッション）のは岩だけ
        dumpTruckSensors.loadedCount = loaded.current.filter((l) => isRock(l.rock)).length
        dumpTruckSensors.loadedLogs = loaded.current.length - dumpTruckSensors.loadedCount
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [bed, listeners, rapier])
}
