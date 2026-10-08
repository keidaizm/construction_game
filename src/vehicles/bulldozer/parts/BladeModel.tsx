import type * as THREE from 'three'
import { darkSteel } from '../../shared/materials'
import { BULLDOZER } from '../bulldozerConfig'

const { bladeWidth: W, bladeHeight: H } = BULLDOZER.geometry

/**
 * 排土板（ブレード）の見た目。原点は排土板の下の真ん中（刃先）。
 * 少し前に反った板を 3 枚の板でつくる。
 */
export function BladeModel({ paint }: { paint: THREE.Material }) {
  return (
    <group>
      {/* 下・中・上の板（上ほど前に出て、反った形） */}
      <mesh position={[0, H * 0.17, 0]} rotation-x={0.25} material={paint}>
        <boxGeometry args={[W, H * 0.36, 0.12]} />
      </mesh>
      <mesh position={[0, H * 0.5, -0.03]} material={paint}>
        <boxGeometry args={[W, H * 0.36, 0.12]} />
      </mesh>
      <mesh position={[0, H * 0.83, 0.04]} rotation-x={-0.35} material={paint}>
        <boxGeometry args={[W, H * 0.36, 0.12]} />
      </mesh>
      {/* 両はしの板（少し前に出して、押している石が横からこぼれにくくする） */}
      {[W / 2, -W / 2].map((x) => (
        <mesh key={x} position={[x, H * 0.5, 0.1]} material={paint}>
          <boxGeometry args={[0.08, H, 0.4]} />
        </mesh>
      ))}
      {/* 刃先 */}
      <mesh position={[0, 0.03, 0.04]} material={darkSteel}>
        <boxGeometry args={[W, 0.06, 0.14]} />
      </mesh>
    </group>
  )
}
