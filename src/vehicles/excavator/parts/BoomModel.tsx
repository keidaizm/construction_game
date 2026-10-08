import type * as THREE from 'three'
import { EXCAVATOR } from '../excavatorConfig'
import { Beam } from '../../shared/Beam'
import { darkSteel } from '../../shared/materials'

const { boomLength } = EXCAVATOR.geometry
const KNEE = [0.75, 2.0] as const

/** ブーム（くの字）。原点が根元ピン、+Z 方向の boomLength 先がアームピン。 */
export function BoomModel({ paint }: { paint: THREE.Material }) {
  return (
    <group>
      <Beam from={[0, 0]} to={KNEE} width={0.46} height={0.55} material={paint} />
      <Beam from={KNEE} to={[0, boomLength]} width={0.42} height={0.48} material={paint} />
      {/* ピンのボス */}
      {[0, boomLength].map((z) => (
        <mesh key={z} position-z={z} rotation-z={Math.PI / 2} material={darkSteel}>
          <cylinderGeometry args={[0.2, 0.2, 0.56, 12]} />
        </mesh>
      ))}
    </group>
  )
}
