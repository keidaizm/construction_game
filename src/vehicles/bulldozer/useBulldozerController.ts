import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { readAxes, zeroAxes } from '../../stores/inputStore'
import { useGameStore } from '../../stores/gameStore'
import { shapeInput, clamp } from '../../controls/inputMath'
import { audio } from '../../audio/AudioManager'
import { BULLDOZER } from './bulldozerConfig'
import { approach, createJoint, stepJoint } from '../shared/joint'
import { applyTeleport, vehicleStates } from '../shared/devTeleport'
import { applyTerrainPose, createTerrainPose } from '../shared/terrainPose'
import { canMoveTo, removeFootprint, setFootprint } from '../shared/footprints'
import type { TrackTravel } from '../shared/Tracks'
import type { RigListener } from '../shared/rig'
import { bulldozerSensors } from './bulldozerSensors'

export interface BulldozerRigRefs {
  root: RefObject<THREE.Group | null>
  /** 排土板を持ち上げる腕（rotation.x） */
  arm: RefObject<THREE.Group | null>
  /** 排土板（腕の先。いつも立った向きに保つ） */
  blade: RefObject<THREE.Group | null>
}

function createState() {
  const { x, z, heading } = BULLDOZER.start
  return { x, z, heading, speed: 0, turnRate: 0, lift: createJoint(BULLDOZER.lift), time: 0 }
}

/**
 * ブルドーザーの操作ロジック。走行（履帯）と排土板の上げ下げだけ。
 * 排土板で石を押すのは当たり判定（BulldozerColliders）にまかせる。
 * 土の山は足元の円（footprint）で止まるので、土ブロックは壊せない。
 */
export function useBulldozerController(
  rig: BulldozerRigRefs,
  travel: RefObject<TrackTravel>,
  listeners: RefObject<RigListener[]>,
  bladePaint: THREE.MeshStandardMaterial,
) {
  const state = useRef(createState())
  const terrain = useRef(createTerrainPose())
  const axes = useRef(zeroAxes())
  const resetToken = useGameStore((s) => s.resetToken)

  useEffect(() => {
    state.current = createState()
  }, [resetToken])
  useEffect(() => () => removeFootprint('bulldozer'), [])

  useFrame((_, rawDt) => {
    const root = rig.root.current
    const arm = rig.arm.current
    const blade = rig.blade.current
    if (!root || !arm || !blade) return

    const dt = Math.min(rawDt, 1 / 20)
    const s = state.current
    applyTeleport('bulldozer', s)
    vehicleStates.bulldozer = s
    const input = readAxes(axes.current)
    const active = useGameStore.getState().activeVehicle === 'bulldozer'
    if (!active) for (const k in input) input[k as keyof typeof input] = 0
    s.time += dt

    // --- 走行（履帯。ショベルと同じ動き） ---
    const d = BULLDOZER.drive
    const fwd = shapeInput(input.driveY)
    const turn = shapeInput(input.driveX)
    const targetSpeed = fwd >= 0 ? fwd * d.maxSpeed : fwd * d.maxReverseSpeed
    s.speed = approach(s.speed, targetSpeed, d.response, dt)
    s.turnRate = approach(s.turnRate, -turn * d.maxTurnRate, d.response, dt)
    const heading = s.heading + s.turnRate * dt
    const next = {
      x: clamp(s.x + Math.sin(heading) * s.speed * dt, -d.fieldLimit, d.fieldLimit),
      z: clamp(s.z + Math.cos(heading) * s.speed * dt, -d.fieldLimit, d.fieldLimit),
      heading,
    }
    if (canMoveTo('bulldozer', s, next, BULLDOZER.footprint)) {
      s.x = next.x
      s.z = next.z
      s.heading = next.heading
    } else {
      // 車両・木・土の山にぶつかったら止まる（土ブロックは壊せない）
      s.speed = 0
      s.turnRate = 0
    }
    setFootprint('bulldozer', s.x, s.z, s.heading, BULLDOZER.footprint)
    const gauge = BULLDOZER.tracks.gauge
    travel.current.left += (s.speed - s.turnRate * gauge) * dt
    travel.current.right += (s.speed + s.turnRate * gauge) * dt

    // --- 排土板 ---
    const liftIn = shapeInput(input.blade)
    stepJoint(s.lift, BULLDOZER.lift, liftIn, dt)

    const activity = Math.min((Math.abs(liftIn) + Math.abs(fwd) + Math.abs(turn)) / 2, 1)
    applyTerrainPose(root, terrain.current, s.x, s.z, s.heading, 1.7, 1.2, dt, Math.sin(s.time * 55) * 0.003 * (0.4 + activity))
    arm.rotation.x = -s.lift.angle
    blade.rotation.x = s.lift.angle // 腕が上がっても排土板は立ったまま
    root.updateMatrixWorld(true)

    bulldozerSensors.x = s.x
    bulldozerSensors.z = s.z
    bulldozerSensors.heading = s.heading
    bulldozerSensors.speed = s.speed
    for (const l of listeners.current) l.update(dt)

    bladePaint.emissiveIntensity = approach(bladePaint.emissiveIntensity, Math.abs(liftIn) * 0.45, 10, dt)

    if (active) {
      audio.setEngine('bulldozer', activity)
      audio.setHydraulicLoad(Math.abs(liftIn) * 0.6)
      audio.setReversing(s.speed < -0.3)
    }
  })
}
