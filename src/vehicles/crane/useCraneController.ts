import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { readAxes, zeroAxes } from '../../stores/inputStore'
import { useGameStore } from '../../stores/gameStore'
import { useCraneStore } from '../../stores/craneStore'
import { shapeInput, clamp } from '../../controls/inputMath'
import { audio } from '../../audio/AudioManager'
import { approach } from '../shared/joint'
import { CRANE, type CraneSite } from './craneConfig'
import { craneSensors } from './craneSensors'
import { CONTAINER_PAD, TOWER_BASE, craneLoads, type LoadEntry } from './craneYard'

export interface CraneRigRefs {
  /** クレーン全体（根元の高さ base.y に合わせて上下する） */
  root: RefObject<THREE.Group | null>
  slew: RefObject<THREE.Group | null>
  trolley: RefObject<THREE.Group | null>
  rope: RefObject<THREE.Mesh | null>
  hook: RefObject<THREE.Group | null>
  marker: RefObject<THREE.Group | null>
  dots: RefObject<THREE.InstancedMesh | null>
  /** カメラが追いかける点（トロリーの下、腕の向き） */
  cameraAnchor: RefObject<THREE.Object3D | null>
}

/** フックの真下の点線の点の数 */
export const MARKER_DOTS = 24

function createState() {
  return {
    yaw: CRANE.slew.initial as number,
    yawVel: 0,
    r: CRANE.trolley.initial as number,
    rVel: 0,
    rope: CRANE.rope.initial as number,
    ropeVel: 0,
    /** 揺れ（ロープの先の横ずれ [m]）とその速さ */
    sway: new THREE.Vector2(),
    swayVel: new THREE.Vector2(),
    lastTrolley: null as THREE.Vector3 | null,
    trolleyVel: new THREE.Vector3(),
    lastHook: new THREE.Vector3(),
    hookVel: new THREE.Vector3(),
    holding: null as LoadEntry | null,
    /** つかんだときの、荷物の向きと腕の向きの差 */
    holdYaw: 0,
    grabPresses: useCraneStore.getState().grabPresses,
  }
}

/**
 * はなすときの手助け：真下のブロック（または土台・台）の上にだいたい乗っていたら、まん中にそろえて向きも合わせる。
 * 横から見る画面では奥行きがぴったり合わせにくいので（6 才でも積めるように）
 */
const SNAP_DISTANCE = 0.8
const SNAP_PAD = 1.5
/** はなしたときに引き継ぐ速さの上限 [m/s] */
const MAX_RELEASE_SPEED = 1.2

const trolleyWorld = new THREE.Vector3()
const ropeEnd = new THREE.Vector3()
const hookTip = new THREE.Vector3()
const mid = new THREE.Vector3()
const dir = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const quat = new THREE.Quaternion()
const euler = new THREE.Euler()
const dummy = new THREE.Object3D()
const rotM = new THREE.Matrix4()

/** 回転した箱の、上下方向の半分の高さ */
function halfHeight(load: LoadEntry) {
  const q = load.body.rotation()
  rotM.makeRotationFromQuaternion(quat.set(q.x, q.y, q.z, q.w))
  const e = rotM.elements
  // 行列の 2 行目（ワールドの y に効く成分）
  return (Math.abs(e[1]) * load.size[0] + Math.abs(e[5]) * load.size[1] + Math.abs(e[9]) * load.size[2]) / 2
}

/**
 * クレーンの操作。旋回（腕を回す）・トロリー（フックを吊る台車を前後）・巻き上げ（フックを上げ下げ）・つかむ／はなす。
 * フックは少しだけ振り子のように揺れる。つかんだ荷物はフックに追従させ（kinematic）、はなすと物理に戻す。
 * フック（と荷物）は地面や下の荷物より下へは下がらない（真下へ光線を飛ばして調べる）。
 * site：どこのクレーンか（基地／屋上）。乗っている方だけが入力・カメラ・センサー・音を使う。
 */
