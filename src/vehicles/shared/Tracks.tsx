import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { blackRubber, darkSteel } from './materials'

export interface TrackTravel {
  /** 履帯が送られた距離 [m]。前進で増える */
  left: number
  right: number
}

/** 履帯の大きさ（ショベル・ブルドーザーなどで共通に使う） */
export interface TrackSize {
  /** 左右の履帯の中心の X 位置 */
  gauge: number
  /** 直線部の長さ */
  length: number
  /** 前後の丸みの半径 */
  radius: number
  /** 履帯の幅 */
  width: number
}

const SHOE_PITCH = 0.24
const dummy = new THREE.Object3D()

/** 履帯ループ（側面から見て陸上トラック形）上の位置 s に履板を置く */
function placeShoe(s: number, L: number, R: number, perimeter: number) {
  s = ((s % perimeter) + perimeter) % perimeter
  let y: number
  let z: number
  let theta: number // 外向き法線の角度（+Z から +Y 方向へ）
  if (s < L) {
    // 上側：後ろ → 前
    z = -L / 2 + s
    y = 2 * R
    theta = Math.PI / 2
  } else if (s < L + Math.PI * R) {
    // 前の丸み：上 → 下
    theta = Math.PI / 2 - (s - L) / R
    z = L / 2 + R * Math.cos(theta)
    y = R + R * Math.sin(theta)
  } else if (s < 2 * L + Math.PI * R) {
    // 下側：前 → 後ろ（地面に接している）
    z = L / 2 - (s - L - Math.PI * R)
    y = 0
    theta = -Math.PI / 2
  } else {
    // 後ろの丸み：下 → 上
    theta = -Math.PI / 2 - (s - 2 * L - Math.PI * R) / R
    z = -L / 2 + R * Math.cos(theta)
    y = R + R * Math.sin(theta)
  }
  dummy.position.set(0, y, z)
  dummy.rotation.set(Math.PI / 2 - theta, 0, 0)
  dummy.updateMatrix()
}

function Track({ side, travel, size }: { side: 'left' | 'right'; travel: RefObject<TrackTravel>; size: TrackSize }) {
  const shoes = useRef<THREE.InstancedMesh>(null)
  const lastTravel = useRef(Number.NaN)
  const { length: L, radius: R, width, gauge } = size
  const { perimeter, count, spacing } = useMemo(() => {
    const perimeter = 2 * L + 2 * Math.PI * R
    const count = Math.round(perimeter / SHOE_PITCH)
    return { perimeter, count, spacing: perimeter / count } // 周長に均等に並ぶよう微調整
  }, [L, R])

  const layout = (offset: number) => {
    const mesh = shoes.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      placeShoe(i * spacing + offset, L, R, perimeter)
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => layout(0))

  useFrame(() => {
    const t = travel.current[side]
    if (t === lastTravel.current) return
    lastTravel.current = t
    layout(t)
  })

  // 車両ローカルは +X が左
  const x = side === 'left' ? gauge : -gauge

  return (
    <group position-x={x}>
      <instancedMesh ref={shoes} args={[undefined, undefined, count]} material={blackRubber}>
        <boxGeometry args={[width, 0.07, SHOE_PITCH * 0.8]} />
      </instancedMesh>
      {/* トラックフレーム */}
      <mesh position-y={R} material={darkSteel}>
        <boxGeometry args={[width * 0.8, 2 * R - 0.14, L]} />
      </mesh>
      {/* 起動輪・遊動輪 */}
      {[L / 2, -L / 2].map((z) => (
        <mesh key={z} position={[0, R, z]} rotation-z={Math.PI / 2} material={darkSteel}>
          <cylinderGeometry args={[R - 0.07, R - 0.07, width * 0.8, 14]} />
        </mesh>
      ))}
    </group>
  )
}

/** 左右の履帯（走行に合わせて履板が回る） */
export function TrackPair({ travel, size }: { travel: RefObject<TrackTravel>; size: TrackSize }) {
  return (
    <>
      <Track side="left" travel={travel} size={size} />
      <Track side="right" travel={travel} size={size} />
    </>
  )
}
