import { useHouseStore } from '../stores/houseStore'
import { PLOTS, PLOT_RADIUS } from '../world/buildSiteLayout'
import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../stores/gameStore'
import { useMissionStore } from '../stores/missionStore'
import { dumpTruckSensors } from '../vehicles/dumpTruck/dumpTruckSensors'
import { DELIVERY_ZONE as Z } from './missionConfig'
import type { VehicleId } from '../vehicles/types'
import { createArrowGeometry } from './arrowGeometry'

/**
 * 道案内の矢印。岩を積んだダンプに乗っているとき、トラックの上に平たく浮かんで「おきば」の方向を指す。
 * 後ろ上からのカメラで形が分かるよう、地面と平行に寝かせてある。
 */
export function GuideArrow({ targets }: { targets: Record<VehicleId, RefObject<THREE.Object3D | null>> }) {
  const group = useRef<THREE.Group>(null)
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#2fbf5b', transparent: true, opacity: 0.92, depthTest: false }),
    [],
  )
  const outline = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false }),
    [],
  )
  const geometry = useMemo(createArrowGeometry, [])
  const scale = useRef(0)

  useFrame(({ clock }, dt) => {
    const g = group.current
    const vehicle = useGameStore.getState().activeVehicle
    const t = targets[vehicle].current
    if (!g || !t) return
    const mission = useMissionStore.getState()
    // 木材だけを積んだダンプは、いま建てている家の区画へ（Lv6）
    const houses = useHouseStore.getState().built
    const toPlot = vehicle === 'dumpTruck' && dumpTruckSensors.loadedLogs > 0 && dumpTruckSensors.loadedCount === 0 && houses < PLOTS.length
    const goal = toPlot ? { x: PLOTS[houses].x, z: PLOTS[houses].z, radius: PLOT_RADIUS } : Z
    const dx = goal.x - t.position.x
    const dz = goal.z - t.position.z
    // 石を積んだダンプ、または「とりのぞこう」のショベル（おきばへ行く）
    const wantsZone =
      (vehicle === 'dumpTruck' && dumpTruckSensors.loadedCount > 0) || (vehicle !== 'dumpTruck' && mission.kind === 'remove')
    const show = (toPlot || (wantsZone && mission.status === 'playing')) && vehicle !== 'crane' && Math.hypot(dx, dz) > goal.radius
    scale.current += ((show ? 1 : 0) - scale.current) * Math.min(1, dt * 6)
    g.visible = scale.current > 0.02
    if (!g.visible) return
    const bob = Math.sin(clock.elapsedTime * 4) * 0.15
    g.position.set(t.position.x, t.position.y + 5.4 + bob, t.position.z) // 荷台の数の札（3.9m）より上
    g.rotation.y = Math.atan2(dx, dz)
    g.scale.setScalar(scale.current * 1.3 * (1 + Math.sin(clock.elapsedTime * 6) * 0.05))
  })

  return (
    <group ref={group} visible={false}>
      {/* 後ろ上のカメラから形が見やすいよう、矢印の先を少し持ち上げてカメラの方へ向ける */}
      <group rotation-x={-0.45}>
        {/* 白いふち（少し大きく下に敷く）＋ 緑の矢印 */}
        <mesh geometry={geometry} material={outline} scale={[1.18, 1, 1.15]} position-y={-0.02} renderOrder={10} />
        <mesh geometry={geometry} material={material} renderOrder={11} />
      </group>
    </group>
  )
}
