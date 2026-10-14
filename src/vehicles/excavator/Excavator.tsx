import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { EXCAVATOR } from './excavatorConfig'
import { useExcavatorController } from './useExcavatorController'
import { Crawler, type TrackTravel } from './parts/Crawler'
import { UpperStructure } from './parts/UpperStructure'
import { BoomModel } from './parts/BoomModel'
import { ArmModel } from './parts/ArmModel'
import { BucketModel } from './parts/BucketModel'
import { BUCKET_TIP } from './bucketShape'
import { HydraulicCylinder } from '../shared/HydraulicCylinder'
import { ExcavatorColliders } from './ExcavatorColliders'
import { useBucketGrab } from './useBucketGrab'
import { useBucketDig } from './useBucketDig'
import { useLevel } from '../../stores/progressStore'
import { availableTools, useGameStore } from '../../stores/gameStore'
import { GrappleModel, GRAPPLE_TIP } from './parts/GrappleModel'
import { useGrapple } from './useGrapple'
import { BreakerModel, BREAKER_TIP } from './parts/BreakerModel'
import { useBreaker } from './useBreaker'
import { SkeletonBucketModel } from './parts/SkeletonBucketModel'
import { useSkeletonBucket } from './useSkeletonBucket'
import { excavatorSensors } from './excavatorSensors'
import { useFrame } from '@react-three/fiber'
import type { RigListener } from '../shared/rig'
import { createPartPaint, PART_COLORS } from '../shared/materials'
import { useVehiclePaint } from '../shared/useVehiclePaint'

const { upperBodyHeight, boomPivot, boomLength, armLength } = EXCAVATOR.geometry

/**
 * ショベルカー。
 *
 * Excavator (root: 位置・向き)
 * ├─ Crawler
 * └─ UpperBody (rotation.y = 上部旋回)
 *    └─ Boom (rotation.x)
 *       └─ Arm (rotation.x)
 *          └─ Bucket (rotation.x)
 *             └─ BucketTip（先端。地面判定・将来の岩すくい判定に使う）
 *
 * 見た目は *Model コンポーネントに分離してあり、GLB に差し替えるときは
 * 関節 Group の中身だけを入れ替えればよい。
 */
