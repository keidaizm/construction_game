import { useMemo } from 'react'
import * as THREE from 'three'
import { Beam } from '../../shared/Beam'
import { darkSteel } from '../../shared/materials'
import { BUCKET_PROFILE as PROFILE, BUCKET_TIP, BUCKET_WIDTH as WIDTH } from '../bucketShape'

/** accent：爪とピンの色（レベルが上がると変わる） */
export function BucketModel({ paint, accent = darkSteel }: { paint: THREE.Material; accent?: THREE.Material }) {
  const sideGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    PROFILE.forEach(([y, z], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)))
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false })
    g.rotateY(-Math.PI / 2) // 形の x → ローカル z
    return g
  }, [])

  return (
    <group>
      {/* 外殻 */}
      {PROFILE.slice(1).map((p, i) => (
        <Beam key={i} from={PROFILE[i]} to={p} width={WIDTH} height={0.06} material={paint} />
      ))}
      {/* 側板 */}
      <mesh geometry={sideGeometry} position-x={WIDTH / 2 + 0.025} material={paint} />
      <mesh geometry={sideGeometry} position-x={-WIDTH / 2 + 0.025} material={paint} />
      {/* 爪 */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((x) => (
        <Beam key={x} x={x} from={[-0.1, 1.18]} to={[BUCKET_TIP[1], BUCKET_TIP[2]]} width={0.1} height={0.08} material={accent} />
      ))}
      {/* ピンのボス */}
      <mesh rotation-z={Math.PI / 2} material={accent}>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 10]} />
      </mesh>
    </group>
  )
}
