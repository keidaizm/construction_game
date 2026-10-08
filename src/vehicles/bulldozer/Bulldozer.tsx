import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type * as THREE from 'three'
import { BULLDOZER } from './bulldozerConfig'
import { useBulldozerController } from './useBulldozerController'
import { BulldozerColliders } from './BulldozerColliders'
import { useBladePush } from './useBladePush'
import { BulldozerBody } from './parts/BulldozerBody'
import { BladeModel } from './parts/BladeModel'
import { TrackPair, type TrackTravel } from '../shared/Tracks'
import { HydraulicCylinder } from '../shared/HydraulicCylinder'
import type { RigListener } from '../shared/rig'
import { createPartPaint, darkSteel, PART_COLORS } from '../shared/materials'
import { useVehiclePaint } from '../shared/useVehiclePaint'

const G = BULLDOZER.geometry

/**
 * ブルドーザー。
 *
 * Bulldozer (root: 位置・向き)
 * ├─ 履帯 ×2・車体
 * └─ Arm（根元で rotation.x。排土板を上げ下げする）
 *    └─ Blade（腕の先。腕と逆に回して、いつも立った向きに保つ）
 */
export function Bulldozer({ rootRef }: { rootRef: RefObject<THREE.Group | null> }) {
  const arm = useRef<THREE.Group>(null)
  const blade = useRef<THREE.Group>(null)
  const travel = useRef<TrackTravel>({ left: 0, right: 0 })
  const listeners = useRef<RigListener[]>([])
  // 排土板を持ち上げる油圧シリンダーの取付点
  const cylBaseL = useRef<THREE.Object3D>(null)
  const cylBaseR = useRef<THREE.Object3D>(null)
  const cylEndL = useRef<THREE.Object3D>(null)
  const cylEndR = useRef<THREE.Object3D>(null)

  const bladePaint = useMemo(() => createPartPaint(PART_COLORS.blade), [])
  useEffect(() => () => bladePaint.dispose(), [bladePaint])
  // 車庫で選んだ色
  useVehiclePaint('bulldozer', rootRef, [bladePaint], [])

  const rig = useMemo(() => ({ root: rootRef, arm, blade }), [rootRef])
  useBulldozerController(rig, travel, listeners, bladePaint)
  useBladePush(blade, listeners)

  useEffect(() => {
    rootRef.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }, [rootRef])

  return (
    <>
      <BulldozerColliders rig={rig} listeners={listeners} />
      <group ref={rootRef}>
        <TrackPair travel={travel} size={BULLDOZER.tracks} />
        <BulldozerBody />
        <object3D ref={cylBaseL} position={[0.9, 1.35, 0.9]} />
        <object3D ref={cylBaseR} position={[-0.9, 1.35, 0.9]} />
        <HydraulicCylinder start={cylBaseL} end={cylEndL} barrelLength={0.8} radius={0.08} registry={listeners} />
        <HydraulicCylinder start={cylBaseR} end={cylEndR} barrelLength={0.8} radius={0.08} registry={listeners} />

        <group ref={arm} position={G.armPivot}>
          {/* 履帯の外側を通る左右の腕 */}
          {[G.armX, -G.armX].map((x) => (
            <mesh key={x} position={[x, 0, G.armLength / 2]} material={darkSteel}>
              <boxGeometry args={[0.16, 0.24, G.armLength]} />
            </mesh>
          ))}
          <group ref={blade} position={[0, G.bladeClearance - G.armPivot[1], G.armLength]}>
            <BladeModel paint={bladePaint} />
            <object3D ref={cylEndL} position={[0.9, 0.8, -0.1]} />
            <object3D ref={cylEndR} position={[-0.9, 0.8, -0.1]} />
          </group>
        </group>
      </group>
    </>
  )
}