export function Excavator({ rootRef }: { rootRef: RefObject<THREE.Group | null> }) {
  const upper = useRef<THREE.Group>(null)
  const boom = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const bucket = useRef<THREE.Group>(null)
  const bucketTip = useRef<THREE.Object3D>(null)

  const travel = useRef<TrackTravel>({ left: 0, right: 0 })
  /** 関節更新の直後に呼ぶ処理（シリンダー・当たり判定・すくい判定） */
  const listeners = useRef<RigListener[]>([])

  // 油圧シリンダーの取付点
  const boomCylBaseL = useRef<THREE.Object3D>(null)
  const boomCylBaseR = useRef<THREE.Object3D>(null)
  const boomCylTopL = useRef<THREE.Object3D>(null)
  const boomCylTopR = useRef<THREE.Object3D>(null)
  const armCylBase = useRef<THREE.Object3D>(null)
  const armCylEnd = useRef<THREE.Object3D>(null)
  const bucketCylBase = useRef<THREE.Object3D>(null)
  const bucketCylEnd = useRef<THREE.Object3D>(null)

  const paints = useMemo(
    () => ({
      boom: createPartPaint(PART_COLORS.boom),
      arm: createPartPaint(PART_COLORS.arm),
      bucket: createPartPaint(PART_COLORS.bucket),
    }),
    [],
  )
  useEffect(() => () => Object.values(paints).forEach((m) => m.dispose()), [paints])

  // レベルが上がるとバケットが大きくなり、爪の色が変わる
  const level = useLevel()
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color: level.bucketAccent, roughness: 0.5, metalness: 0.5 }), [level])
  useEffect(() => () => accent.dispose(), [accent])

  // アタッチメント（Lv4 から油圧ブレーカー）。レベルが足りないときはバケットのまま
  const chosenTool = useGameStore((s) => s.excavatorTool)
  const tool = availableTools(level.level).includes(chosenTool) ? chosenTool : 'bucket'
  useEffect(() => {
    excavatorSensors.tool = tool
  }, [tool])
  // ショベル全体の大きさ（Lv5 から 1.3 倍）。先のアタッチメントは、全体の倍率で割って元の大きさのままにする
  const S = level.excavatorScale
  excavatorSensors.scale = S
  const attachmentScale = (tool === 'bucket' || tool === 'skeleton' ? level.bucketScale : 1) / S
  const chisel = useRef<THREE.Group>(null)
  const jawA = useRef<THREE.Group>(null)
  const jawB = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // 叩いている間、のみを前後に振動させる
    if (chisel.current) chisel.current.position.z = excavatorSensors.hammering ? Math.sin(clock.elapsedTime * 90) * 0.06 : 0
    // グラップルのつめ（開き具合）
    const open = 0.05 + excavatorSensors.grappleOpen * 0.75
    if (jawA.current) jawA.current.rotation.x = -open
    if (jawB.current) jawB.current.rotation.x = open
  })

  // 車庫で選んだ色（アタッチメント・大きさが変わって部品が作り直されたら塗り直す）
  useVehiclePaint('excavator', rootRef, [paints.boom, paints.arm, paints.bucket], [tool, S])

  const rig = useMemo(() => ({ root: rootRef, upper, boom, arm, bucket, bucketTip }), [rootRef])
  useExcavatorController(rig, travel, listeners, paints)
  useBucketGrab(bucket, listeners)
  useBucketDig(listeners)
  useBreaker(listeners)
  useGrapple(bucket, listeners)
  useSkeletonBucket(bucket, listeners)

  // 影は車両だけが落とす（地面は受けるだけ）
  useEffect(() => {
    rootRef.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }, [rootRef])

  return (
    <>
      <ExcavatorColliders rig={rig} listeners={listeners} bucketScale={level.bucketScale} tool={tool} machineScale={S} />
      <group ref={rootRef} scale={S}>
        <Crawler travel={travel} />

        <group ref={upper} position-y={upperBodyHeight}>
          <UpperStructure />
          <object3D ref={boomCylBaseL} position={[boomPivot[0] + 0.3, 0.25, 1.55]} />
          <object3D ref={boomCylBaseR} position={[boomPivot[0] - 0.3, 0.25, 1.55]} />
          <HydraulicCylinder start={boomCylBaseL} end={boomCylTopL} barrelLength={1.05} registry={listeners} />
          <HydraulicCylinder start={boomCylBaseR} end={boomCylTopR} barrelLength={1.05} registry={listeners} />

          <group ref={boom} position={boomPivot}>
            <BoomModel paint={paints.boom} />
            <object3D ref={boomCylTopL} position={[0.3, 0.1, 1.9]} />
            <object3D ref={boomCylTopR} position={[-0.3, 0.1, 1.9]} />
            <object3D ref={armCylBase} position={[0, 1.05, 1.8]} />
            <HydraulicCylinder start={armCylBase} end={armCylEnd} barrelLength={1.6} radius={0.1} registry={listeners} />

            <group ref={arm} position-z={boomLength}>
              <ArmModel paint={paints.arm} />
              <object3D ref={armCylEnd} position={[0, 0.5, -0.7]} />
              <object3D ref={bucketCylBase} position={[0, 0.45, 0.1]} />
              <HydraulicCylinder start={bucketCylBase} end={bucketCylEnd} barrelLength={1.2} radius={0.08} registry={listeners} />

              <group ref={bucket} position-z={armLength} scale={attachmentScale}>
                {tool === 'breaker' ? (
                  <BreakerModel ref={chisel} paint={paints.bucket} />
                ) : tool === 'grapple' ? (
                  <GrappleModel paint={paints.bucket} jawA={jawA} jawB={jawB} />
                ) : tool === 'skeleton' ? (
                  <SkeletonBucketModel paint={paints.bucket} accent={accent} />
                ) : (
                  <BucketModel paint={paints.bucket} accent={accent} />
                )}
                <object3D ref={bucketCylEnd} position={[0, 0.4, 0]} />
                <object3D ref={bucketTip} position={tool === 'breaker' ? BREAKER_TIP : tool === 'grapple' ? GRAPPLE_TIP : BUCKET_TIP} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </>
  )
}
