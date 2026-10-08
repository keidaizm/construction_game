import type { RefObject } from 'react'
import type * as THREE from 'three'
import { darkSteel } from '../../shared/materials'

/**
 * グラップル（大きなはさみで木材をつかむアタッチメント）。原点はアーム先端のピン、+Z が下向き（いつも真下にぶら下がる）。
 * 2 本のつめ（jaw）はローカル X 軸のまわりに開く。つかんだ木材はローカル X（左右）向きに持つ。
 */
export const GRAPPLE_TIP: readonly [number, number, number] = [0, 0, 1.95]
/** つかんだ木材の中心（ローカル） */
export const GRAPPLE_HOLD: readonly [number, number, number] = [0, 0, 1.5]
/** つめの付け根の、中心からのずれ（ローカル Y）と高さ（ローカル Z） */
export const JAW_PIVOT = { y: 0.22, z: 0.95 }

function Jaw({ side, jawRef, paint }: { side: 1 | -1; jawRef: RefObject<THREE.Group | null>; paint: THREE.Material }) {
  return (
    <group position={[0, JAW_PIVOT.y * side, JAW_PIVOT.z]}>
      <group ref={jawRef}>
        {/* つめ：外へ出てから、先が内がわへ曲がる（2 本ずつ並べて、はさみらしく） */}
        {[-0.32, 0.32].map((x) => (
          <group key={x} position-x={x}>
            <mesh position={[0, 0.18 * side, 0.32]} rotation-x={-0.5 * side} material={paint} castShadow>
              <boxGeometry args={[0.14, 0.12, 0.7]} />
            </mesh>
            <mesh position={[0, 0.22 * side, 0.82]} rotation-x={0.45 * side} material={paint} castShadow>
              <boxGeometry args={[0.14, 0.12, 0.55]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.05 * side, 0.08]} material={darkSteel}>
          <boxGeometry args={[0.8, 0.12, 0.16]} />
        </mesh>
      </group>
    </group>
  )
}

export function GrappleModel({ paint, jawA, jawB }: { paint: THREE.Material; jawA: RefObject<THREE.Group | null>; jawB: RefObject<THREE.Group | null> }) {
  return (
    <group>
      {/* 取り付け金具とまわる所（ロテーター） */}
      <mesh position={[0, 0, 0.12]} material={darkSteel}>
        <boxGeometry args={[0.5, 0.45, 0.3]} />
      </mesh>
      <mesh position={[0, 0, 0.38]} rotation-x={Math.PI / 2} material={darkSteel}>
        <cylinderGeometry args={[0.24, 0.24, 0.22, 12]} />
      </mesh>
      {/* 本体 */}
      <mesh position={[0, 0, 0.72]} material={paint} castShadow>
        <boxGeometry args={[0.95, 0.5, 0.45]} />
      </mesh>
      <Jaw side={1} jawRef={jawA} paint={paint} />
      <Jaw side={-1} jawRef={jawB} paint={paint} />
    </group>
  )
}
