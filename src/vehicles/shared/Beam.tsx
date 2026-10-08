import { useMemo } from 'react'
import * as THREE from 'three'

type Vec2 = readonly [y: number, z: number]

interface BeamProps {
  /** YZ 平面上の始点・終点（側面から見た形） */
  from: Vec2
  to: Vec2
  width: number
  height: number
  x?: number
  material: THREE.Material
}

/** 2 点間をつなぐ角材。ブーム・アーム・バケットの形を線で描くように作れる。 */
export function Beam({ from, to, width, height, x = 0, material }: BeamProps) {
  const { position, length, angle } = useMemo(() => {
    const dy = to[0] - from[0]
    const dz = to[1] - from[1]
    return {
      position: [x, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2] as const,
      length: Math.hypot(dy, dz),
      angle: -Math.atan2(dy, dz),
    }
  }, [from, to, x])

  return (
    <mesh position={position} rotation-x={angle} material={material}>
      <boxGeometry args={[width, height, length]} />
    </mesh>
  )
}
