import { forwardRef } from 'react'
import type * as THREE from 'three'
import { chrome, darkSteel } from '../../shared/materials'

/**
 * 油圧ブレーカー（バケットのかわりにアームの先に付ける）。原点はアーム先端のピン、+Z がのみ（チゼル）の向き。
 * のみ（chisel）は叩くときに前後へ振動させるので ref で受け取る。
 */
export const BREAKER_TIP: readonly [number, number, number] = [0, 0, 2.1]

export const BreakerModel = forwardRef<THREE.Group, { paint: THREE.Material }>(function BreakerModel({ paint }, chisel) {
  return (
    <group>
      {/* 取り付け金具 */}
      <mesh position={[0, 0, 0.12]} material={darkSteel}>
        <boxGeometry args={[0.6, 0.5, 0.45]} />
      </mesh>
      {/* 本体（シリンダーの入った箱） */}
      <mesh position={[0, 0, 0.78]} material={paint} castShadow>
        <boxGeometry args={[0.5, 0.5, 1.05]} />
      </mesh>
      <mesh position={[0, 0.27, 0.78]} material={darkSteel}>
        <boxGeometry args={[0.3, 0.06, 0.8]} />
      </mesh>
      {/* のみ（先がとがった棒） */}
      <group ref={chisel}>
        <mesh position={[0, 0, 1.55]} rotation-x={Math.PI / 2} material={chrome}>
          <cylinderGeometry args={[0.1, 0.1, 0.55, 10]} />
        </mesh>
        <mesh position={[0, 0, 1.94]} rotation-x={Math.PI / 2} material={chrome}>
          <coneGeometry args={[0.1, 0.3, 10]} />
        </mesh>
      </group>
    </group>
  )
})
