import { useEffect, useRef, type RefObject } from 'react'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { scrapRegistry, setScrapKind, type ScrapEntry } from '../../cargo/scrap/scrapRegistry'
import { audio } from '../../audio/AudioManager'
import { digEffects } from '../../effects/DigEffects'
import { BUCKET_CAPTURE_POLYGON, BUCKET_WIDTH, pointInPolygon } from './bucketShape'
import { excavatorSensors } from './excavatorSensors'
import { landingTargetNear } from '../shared/digFloors'
import type { RigListener } from '../shared/rig'

/** 口がこれより上を向いていれば、がれきをすくえる（useBucketGrab と同じ） */
const CAN_GRAB_ABOVE = -0.35
/**
 * こぼす条件：口が下を向いた、または開くレバーを入れていて大きく開いている。
 * ふつうのバケットの「開く操作中に 30% 超」は使わない（ふるうときにレバーを行ったり来たりしても、こぼれないように）。
 * 「開いているだけ」でもこぼさない（大きく開いたところから巻き込んですくうときに、すくえるように）
 */
const SPILL_BELOW = -0.6
const SPILL_OPEN_RATIO = 0.6
/** 一度に入るがれきの数と、並べる位置（バケットのローカル。がれきの長い向きはバケットの幅の向き） */
const SLOTS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0.2, 0.45],
  [0, 0.12, 0.8],
  [0, 0.4, 0.64],
]
/** ふるい終わるまでの、バケットを行ったり来たりさせる回数（向きが変わった回数。3 往復くらい） */
const SHAKES_TO_SIFT = 6
/** 1 回の「ゆらし」と数える、バケットの開き具合の動き（0〜1 のうち） */
const SHAKE_MIN_TRAVEL = 0.012
const SETTLE_TIME = 0.3
const COOLDOWN = 1.0
const SPILL_INTERVAL = 0.12
const SPILL_INHERIT = 0.25
const POUR_SPEED = 1.5
const PULL_SPEED = 1.3
const PULL_RANGE = 1.6
const CUP_CENTER = new THREE.Vector3(0, 0.15, 0.6)
/** バケットのローカルで、がれきが口から出ていく向き */
const POUR_LOCAL = new THREE.Vector3(0, -0.4, 1).normalize()

interface Held {
  piece: ScrapEntry
  slot: number
  from: THREE.Vector3
  fromQuat: THREE.Quaternion
  /** 収まる向き（長い向きをバケットの幅にそろえる。近い方の向き） */
  toQuat: THREE.Quaternion
  age: number
  /** ゆらしたときに、ぴょんとはねる（1 → 0） */
  bump: number
  prevWorld: THREE.Vector3
  velocity: THREE.Vector3
}

const bucketPos = new THREE.Vector3()
const bucketQuat = new THREE.Quaternion()
const bucketScale = new THREE.Vector3()
const inv = new THREE.Matrix4()
const local = new THREE.Vector3()
const world = new THREE.Vector3()
const slotVec = new THREE.Vector3()
const pourDir = new THREE.Vector3()
const cupWorld = new THREE.Vector3()
const pullDir = new THREE.Vector3()
const q = new THREE.Quaternion()
const settleQuat = new THREE.Quaternion()
const mouthDir = new THREE.Vector3()
const vel = new THREE.Vector3()
const IDENTITY = new THREE.Quaternion()
const TURNED = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * スケルトンバケット（Lv7）：がれきをすくい、バケットのレバーを行ったり来たりさせて「ふるう」と、
 * すき間から小石がこぼれて、コンクリートつきのがれきが鉄骨だけになる（ユーザー判断：レバーでゆらす）。
 * すくう・こぼすは useBucketGrab と同じ考え方（バケットの中に入ったら kinematic で追従、大きく開くか口が下を向いたら落とす）。
 * 石（rockRegistry）はすくわない。
 */
