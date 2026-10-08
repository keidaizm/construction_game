import { useEffect, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { rockRegistry, type RockEntry } from '../../cargo/rocks/rockRegistry'
import { useGameStore } from '../../stores/gameStore'
import { audio } from '../../audio/AudioManager'
import { BUCKET_CAPTURE_POLYGON, BUCKET_SLOTS_BY_CAPACITY, BUCKET_WIDTH, pointInPolygon } from './bucketShape'
import { useProgressStore } from '../../stores/progressStore'
import { levelForStars } from '../../missions/levels'
import { excavatorSensors } from './excavatorSensors'
import type { RigListener } from '../shared/rig'
import { landingTargetNear } from '../shared/digFloors'
import { findGoldRock } from '../../missions/goldTreasure'

/**
 * バケットの口の向き（上向き度合い）。
 * +1 = 口が真上（しっかり持てる）、0 = 横向き（掘っている最中）、-1 = 真下（こぼれる）
 */
const CAN_GRAB_ABOVE = -0.35
const SPILL_BELOW = -0.6
/**
 * 「開けば落ちる」を分かりやすくするため、口の向きに関係なくこぼす条件（開き具合 0〜1）。
 * - 開く操作をしている最中に OPENING_SPILL_RATIO を超えた
 * - 開き具合が SPILL_OPEN_RATIO を超えている
 * （ブームを上げてアームを引いた姿勢では、開いても口が上を向いたままなので、向きだけで判定すると落ちない）
 */
const OPENING_SPILL_RATIO = 0.3
const SPILL_OPEN_RATIO = 0.6
/** こぼした岩を、バケットから出るまでこの速さ [m/s] で爪の方へ流し出す */
const POUR_SPEED = 1.5
/**
 * すくう動き（アームを引く・バケットを巻き込む）をしている間、バケットの口の前の石を中へ引き寄せる速さ [m/s]。
 * バケットが大きいほど速く・広く（大きいバケットでも、小さいときと同じくらいすくいやすく）
 */
const PULL_SPEED = 1.3
/** 引き寄せる範囲（バケットのローカル座標＝バケットの大きさに比例） */
const PULL_RANGE = 1.5
/** バケットのローカル座標での、口の中のまん中あたり（引き寄せる先） */
const CUP_CENTER = new THREE.Vector3(0, 0.15, 0.6)
/** 車体の上に乗ってしまった岩を、外へ押し出す速さ [m/s] */
const SLIDE_OFF_SPEED = 2
/** すくった岩がスロットへ収まるまでの時間 [s] */
const SETTLE_TIME = 0.25
/** 落とした岩が再びすくわれない時間 [s] */
const COOLDOWN = 1.0
/** こぼすときの 1 個ごとの間隔 [s]（ゴロゴロと順に落ちる） */
const SPILL_INTERVAL = 0.08
/** こぼすとき、バケットの速度をどれだけ岩に引き継ぐか */
const SPILL_INHERIT = 0.25

interface Held {
  rock: RockEntry
  slot: number
  /** すくった瞬間のバケットローカル位置（ここからスロットへ移動する） */
  from: THREE.Vector3
  /** バケットに対する岩の向き */
  localQuat: THREE.Quaternion
  age: number
  prevWorld: THREE.Vector3
  velocity: THREE.Vector3
}

const bucketPos = new THREE.Vector3()
const bucketQuat = new THREE.Quaternion()
const bucketScale = new THREE.Vector3()
const inv = new THREE.Matrix4()
const local = new THREE.Vector3()
const world = new THREE.Vector3()
const openDir = new THREE.Vector3()
const q = new THREE.Quaternion()
const slotVec = new THREE.Vector3()
const pourDir = new THREE.Vector3()
const vel = new THREE.Vector3()
/** バケットローカルで、岩が口から爪の上を越えて出ていく方向 */
const POUR_LOCAL = new THREE.Vector3(0, -0.4, 1).normalize()
const pourOut = new THREE.Vector3()
const cupWorld = new THREE.Vector3()
const pullDir = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * バケットで岩をすくう・運ぶ・こぼす補助ロジック。
 *
 * 完全な物理でバケットに岩を載せると震えたりすり抜けたりしやすいので、
 * 「口が上〜横を向いているときに、岩がバケットの中の領域へ入ったら、バケットに追従させる」。
 * 口が下を向く、またはバケットを開くと物理に戻し、バケットから出るまで流し出す。
 */
export function useBucketGrab(bucket: RefObject<THREE.Group | null>, listeners: RefObject<RigListener[]>) {
  const { rapier } = useRapier()
  const clock = useThree((s) => s.clock)
  const held = useRef<Held[]>([])
  /** バケットを開いている間に、バケットの中・まわりにいる岩（出るまで流し出す） */
  const pouring = useRef<{ rock: RockEntry; age: number }[]>([])
  const resetToken = useGameStore((s) => s.resetToken)

  // リセット時は岩側（RockPile）が岩を元に戻すので、持っている記録だけ消す
  useEffect(() => {
    held.current = []
    pouring.current = []
  }, [resetToken])

  useEffect(() => {
    let spillTimer = 0
    let prevOpenRatio = excavatorSensors.bucketOpenRatio
    /** いまこぼしている回の番号（こぼし始めに発行、こぼし終わったら 0） */
    let spillBatch = 0

    /** バケットの中（すくい判定の領域）にいるか */
    const insideBucket = (rock: RockEntry) => {
      const p = rock.body.translation()
      local.set(p.x, p.y, p.z).applyMatrix4(inv)
      return Math.abs(local.x) <= BUCKET_WIDTH / 2 + rock.radius + 0.05 && pointInPolygon(local.y, local.z, BUCKET_CAPTURE_POLYGON)
    }

    /**
     * バケットの中か、すぐまわり（背中に乗っている・ふちに引っかかっている）にいるか。
     * 開いたバケットから出す対象を決めるのに使う（すくう判定より少し広い）
     */
    const nearBucket = (rock: RockEntry) => {
      const p = rock.body.translation()
      local.set(p.x, p.y, p.z).applyMatrix4(inv)
      return (
        Math.abs(local.x) <= BUCKET_WIDTH / 2 + rock.radius + 0.15 &&
        local.z > -0.5 &&
        local.z < 1.6 &&
        local.y > -0.8 &&
        local.y < 0.95
      )
    }

    /**
     * ショベルの車体（履帯・上部）の上に乗っているか。
     * アームを手前に引いた姿勢でこぼすと、岩が車体の上に落ちて止まることがあるため
     */
    const onExcavatorBody = (rock: RockEntry) => {
      const p = rock.body.translation()
      const S = excavatorSensors.scale
      if (p.y < 0.55 || p.y > 3.2 * S) return false
      const dx = p.x - excavatorSensors.x
      const dz = p.z - excavatorSensors.z
      const s = Math.sin(excavatorSensors.heading)
      const c = Math.cos(excavatorSensors.heading)
      const lx = dx * c - dz * s
      const lz = dx * s + dz * c
      return (Math.abs(lx) < 1.5 * S && Math.abs(lz) < 2.5 * S) || Math.hypot(dx, dz) < 2.4 * S
    }

    /** ダンプの荷台の近くなら、落ちる先を荷台の中へ寄せる（少しずれていても入るように） */
    const aimAtTruckBed = (rock: RockEntry) => {
      const p = rock.body.translation()
      const target = landingTargetNear(p.x, p.z, 1.2, 0.45)
      if (!target || p.y <= target.top) return
      const fallTime = Math.sqrt((2 * (p.y - target.top)) / 9.81)
      rock.body.setLinvel({ x: (target.x - p.x) / fallTime, y: 0, z: (target.z - p.z) / fallTime }, true)
    }

    /** 今のレベルのバケットに並べられる位置（数 = 一度にすくえる最大） */
    const slots = () => BUCKET_SLOTS_BY_CAPACITY[levelForStars(useProgressStore.getState().stars).bucketCapacity]

    const grab = (rock: RockEntry, bucketLocal: THREE.Vector3) => {
      if (rock.color === 'gold') {
        findGoldRock(rock)
        return
      }
      const used = new Set(held.current.map((h) => h.slot))
      const slot = slots().findIndex((_, i) => !used.has(i))
      if (slot < 0) return
      const r = rock.body.rotation()
      const t = rock.body.translation()
      rock.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
      rock.state = 'held'
      held.current.push({
        rock,
        slot,
        from: bucketLocal.clone(),
        localQuat: bucketQuat.clone().invert().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w)),
        age: 0,
        prevWorld: new THREE.Vector3(t.x, t.y, t.z),
        velocity: new THREE.Vector3(),
      })
      audio.play('rockHit')
    }

    const spill = (h: Held) => {
      const { rock } = h
      if (spillBatch === 0) spillBatch = rockRegistry.nextBatchId()
      rock.batchId = spillBatch
      rock.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
      // バケットの勢いは少しだけ引き継ぎ（全部だと開く動きで遠くへ飛ぶ）、爪の方へ流し出す
      const v = h.velocity.multiplyScalar(SPILL_INHERIT).clampLength(0, 2).addScaledVector(pourDir, POUR_SPEED)
      rock.body.setLinvel(v, true)
      pouring.current.push({ rock, age: 0 })
      rock.state = 'free'
      rock.grabCooldownUntil = clock.elapsedTime + COOLDOWN
      rock.mesh.scale.setScalar(1)
      audio.play('rockDrop')
    }

    const listener: RigListener = {
      update(dt) {
        const b = bucket.current
        if (!b) return
        // ブレーカー・グラップルに付けかえたら、持っていた石はその場に落とし、すくう・引き寄せる手助けはしない
        if (excavatorSensors.tool !== 'bucket') {
          while (held.current.length > 0) spill(held.current.pop()!)
          pouring.current = []
          return
        }
        b.matrixWorld.decompose(bucketPos, bucketQuat, bucketScale)
        inv.copy(b.matrixWorld).invert()
        openDir.set(0, -1, 0).applyQuaternion(bucketQuat)
        const up = openDir.y // 口の外向き（ローカル -Y）が上を向いているほど大きい
        pourDir.copy(POUR_LOCAL).applyQuaternion(bucketQuat)
        const openRatio = excavatorSensors.bucketOpenRatio
        const opening = openRatio > prevOpenRatio + 1e-4
        prevOpenRatio = openRatio

        // --- こぼす ---
        const spilling =
          up < SPILL_BELOW || openRatio > SPILL_OPEN_RATIO || (opening && openRatio > OPENING_SPILL_RATIO)
        if (spilling && held.current.length > 0) {
          spillTimer -= dt
          if (spillTimer <= 0) {
            spill(held.current.pop()!)
            spillTimer = SPILL_INTERVAL
          }
        } else {
          spillTimer = 0
          spillBatch = 0
        }

        // --- バケットを開いている間は、中・まわりの岩を外へ流し出す ---
        // （口が上を向いたままだと、物理だけでは岩がバケットの中に残ってしまう。
        //   こぼした岩だけでなく、掘って出てきた岩・落ちてきた岩・背中に乗った岩も、出るまで押し出す）
        if (spilling) {
          for (const rock of rockRegistry.rocks) {
            if (rock.state !== 'free' || rock.color === 'gold') continue
            if (pouring.current.some((p) => p.rock === rock)) continue
            if (nearBucket(rock)) pouring.current.push({ rock, age: 0 })
          }
          // 押し出す向き：ふだんは爪の方。口が上を向いているときは、ふちを越えるように横＋少し上へ
          if (pourDir.y > 0.2) {
            pourOut.set(pourDir.x, 0, pourDir.z)
            if (pourOut.lengthSq() < 1e-4) pourOut.set(0, 0, 1).applyQuaternion(bucketQuat).setY(0)
            pourOut.normalize().multiplyScalar(1.8).addScaledVector(UP, 1.3)
          } else {
            pourOut.copy(pourDir).multiplyScalar(POUR_SPEED)
          }
          const speed = pourOut.length()
          const dir = pourOut.clone().divideScalar(speed)
          pouring.current = pouring.current.filter((p) => {
            p.age += dt
            if (p.rock.state !== 'free') return false
            if (!nearBucket(p.rock)) {
              aimAtTruckBed(p.rock)
              return false
            }
            // 出るまでは再びすくわれないようにする
            p.rock.grabCooldownUntil = Math.max(p.rock.grabCooldownUntil, clock.elapsedTime + 0.5)
            const v = p.rock.body.linvel()
            vel.set(v.x, v.y, v.z)
            const along = vel.dot(dir)
            if (along < speed) p.rock.body.setLinvel(vel.addScaledVector(dir, speed - along), true)
            return true
          })
        } else {
          // バケットを閉じたら流し出しをやめる（すぐにすくえるように）
          pouring.current = []
        }

        // --- 車体の上に乗ってしまった岩は、外へ滑り落とす ---
        for (const rock of rockRegistry.rocks) {
          if (rock.state !== 'free' || !onExcavatorBody(rock) || nearBucket(rock)) continue
          const p = rock.body.translation()
          const v = rock.body.linvel()
          let ox = p.x - excavatorSensors.x
          let oz = p.z - excavatorSensors.z
          const len = Math.hypot(ox, oz) || 1
          ox /= len
          oz /= len
          if (v.x * ox + v.z * oz < SLIDE_OFF_SPEED) {
            rock.body.setLinvel({ x: ox * SLIDE_OFF_SPEED, y: Math.max(v.y, 0.5), z: oz * SLIDE_OFF_SPEED }, true)
          }
        }

        // --- すくう動きの間は、口の前の石をバケットの中へ引き寄せる（吸い込むほどではなく、コロコロ入っていく） ---
        // 石を置いた直後などバケットを近づけているだけのときは引き寄せない（置いた石が戻ってこないように）
        if (!spilling && excavatorSensors.scooping && up > CAN_GRAB_ABOVE - 0.15 && held.current.length < slots().length) {
          const scale = bucketScale.x
          cupWorld.copy(CUP_CENTER).applyMatrix4(b.matrixWorld)
          const now = clock.elapsedTime
          for (const rock of rockRegistry.rocks) {
            if ((rock.state !== 'free' && rock.state !== 'truck') || now < rock.grabCooldownUntil) continue
            if (rock.state === 'truck') continue // 荷台の石は引き寄せない（積んだ石が勝手に出ないように）
            const p = rock.body.translation()
            local.set(p.x, p.y, p.z).applyMatrix4(inv)
            // 口の前（背中側・横すぎ・遠すぎは対象外）
            if (Math.abs(local.x) > BUCKET_WIDTH / 2 + 0.6) continue
            if (local.y > 0.45 || local.z < -0.3 || local.z > 1.9) continue
            if (local.distanceTo(CUP_CENTER) > PULL_RANGE) continue
            if (insideBucket(rock)) continue
            pullDir.set(cupWorld.x - p.x, cupWorld.y - p.y, cupWorld.z - p.z)
            const dist = pullDir.length()
            if (dist < 1e-3) continue
            pullDir.divideScalar(dist)
            const speed = PULL_SPEED * scale
            const v = rock.body.linvel()
            // いまの速さから、少しずつバケットの方へ向ける
            rock.body.setLinvel(
              {
                x: v.x + (pullDir.x * speed - v.x) * 0.3,
                y: Math.max(v.y, pullDir.y * speed * 0.6 + 0.4),
                z: v.z + (pullDir.z * speed - v.z) * 0.3,
              },
              true,
            )
          }
        }

        // --- すくう ---
        const capacity = slots().length
        if (!spilling && up > CAN_GRAB_ABOVE && held.current.length < capacity) {
          const now = clock.elapsedTime
          for (const rock of rockRegistry.rocks) {
            // 地面の岩に加え、ダンプの荷台の岩もすくえる（多く積みすぎたときに減らせるように）
            if ((rock.state !== 'free' && rock.state !== 'truck') || now < rock.grabCooldownUntil) continue
            // 岩が側板から少しはみ出していても、すくえたことにする（子ども向けに甘め）
            if (!insideBucket(rock)) continue
            grab(rock, local)
            if (held.current.length >= capacity) break
          }
        }

        // --- 持っている岩をバケットに追従させる ---
        for (const h of held.current) {
          h.age += dt
          const k = smoothstep(Math.min(1, h.age / SETTLE_TIME))
          const slot = slots()[h.slot] ?? slots()[0]
          slotVec.set(slot[0], slot[1], slot[2])
          world.lerpVectors(h.from, slotVec, k).applyMatrix4(b.matrixWorld)
          if (dt > 0) h.velocity.subVectors(world, h.prevWorld).divideScalar(dt)
          h.prevWorld.copy(world)
          h.rock.body.setNextKinematicTranslation(world)
          h.rock.body.setNextKinematicRotation(q.copy(bucketQuat).multiply(h.localQuat))
          // すくった瞬間に「ぽよん」と少し膨らむ
          const pop = h.age < 0.3 ? Math.sin((Math.PI * h.age) / 0.3) * 0.25 : 0
          h.rock.mesh.scale.setScalar(1 + pop)
        }

        excavatorSensors.bucketOpenUp = up
        excavatorSensors.heldCount = held.current.length
        excavatorSensors.freeSlots = capacity - held.current.length
      },
    }

    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [bucket, listeners, rapier, clock])
}
