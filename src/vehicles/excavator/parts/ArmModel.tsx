import type * as THREE from 'three'
import { EXCAVATOR } from '../excavatorConfig'
import { Beam } from '../../shared/Beam'
import { darkSteel } from '../../shared/materials'

const { armLength } = EXCAVATOR.geometry

/** アーム。原点がブーム先端のピン、+Z 方向の armLength 先がバケットピン。 */
export function ArmModel({ paint }: { paint: THREE.Material }) {
  return (
    <group>
      <Beam from={[0.3, -0.75]} to={[0.12, 0.6]} width={0.36} height={0.5} material={paint} />
      <Beam from={[0.12, 0.6]} to={[0, armLength]} width={0.32} height={0.36} material={paint} />
      <mesh position-z={armLength} rotation-z={Math.PI / 2} material={darkSteel}>
        <cylinderGeometry args={[0.14, 0.14, 0.4, 10]} />
      </mesh>
    </group>
  )
}
