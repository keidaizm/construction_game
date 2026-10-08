import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../stores/gameStore'
import type { VehicleId } from '../vehicles/types'
import { excavatorSensors } from '../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../vehicles/bulldozer/bulldozerSensors'
import { craneSensors } from '../vehicles/crane/craneSensors'
import { lamp } from '../vehicles/shared/materials'
import { dayNight } from './dayNightState'
import { heightAt } from './terrain'

/** 車両ごとのライトの位置（ローカル：高さ・前後）と、照らす先（前方の距離） */
const MOUNT: Record<VehicleId, { height: number; forward: number; reach: number; heading: () => number; x: () => number; z: () => number }> = {
  // ショベルは運転席の向き（旋回した方）を照らす
  excavator: { height: 3.2, forward: 0.8, reach: 9, heading: () => excavatorSensors.cabHeading, x: () => excavatorSensors.x, z: () => excavatorSensors.z },
  dumpTruck: { height: 2.4, forward: 3.2, reach: 14, heading: () => dumpTruckSensors.heading, x: () => dumpTruckSensors.x, z: () => dumpTruckSensors.z },
  // クレーンはトロリーから真下（フックのあたり）を照らす
  crane: { height: 20.3, forward: 0, reach: 0.05, heading: () => craneSensors.yaw, x: () => craneSensors.trolley.x, z: () => craneSensors.trolley.z },
  bulldozer: { height: 2.6, forward: 0.8, reach: 10, heading: () => bulldozerSensors.heading, x: () => bulldozerSensors.x, z: () => bulldozerSensors.z },
}

const SPOT_INTENSITY = 60
const LAMP_GLOW = { off: 0.6, on: 3 }

/**
 * 夜に乗っている車両の前を照らすライト（ボタン／H キーで点ける）。
 * 光源を出し入れする（visible の切り替えも）とシェーダーの作り直しで一瞬止まるので、いつも 1 つ置いておき、明るさだけ変える。
 * 影は落とさない（タブレットで軽く）。
 */
export function Headlights() {
  const scene = useThree((s) => s.scene)
  const spot = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const level = useRef(0)

  useEffect(() => {
    scene.add(target)
    if (spot.current) spot.current.target = target
    return () => {
      scene.remove(target)
    }
  }, [scene, target])

  useFrame((_, rawDt) => {
    const light = spot.current
    if (!light) return
    const dt = Math.min(rawDt, 1 / 20)
    const { headlights, activeVehicle } = useGameStore.getState()
    // パッと点く（少しだけなめらかに）
    level.current += ((headlights ? 1 : 0) - level.current) * (1 - Math.exp(-12 * dt))
    const on = level.current * dayNight.darkness
    light.intensity = SPOT_INTENSITY * on
    lamp.emissiveIntensity = THREE.MathUtils.lerp(LAMP_GLOW.off, LAMP_GLOW.on, on)

    const m = MOUNT[activeVehicle]
    const h = m.heading()
    const sin = Math.sin(h)
    const cos = Math.cos(h)
    const lx = m.x() + sin * m.forward
    const lz = m.z() + cos * m.forward
    const tx = m.x() + sin * (m.forward + m.reach)
    const tz = m.z() + cos * (m.forward + m.reach)
    // ショベルは大きさ（Lv5 から 1.3 倍）に合わせて高く
    const mountHeight = m.height * (activeVehicle === 'excavator' ? excavatorSensors.scale : 1)
    light.position.set(lx, heightAt(lx, lz) + mountHeight, lz)
    target.position.set(tx, heightAt(tx, tz), tz)
  })

  return <spotLight ref={spot} color="#fff3d6" intensity={0} distance={40} decay={1.4} angle={0.7} penumbra={0.5} />
}
