import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type * as THREE from 'three'
import { createPartPaint, PART_COLORS } from '../shared/materials'
import { useVehiclePaint } from '../shared/useVehiclePaint'
import { HydraulicCylinder } from '../shared/HydraulicCylinder'
import type { RigListener } from '../shared/rig'
import { TRUCK_SIZES, truckShape } from './dumpTruckConfig'
import { useDumpTruckController } from './useDumpTruckController'
import { useBedCargo } from './useBedCargo'
import { DumpTruckColliders } from './DumpTruckColliders'
import { TruckBody } from './parts/TruckBody'
import { BedModel } from './parts/BedModel'
import { BigBedModel } from './parts/BigBedModel'
import { BigTruckBody } from './parts/BigTruckBody'
import { Wheel } from './parts/Wheel'
import { useLevel } from '../../stores/progressStore'
import { BIG_TRUCK_LEVEL } from '../../missions/levels'
import { paintYellow } from '../shared/materials'

/**
 * ダンプカー。
 *
 * Lv5 からは大きな重ダンプ（BigTruckBody・BigBedModel、大きなタイヤ）になる。寸法は TRUCK_SIZES。
 *
 * DumpTruck (root: 位置・向き)
 * ├─ TruckBody（フレーム・キャブ）／BigTruckBody
 * ├─ 前輪 ×2（向きが変わる）／後輪（ダブルタイヤ。ふつうは 2 軸、重ダンプは 1 軸）
 * └─ Bed（後端のヒンジで rotation.x）
 *    └─ Tailgate（上端でぶら下がる）
 */
export function DumpTruck({ rootRef }: { rootRef: RefObject<THREE.Group | null> }) {
  const bed = useRef<THREE.Group>(null)
  const tailgate = useRef<THREE.Group>(null)
  const listeners = useRef<RigListener[]>([])
  const steerL = useRef<THREE.Group>(null)
  const steerR = useRef<THREE.Group>(null)
  const spins = [
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
    useRef<THREE.Group>(null),
  ]
  // ホイストシリンダー（荷台を持ち上げる油圧）の取付点
  const hoistBase = useRef<THREE.Object3D>(null)
  const hoistEnd = useRef<THREE.Object3D>(null)

  // レベルでダンプの大きさが変わる（コントローラ・荷台の処理は truckShape を毎フレーム読む）
  const level = useLevel()
  const G = TRUCK_SIZES[level.level >= BIG_TRUCK_LEVEL ? 'big' : 'standard']
  truckShape.current = G
  const R = G.wheelRadius
  const big = G.kind === 'big'

  const bedPaint = useMemo(() => createPartPaint(PART_COLORS.bed), [])
  useEffect(() => () => bedPaint.dispose(), [bedPaint])
  // 車庫で選んだ色（ふつう／重ダンプが入れかわったら塗り直す）
  useVehiclePaint('dumpTruck', rootRef, [bedPaint], [G.kind])

  const rig = useMemo(
    () => ({ root: rootRef, bed, tailgate, steer: [steerL, steerR], spin: spins }),
    // spins・steer は中身が毎回同じ ref なので、最初の配列を使い続けてよい
    [rootRef],
  )
  useDumpTruckController(rig, listeners, bedPaint)
  useBedCargo(bed, listeners)

  useEffect(() => {
    rootRef.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }, [rootRef, G])

  return (
    <>
      <DumpTruckColliders root={rootRef} bed={bed} tailgate={tailgate} listeners={listeners} geometry={G} />
      <group ref={rootRef}>
        {big ? <BigTruckBody /> : <TruckBody />}

        {/* 前輪（向きが変わる） */}
        <group ref={steerL} position={[G.frontTrackHalf, R, G.frontAxleZ]}>
          <Wheel ref={spins[0]} side={1} radius={R} width={G.frontTireWidth} hub={big ? paintYellow : undefined} />
        </group>
        <group ref={steerR} position={[-G.frontTrackHalf, R, G.frontAxleZ]}>
          <Wheel ref={spins[1]} side={-1} radius={R} width={G.frontTireWidth} hub={big ? paintYellow : undefined} />
        </group>
        {/* 後輪（2 軸・ダブルタイヤ） */}
        {G.rearAxleZ.map((z, i) => (
          <group key={z}>
            <group position={[G.rearTrackHalf, R, z]}>
              <Wheel ref={spins[2 + i * 2]} side={1} radius={R} width={G.rearTireWidth} hub={big ? paintYellow : undefined} />
            </group>
            <group position={[-G.rearTrackHalf, R, z]}>
              <Wheel ref={spins[3 + i * 2]} side={-1} radius={R} width={G.rearTireWidth} hub={big ? paintYellow : undefined} />
            </group>
          </group>
        ))}

        <object3D ref={hoistBase} position={G.hoistBase} />
        <HydraulicCylinder start={hoistBase} end={hoistEnd} barrelLength={0.5} radius={0.13} registry={listeners} />

        <group ref={bed} position={G.bedHinge}>
          {big ? <BigBedModel ref={tailgate} paint={bedPaint} geometry={G} /> : <BedModel ref={tailgate} paint={bedPaint} geometry={G} />}
          <object3D ref={hoistEnd} position={G.hoistEnd} />
        </group>
      </group>
    </>
  )
}
