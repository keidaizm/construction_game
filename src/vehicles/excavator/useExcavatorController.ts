import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { readAxes, zeroAxes } from '../../stores/inputStore'
import { useGameStore } from '../../stores/gameStore'
import { shapeInput, clamp } from '../../controls/inputMath'
import { audio } from '../../audio/AudioManager'
import { EXCAVATOR } from './excavatorConfig'
import { approach, createJoint, stepJoint, type Joint, type JointConfig } from '../shared/joint'
import { applyTeleport, vehicleStates } from '../shared/devTeleport'
import { applyTerrainPose, createTerrainPose } from '../shared/terrainPose'
import { heightAt } from '../../world/terrain'
import { canMoveTo, removeFootprint, setFootprint } from '../shared/footprints'
import { digFloorTopAt } from '../shared/digFloors'
import type { TrackTravel } from './parts/Crawler'
import type { RigListener } from '../shared/rig'
import { excavatorSensors } from './excavatorSensors'

export interface ExcavatorRigRefs {
  root: RefObject<THREE.Group | null>
  upper: RefObject<THREE.Group | null>
  boom: RefObject<THREE.Group | null>
  arm: RefObject<THREE.Group | null>
  bucket: RefObject<THREE.Group | null>
  bucketTip: RefObject<THREE.Object3D | null>
}

export interface PartPaints {
  boom: THREE.MeshStandardMaterial
  arm: THREE.MeshStandardMaterial
  bucket: THREE.MeshStandardMaterial
}

function createState() {
  return {
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    turnRate: 0,
    swing: createJoint(EXCAVATOR.swing),
    boom: createJoint(EXCAVATOR.boom),
    arm: createJoint(EXCAVATOR.arm),
    bucket: createJoint(EXCAVATOR.bucket),
    time: 0,
  }
}

const tipWorld = new THREE.Vector3()
let footprintScale = 1
let footprint: ReadonlyArray<readonly [number, number]> = EXCAVATOR.footprint
const armQuat = new THREE.Quaternion()
const hangDir = new THREE.Vector3()
/** グラップルのつめが開く・閉じる速さ（1 秒でどれだけ） */
const GRAPPLE_OPEN_SPEED = 1.6
const pivotWorld = new THREE.Vector3()

/**
 * ショベルカーの操作ロジック。入力を読み、走行・旋回・各関節を毎フレーム更新する。
 * 見た目（メッシュ）には触れず、関節の Group の transform だけを書き換えるので、
 * GLB モデルに差し替えても同じコントローラを使える。
 */
