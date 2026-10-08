import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type CameraMode } from '../stores/gameStore'
import { readAxes, zeroAxes } from '../stores/inputStore'
import type { VehicleId } from '../vehicles/types'
import { useOrbitDrag } from './useOrbitDrag'
import { bulldozerSensors } from '../vehicles/bulldozer/bulldozerSensors'
import { excavatorSensors } from '../vehicles/excavator/excavatorSensors'

interface ViewPreset {
  /** 車両ローカルでのカメラ位置（+Z 前、+X 左） */
  offset: THREE.Vector3
  /** 車両ローカルでの注視点（スワイプで回り込むときの中心） */
  lookAt: THREE.Vector3
  /** 追従の速さ（大きいほどキビキビ） */
  follow: number
  /**
   * 速く走っているときの視点（あれば、速さに応じて offset / lookAt からなめらかに移る）。
   * from〜to [m/s] の間で切り替わる
   */
  fast?: { offset: THREE.Vector3; lookAt: THREE.Vector3; from: number; to: number; speed: () => number }
}

/**
 * 車両ごとの視点の定義。現在は 'chase'（斜め後方）のみ。
 * 'cab' や 'top' を実装するときはここにプリセットを足す。
 */
const VIEWS: Record<VehicleId, Partial<Record<CameraMode, ViewPreset>>> = {
  excavator: {
    chase: { offset: new THREE.Vector3(-4.5, 7.5, -11.5), lookAt: new THREE.Vector3(0, 2.2, 4), follow: 3.5 },
  },
  dumpTruck: {
    // 真後ろのやや左から（積み込み位置では右隣にショベルカーがいるので、それで視界がふさがらないように）
    chase: { offset: new THREE.Vector3(1.5, 7, -13), lookAt: new THREE.Vector3(0, 1.8, 3), follow: 4.5 }, // 速く走っても置いていかれないように
  },
  crane: {
    // 腕に直角な横から、少し見下ろす（ユーザー要望「横から見ながら操作」）。注目点はトロリーの下（コントローラが置く）
    chase: { offset: new THREE.Vector3(-22, 9, -2), lookAt: new THREE.Vector3(0, 0, 0), follow: 4 },
  },
  bulldozer: {
    // 運転席の向こうの排土板と、その前の石が見えるよう、高めから見下ろす
    // 速く走るときは目線を低くして前の方まで見えるように（ユーザー要望）
    chase: {
      offset: new THREE.Vector3(-2, 10, -5),
      lookAt: new THREE.Vector3(0, 0, 4.5),
      follow: 3.5,
      fast: { offset: new THREE.Vector3(-2.5, 6.5, -10), lookAt: new THREE.Vector3(0, 1.2, 6), from: 1.5, to: 5, speed: () => Math.abs(bulldozerSensors.speed) },
    },
  },
}

/** 見下ろす角度の範囲（地面すれすれ〜ほぼ真上にならないように） */
const MIN_ELEVATION = THREE.MathUtils.degToRad(12)
const MAX_ELEVATION = THREE.MathUtils.degToRad(72)
/** 走っているとき、回り込んだ視点がいつもの斜め後ろへ戻る速さ */
const RETURN_WHILE_DRIVING = 1.2

const desiredPos = new THREE.Vector3()
const desiredLook = new THREE.Vector3()
const rel = new THREE.Vector3()
const viewOffset = new THREE.Vector3()
const viewLook = new THREE.Vector3()
/** 速さで視点が変わるときの、変わり方の速さ（小さいほどゆっくり） */
const SPEED_VIEW_RESPONSE = 1.5
const axes = zeroAxes()

/**
 * 乗っている車両を追いかける 3 人称カメラ。乗り換えると、なめらかに次の車両へ移る。
 * 画面をなぞると車両のまわりを回り込める（useOrbitDrag）。
 */