export function useSkeletonBucket(bucket: RefObject<THREE.Group | null>, listeners: RefObject<RigListener[]>) {
  const { rapier } = useRapier()
  const held = useRef<Held[]>([])

  useEffect(() => {
    let spillTimer = 0
    let lastRatio = excavatorSensors.bucketOpenRatio
    /** バケットの開き具合が動いている向き（+1 開く / -1 閉じる / 0 まだ） */
    let dir = 0
    /** いまの向きに動いた量 */
    let travel = 0
    /** 落としたあと、バケットから出るまで押し出すがれき */
    let pouring: ScrapEntry[] = []

    const toBucketLocal = (piece: ScrapEntry) => {
      const p = piece.body.translation()
      return local.set(p.x, p.y, p.z).applyMatrix4(inv)
    }
    const insideBucket = (piece: ScrapEntry) => {
      toBucketLocal(piece)
      return Math.abs(local.x) <= BUCKET_WIDTH / 2 + 0.3 && pointInPolygon(local.y, local.z, BUCKET_CAPTURE_POLYGON)
    }
    const nearBucket = (piece: ScrapEntry) => {
      toBucketLocal(piece)
      return Math.abs(local.x) <= BUCKET_WIDTH / 2 + 0.4 && local.z > -0.5 && local.z < 1.6 && local.y > -0.8 && local.y < 0.95
    }

    const grab = (piece: ScrapEntry) => {
      const used = new Set(held.current.map((h) => h.slot))
      const slot = SLOTS.findIndex((_, i) => !used.has(i))
      if (slot < 0) return
      const r = piece.body.rotation()
      const t = piece.body.translation()
      const fromQuat = bucketQuat.clone().invert().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w))
      piece.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
      piece.state = 'held'
      held.current.push({
        piece,
        slot,
        from: local.clone(),
        fromQuat,
        toQuat: Math.abs(fromQuat.dot(IDENTITY)) >= Math.abs(fromQuat.dot(TURNED)) ? IDENTITY : TURNED,
        age: 0,
        bump: 0,
        prevWorld: new THREE.Vector3(t.x, t.y, t.z),
        velocity: new THREE.Vector3(),
      })
      audio.play('rockHit')
    }

    const spill = (h: Held) => {
      const { piece } = h
      piece.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
      piece.body.setLinvel(h.velocity.multiplyScalar(SPILL_INHERIT).clampLength(0, 2).addScaledVector(pourDir, POUR_SPEED), true)
      piece.state = 'free'
      piece.grabCooldownUntil = scrapRegistry.now + COOLDOWN
      pouring.push(piece)
      audio.play('rockDrop')
    }

    /** ダンプの荷台の近くなら、落ちる先を荷台の中へ寄せる（バケットのときと同じ手助け） */
    const aimAtTruckBed = (piece: ScrapEntry) => {
      const p = piece.body.translation()
      const target = landingTargetNear(p.x, p.z, 1.2, 0.6)
      if (!target || p.y <= target.top) return
      const fallTime = Math.sqrt((2 * (p.y - target.top)) / 9.81)
      piece.body.setLinvel({ x: (target.x - p.x) / fallTime, y: 0, z: (target.z - p.z) / fallTime }, true)
    }

    /** バケットを 1 回ゆらした（開き具合の動きの向きが変わった）：中のがれきを少しふるう */
    const shake = () => {
      const mixed = held.current.filter((h) => h.piece.kind === 'mixed')
      if (mixed.length === 0) return
      audio.play('sift')
      digEffects.pebbles(cupWorld.x, cupWorld.y - 0.2, cupWorld.z, 2 + mixed.length * 2)
      for (const h of mixed) {
        h.bump = 1
        h.piece.sift += 1 / SHAKES_TO_SIFT
        if (h.piece.sift >= 1 - 1e-6) {
          // ふるい終わった：コンクリートが全部落ちて、鉄骨だけになる
          setScrapKind(h.piece, 'steel')
          digEffects.pebbles(cupWorld.x, cupWorld.y - 0.2, cupWorld.z, 10)
          setTimeout(() => audio.play('find'), 120)
        }
      }
    }

    const listener: RigListener = {
      update(dt) {
        const b = bucket.current
        if (!b) return
        // ほかのアタッチメントに付けかえたら、持っていたがれきはその場に落とす
        if (excavatorSensors.tool !== 'skeleton') {
          while (held.current.length > 0) spill(held.current.pop()!)
          pouring = []
          dir = 0
          return
        }
        b.matrixWorld.decompose(bucketPos, bucketQuat, bucketScale)
        inv.copy(b.matrixWorld).invert()
        const up = mouthDir.set(0, -1, 0).applyQuaternion(bucketQuat).y // 口の外向き（ローカル -Y）の上向き度合い
        pourDir.copy(POUR_LOCAL).applyQuaternion(bucketQuat)
        cupWorld.copy(CUP_CENTER).applyMatrix4(b.matrixWorld)
        const openRatio = excavatorSensors.bucketOpenRatio
        const now = scrapRegistry.now

        // --- ふるう：バケットの開き具合が「開く ⇄ 閉じる」と向きを変えるたびに 1 回 ---
        const delta = openRatio - lastRatio
        lastRatio = openRatio
        if (Math.abs(delta) > 1e-5) {
          const d = Math.sign(delta)
          if (d === dir) travel += Math.abs(delta)
          else {
            if (dir !== 0 && travel >= SHAKE_MIN_TRAVEL) shake()
            dir = d
            travel = Math.abs(delta)
          }
        }

        // --- こぼす ---
        const spilling = up < SPILL_BELOW || (excavatorSensors.bucketLever > 0.1 && openRatio > SPILL_OPEN_RATIO)
        if (spilling && held.current.length > 0) {
          spillTimer -= dt
          if (spillTimer <= 0) {
            spill(held.current.pop()!)
            spillTimer = SPILL_INTERVAL
          }
        } else {
          spillTimer = 0
        }
        // 落としたがれきは、バケットから出るまで押し出し、出たら荷台の方へ寄せる
        pouring = pouring.filter((piece) => {
          if (piece.state !== 'free') return false
          if (!nearBucket(piece)) {
            aimAtTruckBed(piece)
            return false
          }
          if (!spilling) return false
          piece.grabCooldownUntil = Math.max(piece.grabCooldownUntil, now + 0.5)
          const v = piece.body.linvel()
          vel.set(v.x, v.y, v.z)
          const along = vel.dot(pourDir)
          if (along < POUR_SPEED) piece.body.setLinvel(vel.addScaledVector(pourDir, POUR_SPEED - along), true)
          return true
        })

        // --- すくう動きの間は、口の前のがれきを中へ引き寄せる ---
        if (!spilling && excavatorSensors.scooping && up > CAN_GRAB_ABOVE - 0.15 && held.current.length < SLOTS.length) {
          const speed = PULL_SPEED * bucketScale.x
          for (const piece of scrapRegistry.pieces) {
            if (piece.state !== 'free' || now < piece.grabCooldownUntil) continue
            toBucketLocal(piece)
            if (Math.abs(local.x) > BUCKET_WIDTH / 2 + 0.6 || local.y > 0.45 || local.z < -0.3 || local.z > 1.9) continue
            if (local.distanceTo(CUP_CENTER) > PULL_RANGE || insideBucket(piece)) continue
            const p = piece.body.translation()
            pullDir.set(cupWorld.x - p.x, cupWorld.y - p.y, cupWorld.z - p.z)
            const dist = pullDir.length()
            if (dist < 1e-3) continue
            pullDir.divideScalar(dist)
            const v = piece.body.linvel()
            piece.body.setLinvel(
              { x: v.x + (pullDir.x * speed - v.x) * 0.3, y: Math.max(v.y, pullDir.y * speed * 0.6 + 0.4), z: v.z + (pullDir.z * speed - v.z) * 0.3 },
              true,
            )
          }
        }

        // --- すくう（地面のがれきと、ダンプの荷台のがれき） ---
        if (!spilling && up > CAN_GRAB_ABOVE && held.current.length < SLOTS.length) {
          for (const piece of scrapRegistry.pieces) {
            if ((piece.state !== 'free' && piece.state !== 'truck') || now < piece.grabCooldownUntil) continue
            if (!insideBucket(piece)) continue
            grab(piece)
            if (held.current.length >= SLOTS.length) break
          }
        }

        // --- 持っているがれきをバケットに追従させる ---
        for (const h of held.current) {
          if (h.piece.state !== 'held') continue
          h.age += dt
          h.bump = Math.max(0, h.bump - dt * 7)
          const k = smoothstep(Math.min(1, h.age / SETTLE_TIME))
          const s = SLOTS[h.slot]
          slotVec.set(s[0], s[1] + Math.sin(h.bump * Math.PI) * 0.08, s[2])
          world.lerpVectors(h.from, slotVec, k).applyMatrix4(b.matrixWorld)
          if (dt > 0) h.velocity.subVectors(world, h.prevWorld).divideScalar(dt)
          h.prevWorld.copy(world)
          h.piece.body.setNextKinematicTranslation(world)
          h.piece.body.setNextKinematicRotation(q.copy(bucketQuat).multiply(settleQuat.slerpQuaternions(h.fromQuat, h.toQuat, k)))
        }
        // ほかの所（荷台・控えへ戻す）で状態が変わったものは、持っていない
        held.current = held.current.filter((h) => h.piece.state === 'held')
        excavatorSensors.bucketOpenUp = up
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [bucket, listeners, rapier])
}
