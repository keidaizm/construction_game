import { forwardRef } from 'react'
import type * as THREE from 'three'
import { blackRubber, chrome, darkSteel } from '../../shared/materials'

/**
 * タイヤ 1 本。ref の Group の rotation.x を回すと転がって見える。
 * radius・width はダンプの大きさ（ふつう／重ダンプ）で変わる。big は重ダンプの黄色いホイール。
 */
export const Wheel = forwardRef<THREE.Group, { radius: number; width: number; side: 1 | -1; hub?: THREE.Material }>(function Wheel(
  { radius: R, width, side, hub = chrome },
  ref,
) {
  return (
    <group ref={ref}>
      <mesh rotation-z={Math.PI / 2} material={blackRubber}>
        <cylinderGeometry args={[R, R, width, 18]} />
      </mesh>
      <mesh position-x={side * (width / 2 + 0.01)} rotation-z={Math.PI / 2} material={hub}>
        <cylinderGeometry args={[R * 0.55, R * 0.55, 0.04, 12]} />
      </mesh>
      {/* 回っているのが分かる目印（ホイールナット） */}
      <mesh position={[side * (width / 2 + 0.035), R * 0.3, 0]} material={darkSteel}>
        <boxGeometry args={[0.04, R * 0.23, R * 0.23]} />
      </mesh>
    </group>
  )
})