export function useCraneController(rig: CraneRigRefs, site: CraneSite) {
  const { world, rapier } = useRapier()
  const state = useRef(createState())
  const axes = useRef(zeroAxes())
  const resetToken = useGameStore((s) => s.resetToken)

  useEffect(() => {
    const s = state.current
    if (s.holding) s.holding.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
    state.current = createState()
  }, [resetToken, rapier])

  /** (x, z) の真下で、y より下にある一番高い面の高さ（exclude の体は無視） */
  const floorBelow = (x: number, y: number, z: number, exclude?: LoadEntry['body']) => {
    const ray = new rapier.Ray({ x, y, z }, { x: 0, y: -1, z: 0 })
    const hit = world.castRay(ray, 60, true, undefined, undefined, undefined, exclude)
    return hit ? y - hit.timeOfImpact : 0
  }

  useFrame((_, rawDt) => {
    const slew = rig.slew.current
    const trolley = rig.trolley.current
    const rope = rig.rope.current
    const hook = rig.hook.current
    if (!slew || !trolley || !rope || !hook) return
    const dt = Math.min(rawDt, 1 / 20)
    const s = state.current
    const active = useGameStore.getState().activeVehicle === 'crane' && useCraneStore.getState().site === site.id
    const jibY = site.base.y + CRANE.jibY
    if (rig.root.current) rig.root.current.position.y = site.base.y
    const input = readAxes(axes.current)
    if (!active) for (const k in input) input[k as keyof typeof input] = 0

    // --- 旋回・トロリー・巻き上げ ---
    const slewIn = shapeInput(input.swing)
    const trolleyIn = shapeInput(input.arm)
    const hoistIn = shapeInput(input.boom)
    s.yawVel = approach(s.yawVel, -slewIn * CRANE.slew.maxSpeed, CRANE.slew.response, dt) // 右 = 上から見て時計回り
    s.yaw += s.yawVel * dt
    s.rVel = approach(s.rVel, trolleyIn * CRANE.trolley.maxSpeed, CRANE.trolley.response, dt)
    s.r += s.rVel * dt
    if (s.r < CRANE.trolley.min || s.r > CRANE.trolley.max) {
      s.r = clamp(s.r, CRANE.trolley.min, CRANE.trolley.max)
      s.rVel = 0
    }
    s.ropeVel = approach(s.ropeVel, -hoistIn * site.ropeSpeed, CRANE.rope.response, dt) // 上げ = ロープを短く
    s.rope += s.ropeVel * dt
    if (s.rope < CRANE.rope.min) {
      s.rope = CRANE.rope.min
      s.ropeVel = 0
    }

    // トロリーの位置と加速度（揺れのもと）
    const sin = Math.sin(s.yaw)
    const cos = Math.cos(s.yaw)
    trolleyWorld.set(site.x + sin * s.r, jibY - 0.7, site.z + cos * s.r)
    let ax = 0
    let az = 0
    if (s.lastTrolley && dt > 0) {
      const vx = (trolleyWorld.x - s.lastTrolley.x) / dt
      const vz = (trolleyWorld.z - s.lastTrolley.z) / dt
      ax = (vx - s.trolleyVel.x) / dt
      az = (vz - s.trolleyVel.z) / dt
      s.trolleyVel.set(vx, 0, vz)
    }
    s.lastTrolley = (s.lastTrolley ?? new THREE.Vector3()).copy(trolleyWorld)

    // --- 揺れ（ロープの先の横ずれ）：振り子。少しだけ・すぐおさまる ---
    const g = 9.8 / Math.max(s.rope, 1)
    s.swayVel.x += (-g * s.sway.x - CRANE.sway.damping * s.swayVel.x - ax * CRANE.sway.gain) * dt
    s.swayVel.y += (-g * s.sway.y - CRANE.sway.damping * s.swayVel.y - az * CRANE.sway.gain) * dt
    s.sway.addScaledVector(s.swayVel, dt)
    const maxSway = s.rope * Math.tan(CRANE.sway.maxAngle)
    if (s.sway.length() > maxSway) {
      s.sway.setLength(maxSway)
      s.swayVel.multiplyScalar(0.5)
    }

    // --- 地面・下の荷物より下へ行かない ---
    const held = s.holding
    const heldH = held ? held.size[1] : 0
    const swayLen = s.sway.length()
    const drop = Math.sqrt(Math.max(s.rope * s.rope - swayLen * swayLen, 0))
    ropeEnd.set(trolleyWorld.x + s.sway.x, trolleyWorld.y - drop, trolleyWorld.z + s.sway.y)
    let floor: number
    if (held) {
      // 荷物の底の 4 すみとまん中の真下
      const yaw = s.yaw + s.holdYaw
      const hw = held.size[0] / 2 - 0.05
      const hd = held.size[2] / 2 - 0.05
      const bottom = ropeEnd.y - CRANE.hookHeight - heldH
      floor = -Infinity
      for (const [lx, lz] of [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) {
        const wx = ropeEnd.x + Math.cos(yaw) * lx + Math.sin(yaw) * lz
        const wz = ropeEnd.z - Math.sin(yaw) * lx + Math.cos(yaw) * lz
        floor = Math.max(floor, floorBelow(wx, bottom + heldH * 0.5, wz, held.body))
      }
    } else {
      floor = floorBelow(ropeEnd.x, ropeEnd.y - CRANE.hookHeight + 0.3, ropeEnd.z)
    }
    const maxRope = jibY - 0.7 - CRANE.hookHeight - heldH - floor - 0.03
    if (s.rope > maxRope) {
      s.rope = Math.max(CRANE.rope.min, maxRope)
      if (s.ropeVel > 0) s.ropeVel = 0
      const d2 = Math.sqrt(Math.max(s.rope * s.rope - swayLen * swayLen, 0))
      ropeEnd.y = trolleyWorld.y - d2
    }
    hookTip.set(ropeEnd.x, ropeEnd.y - CRANE.hookHeight, ropeEnd.z)
    if (dt > 0) s.hookVel.subVectors(hookTip, s.lastHook).divideScalar(dt)
    s.lastHook.copy(hookTip)

    // --- つかめる荷物をさがす（フックの下） ---
    let candidate: LoadEntry | null = null
    if (!held) {
      let best = Infinity
      for (const load of craneLoads.list) {
        const p = load.body.translation()
        const top = p.y + halfHeight(load)
        const gap = hookTip.y - top
        if (gap < -CRANE.grabReach.below || gap > CRANE.grabReach.above) continue
        const horizontal = Math.hypot(p.x - hookTip.x, p.z - hookTip.z)
        if (horizontal > Math.min(load.size[0], load.size[2]) / 2 + 0.45) continue
        if (horizontal < best) {
          best = horizontal
          candidate = load
        }
      }
    }

    // --- つかむ／はなすボタン ---
    const presses = useCraneStore.getState().grabPresses
    if (presses !== s.grabPresses) {
      s.grabPresses = presses
      if (active && held) {
        // 真下にあるもの（ブロック・土台・台）にそろえる
        const p = held.body.translation()
        const bottom = p.y - held.size[1] / 2
        const ray = new rapier.Ray({ x: p.x, y: bottom + 0.05, z: p.z }, { x: 0, y: -1, z: 0 })
        // 下ろしきる手前（すぐ下に何かある）ときだけ手助けする。高い所からはなしたら、そのまま落ちる
        const hit = world.castRay(ray, 0.65, true, undefined, undefined, undefined, held.body)
        const below = hit ? craneLoads.list.find((l) => l.body.handle === hit.collider.parent()?.handle) : undefined
        let snap: { x: number; z: number; yaw: number } | null = null
        if (!hit) {
          // 何もしない
        } else if (below) {
          const bp = below.body.translation()
          const bq = below.body.rotation()
          if (Math.hypot(bp.x - p.x, bp.z - p.z) < SNAP_DISTANCE) snap = { x: bp.x, z: bp.z, yaw: euler.setFromQuaternion(quat.set(bq.x, bq.y, bq.z, bq.w), 'YXZ').y }
        } else if (site.snap) {
          snap = site.snap(p.x, p.z)
        } else if (held.game === 'tower' && Math.hypot(TOWER_BASE.x - p.x, TOWER_BASE.z - p.z) < SNAP_PAD) {
          snap = { x: TOWER_BASE.x, z: TOWER_BASE.z, yaw: TOWER_BASE.yaw }
        } else if (held.game === 'containers' && Math.hypot(CONTAINER_PAD.x - p.x, CONTAINER_PAD.z - p.z) < SNAP_PAD) {
          snap = { x: CONTAINER_PAD.x, z: CONTAINER_PAD.z, yaw: CONTAINER_PAD.yaw }
        }
        if (snap) {
          // 向きは 90° ごとに近い方へ（長いブロックを十字に重ねることもできる）
          const cur = s.yaw + s.holdYaw
          const yaw = snap.yaw + Math.round((cur - snap.yaw) / (Math.PI / 2)) * (Math.PI / 2)
          held.body.setTranslation({ x: snap.x, y: p.y, z: snap.z }, true)
          held.body.setRotation(quat.setFromEuler(euler.set(0, yaw, 0, 'YXZ')), true)
        }
        held.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
        // フックの勢いを少しだけ引き継ぐ（ロープの長さが急に変わった時などに飛んでいかないよう、上限を付ける）
        const v = new THREE.Vector3(s.hookVel.x, Math.min(0, s.hookVel.y), s.hookVel.z)
        if (v.length() > MAX_RELEASE_SPEED) v.setLength(MAX_RELEASE_SPEED)
        held.body.setLinvel(snap ? { x: 0, y: 0, z: 0 } : v, true)
        held.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        s.holding = null
        audio.play('rockDrop')
      } else if (active && candidate) {
        const q = candidate.body.rotation()
        euler.setFromQuaternion(quat.set(q.x, q.y, q.z, q.w), 'YXZ')
        s.holdYaw = euler.y - s.yaw
        candidate.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
        s.holding = candidate
        audio.play('rockLoad')
      }
    }

    // つかんでいる荷物はフックの下にぶら下げる（水平に）
    if (s.holding) {
      const h = s.holding.size[1]
      s.holding.body.setNextKinematicTranslation({ x: hookTip.x, y: hookTip.y - h / 2, z: hookTip.z })
      quat.setFromEuler(euler.set(0, s.yaw + s.holdYaw, 0, 'YXZ'))
      s.holding.body.setNextKinematicRotation(quat)
    }

    // --- 見た目 ---
    slew.rotation.y = s.yaw
    trolley.position.z = s.r
    // ロープ：トロリーからロープの先まで
    mid.addVectors(trolleyWorld, ropeEnd).multiplyScalar(0.5)
    dir.subVectors(ropeEnd, trolleyWorld)
    rope.position.copy(mid)
    rope.scale.set(1, dir.length(), 1)
    rope.quaternion.setFromUnitVectors(UP, dir.normalize().negate())
    hook.position.copy(ropeEnd)
    hook.rotation.set(0, s.yaw, 0)

    // 乗っていないクレーンは、ここから先（印・カメラ・センサー・音）を使わない
    if (!active) {
      if (rig.marker.current) rig.marker.current.visible = false
      if (rig.dots.current) rig.dots.current.visible = false
      return
    }

    // フックの真下の地面の印と点線（どこに下りるかが分かるように）
    const bottomY = hookTip.y - heldH
    const groundY = held ? floor : floorBelow(hookTip.x, hookTip.y + 0.05, hookTip.z)
    const marker = rig.marker.current
    if (marker) {
      marker.position.set(hookTip.x, groundY + 0.06, hookTip.z)
      marker.visible = active
    }
    const dots = rig.dots.current
    if (dots) {
      dots.visible = active
      for (let i = 0; i < MARKER_DOTS; i++) {
        const t = (i + 0.5) / MARKER_DOTS
        dummy.position.set(hookTip.x, bottomY + (groundY - bottomY) * t, hookTip.z)
        dummy.scale.setScalar(bottomY - groundY > 0.4 ? 1 : 0)
        dummy.updateMatrix()
        dots.setMatrixAt(i, dummy.matrix)
      }
      dots.instanceMatrix.needsUpdate = true
    }

    // カメラの注目点：トロリーの下、フックと地面の間（横から見て両方入るように）
    const anchor = rig.cameraAnchor.current
    if (anchor) {
      // 屋上のクレーンはフックについていく（地面から屋上まで高いので、両方は入らない）
      anchor.position.set(trolleyWorld.x, site.followHook ? Math.max(3, hookTip.y - 1.5) : clamp((hookTip.y + groundY) / 2, 3, 11), trolleyWorld.z)
      anchor.rotation.set(0, s.yaw, 0)
    }

    craneSensors.hookTip.copy(hookTip)
    craneSensors.trolley.copy(trolleyWorld)
    craneSensors.yaw = s.yaw
    craneSensors.holding = s.holding?.id ?? null
    const store = useCraneStore.getState()
    const canGrab = !s.holding && !!candidate
    if (store.canGrab !== canGrab || store.holding !== !!s.holding) store.setGrabState(canGrab, !!s.holding)
    if (marker) {
      const ring = marker.children[0] as THREE.Mesh | undefined
      const m = ring?.material as THREE.MeshBasicMaterial | undefined
      m?.color.set(s.holding ? '#ffb000' : canGrab ? '#2fbf5b' : '#ffffff')
    }

    if (active) {
      const activity = Math.min((Math.abs(slewIn) + Math.abs(trolleyIn) + Math.abs(hoistIn)) / 1.5, 1)
      audio.setEngine('crane', activity)
      audio.setHydraulicLoad(Math.abs(hoistIn) * 0.5)
      audio.setReversing(false)
    }
  })
}
