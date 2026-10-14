import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { ConvexHullCollider, CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import type { RigListener } from '../shared/rig'
import type { ExcavatorRigRefs } from './useExcavatorController'
import { BUCKET_PROFILE, BUCKET_TIP, BUCKET_WIDTH, type YZ } from './bucketShape'
import { EXCAVATOR } from './excavatorConfig'
import type { ExcavatorTool } from '../../stores/gameStore'

/** 側面図の 2 点を結ぶ角材の当たり判定（Beam の当たり判定版） */
function BeamCollider({
  from,
  to,
  halfWidth,
  halfHeight,
  s = 1,
}: {
  from: YZ
  to: YZ
  halfWidth: number
  halfHeight: number
  /** 全体の倍率（大きくなったバケット用） */
  s?: number
}) {
  const dy = to[0] - from[0]
  const dz = to[1] - from[1]
  return (
    <CuboidCollider
      args={[halfWidth * s, halfHeight * s, (Math.hypot(dy, dz) / 2) * s]}
      position={[0, ((from[0] + to[0]) / 2) * s, ((from[1] + to[1]) / 2) * s]}
      rotation={[-Math.atan2(dy, dz), 0, 0]}
      friction={0.8}
    />
  )
}

const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const scl = new THREE.Vector3()

function sync(body: RapierRigidBody | null, obj: THREE.Object3D | null) {
  if (!body || !obj) return
  obj.matrixWorld.decompose(pos, quat, scl)
  body.setNextKinematicTranslation(pos)
  body.setNextKinematicRotation(quat)
}

const { boomLength, armLength } = EXCAVATOR.geometry

/** バケットの側板（外形に少し厚みを持たせた凸形） */
const sidePlate = (x: number, s: number) =>
  new Float32Array(BUCKET_PROFILE.flatMap(([y, z]) => [(x - 0.025) * s, y * s, z * s, (x + 0.025) * s, y * s, z * s]))

/**
 * ショベルカーの当たり判定。見た目の関節に毎フレーム追従する kinematic ボディ。
 * 岩を押しのけたり、バケットで岩をすくったりできるようにする。
 * 車体の関節階層の外（シーン直下）に置き、ワールド座標で動かす。
 */
export function ExcavatorColliders({
  rig,
  listeners,
  bucketScale,
  tool,
  machineScale: m,
}: {
  rig: ExcavatorRigRefs
  listeners: RefObject<RigListener[]>
  /** レベルで大きくなったバケットの倍率（当たり判定もその大きさにする） */
  bucketScale: number
  /** アタッチメント（ブレーカーなら細長い、グラップルなら本体だけの当たり判定。スケルトンバケットはバケットと同じ形） */
  tool: ExcavatorTool
  /** ショベル全体の大きさ（Lv5 から 1.3）。本体・ブーム・アームの当たり判定にかける */
  machineScale: number
}) {
  /** [x, y, z] に倍率をかける */
  const ms = (v: readonly [number, number, number]) => [v[0] * m, v[1] * m, v[2] * m] as [number, number, number]
  const crawler = useRef<RapierRigidBody>(null)
  const upper = useRef<RapierRigidBody>(null)
  const boom = useRef<RapierRigidBody>(null)
  const arm = useRef<RapierRigidBody>(null)
  const bucket = useRef<RapierRigidBody>(null)

  useEffect(() => {
    const listener: RigListener = {
      update() {
        sync(crawler.current, rig.root.current)
        sync(upper.current, rig.upper.current)
        sync(boom.current, rig.boom.current)
        sync(arm.current, rig.arm.current)
        sync(bucket.current, rig.bucket.current)
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [rig, listeners])

  return (
    <>
      <RigidBody key={`crawler-${m}`} ref={crawler} type="kinematicPosition" colliders={false}>
        {/* 履帯の見た目（直線 3.1m ＋ 前後の丸み）に合わせた長さ。長すぎると前進したとき届いていない石まで押してしまう */}
        <CuboidCollider args={ms([1.35, 0.42, 1.95])} position={ms([0, 0.42, 0])} />
      </RigidBody>

      <RigidBody key={`upper-${m}`} ref={upper} type="kinematicPosition" colliders={false}>
        <CuboidCollider args={ms([1.25, 0.55, 1.35])} position={ms([0, 0.6, -0.9])} />
        <CuboidCollider args={ms([0.5, 0.85, 0.7])} position={ms([0.7, 1.1, 0.35])} />
        <CuboidCollider args={ms([0.5, 0.4, 0.7])} position={ms([-0.72, 0.6, 0.55])} />
      </RigidBody>

      <RigidBody key={`boom-${m}`} ref={boom} type="kinematicPosition" colliders={false}>
        <BeamCollider from={[0, 0]} to={[0.75, 2.0]} halfWidth={0.24} halfHeight={0.28} s={m} />
        <BeamCollider from={[0.75, 2.0]} to={[0, boomLength]} halfWidth={0.22} halfHeight={0.25} s={m} />
      </RigidBody>

      <RigidBody key={`arm-${m}`} ref={arm} type="kinematicPosition" colliders={false}>
        <BeamCollider from={[0.3, -0.75]} to={[0, armLength]} halfWidth={0.18} halfHeight={0.22} s={m} />
      </RigidBody>

      {/* key で倍率・アタッチメントが変わったら作り直す */}
      {tool === 'grapple' ? (
        <RigidBody key="grapple" ref={bucket} type="kinematicPosition" colliders={false}>
          <CuboidCollider args={[0.48, 0.26, 0.35]} position={[0, 0, 0.6]} friction={0.8} />
        </RigidBody>
      ) : tool === 'breaker' ? (
        <RigidBody key="breaker" ref={bucket} type="kinematicPosition" colliders={false}>
          <CuboidCollider args={[0.26, 0.26, 0.62]} position={[0, 0, 0.7]} friction={0.8} />
          <CuboidCollider args={[0.1, 0.1, 0.4]} position={[0, 0, 1.7]} friction={0.8} />
        </RigidBody>
      ) : (
        <RigidBody key={`${tool}-${bucketScale}`} ref={bucket} type="kinematicPosition" colliders={false}>
          {BUCKET_PROFILE.slice(1).map((p, i) => (
            <BeamCollider key={i} from={BUCKET_PROFILE[i]} to={p} halfWidth={BUCKET_WIDTH / 2 + 0.025} halfHeight={0.035} s={bucketScale} />
          ))}
          {/* 爪（見た目の爪と同じ所。爪の先でも石を押せるように） */}
          <BeamCollider from={[-0.1, 1.18]} to={[BUCKET_TIP[1], BUCKET_TIP[2]]} halfWidth={BUCKET_WIDTH / 2 - 0.05} halfHeight={0.04} s={bucketScale} />
          <ConvexHullCollider args={[sidePlate(BUCKET_WIDTH / 2, bucketScale)]} friction={0.8} />
          <ConvexHullCollider args={[sidePlate(-BUCKET_WIDTH / 2, bucketScale)]} friction={0.8} />
        </RigidBody>
      )}
    </>
  )
}
