import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { chrome, darkSteel } from './materials'
import type { RigListener } from './rig'

interface Props {
  /** シリンダー根元の取付点（どの階層の Object3D でもよい） */
  start: RefObject<THREE.Object3D | null>
  /** ロッド先端の取付点 */
  end: RefObject<THREE.Object3D | null>
  barrelLength: number
  radius?: number
  /** 親コンポーネントが関節更新後にまとめて update() を呼ぶためのリスト */
  registry: RefObject<RigListener[]>
}

const UP = new THREE.Vector3(0, 1, 0)
const a = new THREE.Vector3()
const b = new THREE.Vector3()
const dir = new THREE.Vector3()

/**
 * 油圧シリンダー（見た目のみ）。
 * 2 つの取付点の間に毎フレーム張り直し、ロッドが伸び縮みして見える。
 */
export function HydraulicCylinder({ start, end, barrelLength, radius = 0.09, registry }: Props) {
  const group = useRef<THREE.Group>(null)
  const rod = useRef<THREE.Mesh>(null)

  useEffect(() => {
    const handle: RigListener = {
      update() {
        const g = group.current
        const s = start.current
        const e = end.current
        if (!g || !s || !e || !g.parent || !rod.current) return
        s.getWorldPosition(a)
        e.getWorldPosition(b)
        g.parent.worldToLocal(a)
        g.parent.worldToLocal(b)
        dir.subVectors(b, a)
        const length = dir.length()
        if (length < 1e-4) return
        g.position.copy(a)
        g.quaternion.setFromUnitVectors(UP, dir.divideScalar(length))
        rod.current.scale.y = length
        rod.current.position.y = length / 2
      },
    }
    const list = registry.current
    list.push(handle)
    return () => {
      list.splice(list.indexOf(handle), 1)
    }
  }, [start, end, registry])

  return (
    <group ref={group}>
      <mesh position-y={barrelLength / 2} material={darkSteel}>
        <cylinderGeometry args={[radius, radius, barrelLength, 10]} />
      </mesh>
      <mesh ref={rod} material={chrome}>
        <cylinderGeometry args={[radius * 0.55, radius * 0.55, 1, 8]} />
      </mesh>
    </group>
  )
}
