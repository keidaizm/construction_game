import { excavatorSensors } from '../vehicles/excavator/excavatorSensors'
import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rockRegistry } from '../cargo/rocks/rockRegistry'
import { ROCK_COLORS, ROCK_COLOR_ORDER, type RockColor } from '../cargo/rocks/rockTypes'
import { useGameStore } from '../stores/gameStore'
import { useMissionStore } from '../stores/missionStore'
import type { VehicleId } from '../vehicles/types'
import { createArrowGeometry } from './arrowGeometry'
import { countByColor } from './cargoCounts'
import { insideZone } from './missionConfig'

/** 車両のまわりの輪の半径 [m]（車両の大きさに合わせる） */
const RING_RADIUS: Record<VehicleId, number> = { excavator: 4.5, dumpTruck: 5.5, bulldozer: 4.5, crane: 0 }
/** 目的の岩がこれより近くなったら矢印を消す（もう着いている） */
const ARRIVED_DISTANCE = 8

const target = new THREE.Vector3()

/**
 * コンパス式の道案内。乗っている車両の足元に輪のように浮かび、
 * ミッションで「まだ足りない色」ごとに 1 本ずつ、その色のいちばん近い岩を指す。
 * - 例：くろ 3こ ＋ ふつう 2こ なら、黒い矢印と灰色の矢印の 2 本
 * - おきば・荷台・バケットにある分を数に入れ、足りた色の矢印は消える
 */
export function CompassArrows({ targets }: { targets: Record<VehicleId, RefObject<THREE.Object3D | null>> }) {
  const arrows = useRef<(THREE.Group | null)[]>([])
  const geometry = useMemo(createArrowGeometry, [])
  const materials = useMemo(
    () =>
      Object.fromEntries(
        ROCK_COLOR_ORDER.map((c) => [
          c,
          {
            fill: new THREE.MeshBasicMaterial({ color: ROCK_COLORS[c].icon, transparent: true, opacity: 0.95, depthTest: false }),
            edge: new THREE.MeshBasicMaterial({ color: c === 'white' ? '#555555' : '#ffffff', transparent: true, opacity: 0.9, depthTest: false }),
          },
        ]),
      ) as Record<RockColor, { fill: THREE.MeshBasicMaterial; edge: THREE.MeshBasicMaterial }>,
    [],
  )

  useFrame(({ clock }) => {
    const vehicle = useGameStore.getState().activeVehicle
    const v = targets[vehicle].current
    const mission = useMissionStore.getState()
    const truck = countByColor('truck')
    const held = countByColor('held')

    // 色ごとに、まだ運んでいない岩のうち、いちばん近いもの
    const nearest = ROCK_COLOR_ORDER.map((color) => {
      let best = Infinity
      const at = new THREE.Vector3()
      if (v) {
        for (const r of rockRegistry.rocks) {
          if (r.color !== color || r.state !== 'free') continue
          const p = r.body.translation()
          if (insideZone(p)) continue
          const d = Math.hypot(p.x - v.position.x, p.z - v.position.z)
          if (d < best) {
            best = d
            at.set(p.x, 0, p.z)
          }
        }
      }
      return { color, dist: best, at }
    })

    // どの色の矢印を出すか
    // - はこぼう：足りない色ぜんぶ ／ つくろう：まだ足りなければ、近い 2 色 ／ とりのぞこう：出さない
    const show = new Set<RockColor>()
    if (mission.status === 'playing' && mission.kind === 'carry') {
      for (const p of mission.parts) {
        const need = p.count - (mission.colorCounts[p.color] ?? 0) - (truck[p.color] ?? 0) - (held[p.color] ?? 0)
        if (need > 0) show.add(p.color)
      }
    } else if (mission.status === 'playing' && mission.kind === 'make') {
      const onTheWay = Object.values(truck).reduce((a, b) => a + (b ?? 0), 0) + Object.values(held).reduce((a, b) => a + (b ?? 0), 0)
      if (mission.target - mission.delivered - onTheWay > 0) {
        nearest
          .filter((n) => n.dist < Infinity)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 2)
          .forEach((n) => show.add(n.color))
      }
    }

    ROCK_COLOR_ORDER.forEach((color, i) => {
      const g = arrows.current[i]
      if (!g) return
      g.visible = false
      if (!v || !show.has(color) || vehicle === 'crane') return
      const { dist: best, at } = nearest[i]
      if (best === Infinity || best < ARRIVED_DISTANCE) return
      target.copy(at)

      const yaw = Math.atan2(target.x - v.position.x, target.z - v.position.z)
      const radius = RING_RADIUS[vehicle] * (vehicle === 'excavator' ? excavatorSensors.scale : 1)
      const bob = Math.sin(clock.elapsedTime * 4 + i) * 0.1
      g.visible = true
      g.position.set(v.position.x + Math.sin(yaw) * radius, v.position.y + 0.4 + bob, v.position.z + Math.cos(yaw) * radius)
      g.rotation.y = yaw
    })
  })

  return (
    <>
      {ROCK_COLOR_ORDER.map((color, i) => (
        <group key={color} ref={(el) => void (arrows.current[i] = el)} visible={false} scale={0.8}>
          {/* 後ろ上のカメラから形が見やすいよう、矢印の先を少し持ち上げる */}
          <group rotation-x={-0.35}>
            <mesh geometry={geometry} material={materials[color].edge} scale={[1.2, 1, 1.16]} position-y={-0.02} renderOrder={10} />
            <mesh geometry={geometry} material={materials[color].fill} renderOrder={11} />
          </group>
        </group>
      ))}
    </>
  )
}