export function useExcavatorController(
  rig: ExcavatorRigRefs,
  travel: RefObject<TrackTravel>,
  listeners: RefObject<RigListener[]>,
  paints: PartPaints,
) {
  const state = useRef(createState())
  const terrain = useRef(createTerrainPose())
  const axes = useRef(zeroAxes())
  const resetToken = useGameStore((s) => s.resetToken)

  useEffect(() => {
    state.current = createState()
  }, [resetToken])
  useEffect(() => () => removeFootprint('excavator'), [])

  useFrame((_, rawDt) => {
    const root = rig.root.current
    const upper = rig.upper.current
    const boom = rig.boom.current
    const arm = rig.arm.current
    const bucket = rig.bucket.current
    const tip = rig.bucketTip.current
    if (!root || !upper || !boom || !arm || !bucket || !tip) return

    const dt = Math.min(rawDt, 1 / 20)
    const s = state.current
    applyTeleport('excavator', s)
    vehicleStates.excavator = s
    const input = readAxes(axes.current)
    // 乗っていない車両は入力を受け付けない（当たり判定などの更新は続ける）
    if (useGameStore.getState().activeVehicle !== 'excavator') for (const k in input) input[k as keyof typeof input] = 0
    s.time += dt

    // --- 走行（履帯） ---
    const d = EXCAVATOR.drive
    const fwd = shapeInput(input.driveY)
    const turn = shapeInput(input.driveX)
    const targetSpeed = fwd >= 0 ? fwd * d.maxSpeed : fwd * d.maxReverseSpeed
    s.speed = approach(s.speed, targetSpeed, d.response, dt)
    s.turnRate = approach(s.turnRate, -turn * d.maxTurnRate, d.response, dt) // + で左旋回
    const heading = s.heading + s.turnRate * dt
    const next = {
      x: clamp(s.x + Math.sin(heading) * s.speed * dt, -d.fieldLimit, d.fieldLimit),
      z: clamp(s.z + Math.cos(heading) * s.speed * dt, -d.fieldLimit, d.fieldLimit),
      heading,
    }
    // 大きさに合わせた足元の円（Lv5 から 1.3 倍）
    const S = excavatorSensors.scale
    if (footprintScale !== S) {
      footprintScale = S
      footprint = EXCAVATOR.footprint.map(([z, r]) => [z * S, r * S] as const)
    }
    if (canMoveTo('excavator', s, next, footprint)) {
      s.x = next.x
      s.z = next.z
      s.heading = next.heading
    } else {
      // 他の車両にぶつかったら止まる
      s.speed = 0
      s.turnRate = 0
    }
    setFootprint('excavator', s.x, s.z, s.heading, footprint)
    // 履帯の見た目はショベルのローカル（大きさで割る）
    const gauge = EXCAVATOR.geometry.trackGauge * S
    travel.current.left += ((s.speed - s.turnRate * gauge) * dt) / S
    travel.current.right += ((s.speed + s.turnRate * gauge) * dt) / S

    // --- 作業機 ---
    const swingIn = shapeInput(input.swing)
    const boomIn = shapeInput(input.boom)
    const armIn = shapeInput(input.arm)
    const bucketIn = shapeInput(input.bucket)
    stepJoint(s.swing, EXCAVATOR.swing, -swingIn, dt) // 右旋回 = 上から見て時計回り = 角度が減る

    // --- transform へ反映 ---
    const activity = Math.min(
      (Math.abs(boomIn) + Math.abs(armIn) + Math.abs(bucketIn) + Math.abs(swingIn) + Math.abs(fwd) + Math.abs(turn)) / 3,
      1,
    )
    applyTerrainPose(root, terrain.current, s.x, s.z, s.heading, 1.9 * S, 1.3 * S, dt)
    upper.rotation.y = s.swing.angle
    // エンジンの細かい振動（動かしているほど強く）
    upper.position.y = EXCAVATOR.geometry.upperBodyHeight + Math.sin(s.time * 55) * 0.003 * (0.4 + activity)

    boom.rotation.x = -s.boom.angle
    arm.rotation.x = -s.arm.angle
    bucket.rotation.x = -s.bucket.angle
    root.updateMatrixWorld(true)
    tip.getWorldPosition(tipWorld)

    // 関節を 1 つずつ動かし、バケット先端が地面（やダンプの荷台の床）に入り込まないようにする（当たる手応え）。
    // - ブーム下げで押し込む → 止める
    // - アーム・バケットで押し込む → ブームを少し自動で上げ、先端が地面をなぞる（掘っている感覚）
    const limitHere = () => {
      const floor = digFloorTopAt(tipWorld.x, tipWorld.z)
      // 丘の上でも、その場所の地面から少しだけ掘れる
      const ground = heightAt(tipWorld.x, tipWorld.z) + EXCAVATOR.groundDigLimit
      return floor === null ? ground : Math.max(ground, floor + 0.1)
    }
    const setAngle = (joint: Joint, obj: THREE.Object3D, angle: number) => {
      joint.angle = angle
      obj.rotation.x = -angle
      obj.updateMatrixWorld(true)
      tip.getWorldPosition(tipWorld)
    }
    const grapple = excavatorSensors.tool === 'grapple'
    const work: Array<[Joint, JointConfig, number, THREE.Object3D]> = [
      [s.boom, EXCAVATOR.boom, boomIn, boom],
      [s.arm, EXCAVATOR.arm, armIn, arm],
      // グラップルのとき、バケットのレバーはつめの開け閉め（下でつり下げの角度を決める）
      [s.bucket, EXCAVATOR.bucket, grapple ? 0 : bucketIn, bucket],
    ]
    for (const [joint, cfg, value, obj] of work) {
      const before = joint.angle
      const boomBefore = s.boom.angle
      const tipBefore = tipWorld.y
      stepJoint(joint, cfg, value, dt)
      if (joint.angle === before) continue
      setAngle(joint, obj, joint.angle)
      const limit = limitHere()
      if (tipWorld.y >= limit || tipWorld.y >= tipBefore) continue

      if (joint !== s.boom) {
        // ブームを回すと先端は「ブーム根元からの水平距離 × 角度」だけ上がる
        boom.getWorldPosition(pivotWorld)
        const reach = Math.hypot(tipWorld.x - pivotWorld.x, tipWorld.z - pivotWorld.z)
        if (reach > 0.5) {
          setAngle(s.boom, boom, Math.min(s.boom.angle + (limit - tipWorld.y) / reach, EXCAVATOR.boom.max))
          if (tipWorld.y >= limit - 0.02 || tipWorld.y >= tipBefore) continue
        }
        setAngle(s.boom, boom, boomBefore)
      }
      joint.vel = 0
      setAngle(joint, obj, before)
    }

    if (grapple) {
      // つり下げ：アタッチメントのローカル +Z がいつも真下を向くように、関節の角度を決める
      arm.getWorldQuaternion(armQuat)
      hangDir.set(0, -1, 0).applyQuaternion(armQuat.invert())
      setAngle(s.bucket, bucket, Math.atan2(hangDir.y, hangDir.z))
      // つり下げたグラップルの先が地面より下へ行くなら、ブームを少し上げる（バケットと同じ手ごたえ）
      const limit = limitHere()
      if (tipWorld.y < limit) {
        boom.getWorldPosition(pivotWorld)
        const reach = Math.hypot(tipWorld.x - pivotWorld.x, tipWorld.z - pivotWorld.z)
        if (reach > 0.5) {
          setAngle(s.boom, boom, Math.min(s.boom.angle + (limit - tipWorld.y) / reach, EXCAVATOR.boom.max))
          arm.getWorldQuaternion(armQuat)
          hangDir.set(0, -1, 0).applyQuaternion(armQuat.invert())
          setAngle(s.bucket, bucket, Math.atan2(hangDir.y, hangDir.z))
        }
      }
      // レバー上（開く）で開き、下（巻き込む）で閉じる
      excavatorSensors.grappleOpen = clamp(excavatorSensors.grappleOpen + bucketIn * GRAPPLE_OPEN_SPEED * dt, 0, 1)
    }

    excavatorSensors.bucketTip.copy(tipWorld)
    excavatorSensors.x = s.x
    excavatorSensors.z = s.z
    excavatorSensors.heading = s.heading
    excavatorSensors.cabHeading = s.heading + s.swing.angle
    excavatorSensors.bucketOpenRatio = (s.bucket.angle - EXCAVATOR.bucket.min) / (EXCAVATOR.bucket.max - EXCAVATOR.bucket.min)
    excavatorSensors.scooping = armIn < -0.1 || bucketIn < -0.1
    excavatorSensors.bucketLever = bucketIn
    for (const l of listeners.current) l.update(dt)

    // 操作中の部位をほんのり光らせる
    paints.boom.emissiveIntensity = approach(paints.boom.emissiveIntensity, Math.abs(boomIn) * 0.45, 10, dt)
    paints.arm.emissiveIntensity = approach(paints.arm.emissiveIntensity, Math.abs(armIn) * 0.45, 10, dt)
    paints.bucket.emissiveIntensity = approach(paints.bucket.emissiveIntensity, Math.abs(bucketIn) * 0.45, 10, dt)

    // 音は乗っているときだけ（乗っていない車両が上書きしないように）
    if (useGameStore.getState().activeVehicle === 'excavator') {
      audio.setEngine('excavator', activity)
      audio.setHydraulicLoad(Math.min((Math.abs(boomIn) + Math.abs(armIn) + Math.abs(bucketIn) + Math.abs(swingIn) * 0.5) / 2, 1))
      audio.setReversing(false)
    }
  })
}
