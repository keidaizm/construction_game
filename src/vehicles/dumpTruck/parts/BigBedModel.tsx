import { forwardRef } from 'react'
import type * as THREE from 'three'
import { darkSteel } from '../../shared/materials'
import type { TruckGeometry } from '../dumpTruckConfig'

/**
 * 重ダンプの荷台：太いふちの付いた横の壁、高い前の壁と、運転席の上までのびるひさし、後ろはせり上がった口。
 * 原点は後端のヒンジ、+Z 方向へ bedLength 伸びる。後ろの口（tailgateRef）は上端を軸にぶら下がる
 * （当たり判定は、ふつうのダンプのあおりと同じ：荷台を上げると外れる）。
 */
export const BigBedModel = forwardRef<THREE.Group, { paint: THREE.Material; geometry: TruckGeometry }>(function BigBedModel({ paint, geometry: G }, tailgateRef) {
  const { bedLength: L, bedWidth: W, bedFloorThickness: F, bedWallHeight: H, bedWallThickness: T } = G
  const FRONT = 2.0
  return (
    <group>
      {/* 床と、下の太いはり */}
      <mesh position={[0, F / 2, L / 2]} material={paint}>
        <boxGeometry args={[W, F, L]} />
      </mesh>
      {/* （後輪に当たらないよう、内がわに寄せて薄く） */}
      {[0.38, -0.38].map((x) => (
        <mesh key={x} position={[x, -0.08, L / 2]} material={darkSteel}>
          <boxGeometry args={[0.22, 0.16, L - 0.3]} />
        </mesh>
      ))}
      {/* 左右の壁と、上の太いふち・たてのリブ */}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[side * (W / 2 - T / 2), F + H / 2, L / 2]} material={paint}>
            <boxGeometry args={[T, H, L]} />
          </mesh>
          <mesh position={[side * (W / 2 + 0.02), F + H + 0.05, L / 2]} material={paint} castShadow>
            <boxGeometry args={[0.22, 0.14, L + 0.05]} />
          </mesh>
          {[0.9, 2.1, 3.3, 4.5].map((z) => (
            <mesh key={z} position={[side * (W / 2 + 0.04), F + H / 2, z]} material={paint}>
              <boxGeometry args={[0.08, H, 0.12]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 前の高い壁と、運転席の上までのびるひさし */}
      <mesh position={[0, F + FRONT / 2, L - T / 2]} material={paint} castShadow>
        <boxGeometry args={[W, FRONT, T]} />
      </mesh>
      <mesh position={[0, F + FRONT, L + 0.95]} material={paint} castShadow>
        <boxGeometry args={[W + 0.2, 0.12, 2.0]} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * (W / 2 + 0.05), F + FRONT - 0.25, L + 0.95]} material={paint}>
          <boxGeometry args={[0.1, 0.5, 2.0]} />
        </mesh>
      ))}
      {/* 後ろの口（ななめにせり上がる。上端でぶら下がる） */}
      <group ref={tailgateRef} position={[0, F + H, 0]}>
        <mesh position={[0, -H / 2, 0.15]} rotation-x={-0.35} material={paint}>
          <boxGeometry args={[W, H + 0.1, T]} />
        </mesh>
      </group>
    </group>
  )
})
