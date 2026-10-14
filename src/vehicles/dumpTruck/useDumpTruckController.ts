import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { readAxes, zeroAxes } from '../../stores/inputStore'
import { useGameStore } from '../../stores/gameStore'
import { clamp, shapeInput } from '../../controls/inputMath'
import { audio } from '../../audio/AudioManager'
import { approach, createJoint, stepJoint } from '../shared/joint'
import { applyTeleport, vehicleStates } from '../shared/devTeleport'
import { applyTerrainPose, createTerrainPose } from '../shared/terrainPose'
import { canMoveTo, removeFootprint, setFootprint } from '../shared/footprints'
import { setDigFloor } from '../shared/digFloors'
import type { RigListener } from '../shared/rig'
import { DUMP_TRUCK, truckShape } from './dumpTruckConfig'
import { dumpTruckSensors } from './dumpTruckSensors'

export interface DumpTruckRigRefs {
  root: RefObject<THREE.Group | null>
  bed: RefObject<THREE.Group | null>
  tailgate: RefObject<THREE.Group | null>
  /** 前輪の向きを変える Group */
  steer: RefObject<THREE.Group | null>[]
  /** 転がる Group（全輪） */
  spin: RefObject<THREE.Group | null>[]
}

function createState() {
  const { x, z, heading } = DUMP_TRUCK.start
  return { x, z, heading, speed: 0, steer: 0, bed: createJoint(DUMP_TRUCK.bed), wheelTurn: 0 }
}


/**
 * ダンプカーの操作ロジック。
 * - ジョイスティック：上下 = アクセル／バック、左右 = ハンドル（車と同じように曲がる）
 * - レバー：荷台の上げ下げ
 */
export function useDumpTruckController(
  rig: DumpTruckRigRefs,
  listeners: RefObject<RigListener[]>,
  bedPaint: THREE.MeshStandardMaterial,
) {
  const state = useRef(createState())
  const terrain = useRef(createTerrainPose())
  const axes = useRef(zeroAxes())
  const resetToken = useGameStore((s) => s.resetToken)

  useEffect(() => {
    state.current = createState()
  }, [resetToken])
  useEffect(
    () => () => {
      removeFootprint('dumpTruck')
      setDigFloor('dumpTruck', null)
    },
    [],
  )

  useFrame((_, rawDt) => {
    const root = rig.root.current
    const bed = rig.bed.current
    const tailgate = rig.tailgate.current
    if (!root || !bed || !tailgate) return
    const dt = Math.min(rawDt, 1 / 20)
    const s = state.current
    applyTeleport('dumpTruck', s)
    vehicleStates.dumpTruck = s
    const input = readAxes(axes.current)
    if (useGameStore.getState().activeVehicle !== 'dumpTruck') for (const k in input) input[k as keyof typeof input] = 0

    // --- 走行 ---
    const d = DUMP_TRUCK.drive
    const G = truckShape.current
    const throttle = shapeInput(input.driveY)
    const steerIn = shapeInput(input.driveX)
    const forwardMax = s.bed.angle > DUMP_TRUCK.cargo.attachBelowAngle ? d.bedUpMaxSpeed : d.maxSpeed
    const target = throttle >= 0 ? throttle * forwardMax : throttle * d.maxReverseSpeed
    // 逆方向への切り返しや、アクセルを戻したときはブレーキ（速めに減速）
    const braking = Math.sign(target) !== Math.sign(s.speed) || Math.abs(target) < Math.abs(s.speed)
    s.speed = approach(s.speed, target, braking ? d.brakeResponse : d.accelResponse, dt)
    // 速いほどハンドルの切れ角を小さく（速いときにクルッと回りすぎないように）
    const steerLimit = d.maxSteer * (1 - (1 - d.minSteerRatio) * Math.min(1, Math.abs(s.speed) / d.steerFadeSpeed))
    s.steer = approach(s.steer, -steerIn * steerLimit, d.steerResponse, dt) // + で左

    const heading = s.heading + ((s.speed * Math.tan(s.steer)) / G.wheelBase) * dt
    const next = {
      x: clamp(s.x + Math.sin(heading) * s.speed * dt, -d.fieldLimit, d.fieldLimit),
      z: clamp(s.z + Math.cos(heading) * s.speed * dt, -d.fieldLimit, d.fieldLimit),
      heading,
    }
    if (canMoveTo('dumpTruck', s, next, G.footprint)) {
      s.x = next.x
      s.z = next.z
      s.heading = next.heading
      s.wheelTurn += (s.speed * dt) / G.wheelRadius
    } else {
      s.speed = 0 // 他の車両にぶつかったら止まる
    }
    setFootprint('dumpTruck', s.x, s.z, s.heading, G.footprint)

    // --- 荷台 ---
    const bedIn = shapeInput(input.bed)
    stepJoint(s.bed, DUMP_TRUCK.bed, bedIn, dt)

    // --- transform へ反映 ---
    applyTerrainPose(root, terrain.current, s.x, s.z, s.heading, G.poseHalf[0], G.poseHalf[1], dt)
    for (const w of rig.steer) if (w.current) w.current.rotation.y = s.steer
    for (const w of rig.spin) if (w.current) w.current.rotation.x = s.wheelTurn
    bed.rotation.x = -s.bed.angle
    tailgate.rotation.x = s.bed.angle // あおりは重力でぶら下がったまま（下側が開く）
    root.updateMatrixWorld(true)

    // 荷台が下りているときは、荷台の床をバケットが突き抜けない床として登録する
    if (s.bed.angle < DUMP_TRUCK.cargo.attachBelowAngle) {
      const cz = G.bedHinge[2] + G.bedLength / 2
      setDigFloor('dumpTruck', {
        x: s.x + Math.sin(s.heading) * cz,
        z: s.z + Math.cos(s.heading) * cz,
        heading: s.heading,
        halfWidth: G.bedWidth / 2,
        halfLength: G.bedLength / 2,
        top: G.bedHinge[1] + G.bedFloorThickness,
      })
    } else {
      setDigFloor('dumpTruck', null)
    }

    dumpTruckSensors.bedAngle = s.bed.angle
    dumpTruckSensors.speed = s.speed
    dumpTruckSensors.x = s.x
    dumpTruckSensors.z = s.z
    dumpTruckSensors.heading = s.heading
    for (const l of listeners.current) l.update(dt)

    bedPaint.emissiveIntensity = approach(bedPaint.emissiveIntensity, Math.abs(bedIn) * 0.45, 10, dt)
    // 音は乗っているときだけ（乗っていない車両が上書きしないように）
    if (useGameStore.getState().activeVehicle === 'dumpTruck') {
      audio.setEngine('dumpTruck', Math.min(1, Math.abs(throttle) * 0.35 + (Math.abs(s.speed) / d.maxSpeed) * 0.75 + Math.abs(bedIn) * 0.4))
      audio.setHydraulicLoad(Math.abs(bedIn) * 0.8)
      audio.setReversing(s.speed < -0.3)
    }
  })
}
