import { forwardRef } from 'react'
import type * as THREE from 'three'
import { darkSteel } from '../../shared/materials'
import type { TruckGeometry } from '../dumpTruckConfig'

/**
 * 荷台の見た目。原点は後端のヒンジ、+Z 方向へ bedLength 伸びる。
 * 後ろのあおり（テールゲート）は ref の Group で、上端を軸にぶら下がる。
 */
export const BedModel = forwardRef<THREE.Group, { paint: THREE.Material; geometry: TruckGeometry }>(function BedModel({ paint, geometry: G }, tailgateRef) {
  const { bedLength: L, bedWidth: W, bedFloorThickness: F, bedWallHeight: H, bedWallThickness: T } = G
  return (
    <group>
      {/* 床と下の補強 */}
      <mesh position={[0, F / 2, L / 2]} material={paint}>
        <boxGeometry args={[W, F, L]} />
      </mesh>
      <mesh position={[0, -0.12, L / 2]} material={darkSteel}>
        <boxGeometry args={[1.1, 0.24, L - 0.2]} />
      </mesh>
      {/* 左右のあおり */}
      {[W / 2 - T / 2, -(W / 2 - T / 2)].map((x) => (
        <mesh key={x} position={[x, F + H / 2, L / 2]} material={paint}>
          <boxGeometry args={[T, H, L]} />
        </mesh>
      ))}
      {/* 前の壁（少し高い）と、キャブを守るひさし */}
      <mesh position={[0, F + 0.45, L - T / 2]} material={paint}>
        <boxGeometry args={[W, 0.9, T]} />
      </mesh>
      <mesh position={[0, F + 0.88, L + 0.3]} material={paint}>
        <boxGeometry args={[W, 0.06, 0.6]} />
      </mesh>
      {/* 後ろのあおり（上端のヒンジでぶら下がる） */}
      <group ref={tailgateRef} position={[0, F + H, 0]}>
        <mesh position={[0, -H / 2, T / 2]} material={paint}>
          <boxGeometry args={[W, H, T]} />
        </mesh>
      </group>
    </group>
  )
})