export function FollowCamera({ targets }: { targets: Record<VehicleId, RefObject<THREE.Object3D | null>> }) {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  const mode = useGameStore((s) => s.cameraMode)
  const vehicle = useGameStore((s) => s.activeVehicle)
  const resetToken = useGameStore((s) => s.resetToken)
  const look = useRef<THREE.Vector3 | null>(null)
  const orbit = useOrbitDrag(canvas)
  /** 速く走るときの視点への移り具合（0 = ふだん / 1 = 速いとき） */
  const fastBlend = useRef(0)

  // 乗り換え・はじめからで、いつもの視点に戻す
  useEffect(() => {
    orbit.current.yaw = 0
    orbit.current.pitch = 0
    fastBlend.current = 0
  }, [vehicle, resetToken, orbit])

  useFrame((_, rawDt) => {
    const t = targets[vehicle].current
    const view = VIEWS[vehicle][mode] ?? VIEWS[vehicle].chase!
    if (!t) return
    const dt = Math.min(rawDt, 1 / 20)
    const o = orbit.current

    // 速さに応じて、ふだんの視点と速いときの視点の間をなめらかに移る
    let blendTarget = 0
    if (view.fast) blendTarget = THREE.MathUtils.smoothstep(view.fast.speed(), view.fast.from, view.fast.to)
    fastBlend.current += (blendTarget - fastBlend.current) * (1 - Math.exp(-SPEED_VIEW_RESPONSE * dt))
    // 大きくなったショベル（Lv5 から 1.3 倍）は、少しはなれて見る
    const zoom = vehicle === 'excavator' ? 1 + (excavatorSensors.scale - 1) * 0.7 : 1
    viewOffset.copy(view.offset).multiplyScalar(zoom)
    viewLook.copy(view.lookAt).multiplyScalar(zoom)
    if (view.fast) {
      viewOffset.lerp(view.fast.offset, fastBlend.current)
      viewLook.lerp(view.fast.lookAt, fastBlend.current)
    }

    // 走り出したら、回り込んだ視点を少しずつ斜め後ろへ戻す（進む方向が見えるように）
    readAxes(axes)
    if (!o.dragging && Math.abs(axes.driveY) > 0.15) {
      const k = Math.exp(-RETURN_WHILE_DRIVING * dt)
      o.yaw *= k
      o.pitch *= k
    }

    // 注視点を中心に、いつもの位置から yaw / pitch だけ回した位置へ
    rel.subVectors(viewOffset, viewLook)
    const radius = rel.length()
    const flat = Math.hypot(rel.x, rel.z)
    const baseElevation = Math.atan2(rel.y, flat)
    const elevation = THREE.MathUtils.clamp(baseElevation + o.pitch, MIN_ELEVATION, MAX_ELEVATION)
    o.pitch = elevation - baseElevation // 範囲の外まで回し続けても、戻すときに引っかからないように
    const heading = Math.atan2(rel.x, rel.z) + o.yaw
    const horizontal = Math.cos(elevation) * radius
    rel.set(Math.sin(heading) * horizontal, Math.sin(elevation) * radius, Math.cos(heading) * horizontal)

    desiredLook.copy(viewLook).applyAxisAngle(THREE.Object3D.DEFAULT_UP, t.rotation.y).add(t.position)
    desiredPos.copy(rel).applyAxisAngle(THREE.Object3D.DEFAULT_UP, t.rotation.y).add(desiredLook)

    // 初回とリセット直後（大きくズレたとき）はすぐに合わせる
    if (!look.current || camera.position.distanceTo(desiredPos) > 30) {
      camera.position.copy(desiredPos)
      look.current = desiredLook.clone()
    } else {
      // なぞっている最中は指についてくるようにキビキビ動かす
      const k = 1 - Math.exp(-(o.dragging ? 12 : view.follow) * dt)
      camera.position.lerp(desiredPos, k)
      look.current.lerp(desiredLook, Math.min(1, k * 1.8))
    }
    camera.lookAt(look.current)
  })

  return null
}
