import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CRANE } from './craneConfig'
import { MARKER_DOTS, useCraneController } from './useCraneController'

const yellow = new THREE.MeshStandardMaterial({ color: '#f2b705', roughness: 0.6 })
const dark = new THREE.MeshStandardMaterial({ color: '#3b3d40', roughness: 0.7 })
const cabGlass = new THREE.MeshStandardMaterial({ color: '#7fb6d9', roughness: 0.2 })
const ropeMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.5 })
const hookMat = new THREE.MeshStandardMaterial({ color: '#d33', roughness: 0.4, metalness: 0.3 })
const markerMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })
const dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false })

const H = CRANE.towerHeight
const L = CRANE.jibLength

/** 塔の格子（すじかい）。四面に斜めの棒を並べる（1 回の描画でまとめて描く） */
function Lattice() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => {
    const list: Array<{ p: [number, number, number]; r: [number, number, number] }> = []
    for (let y = 1; y < H; y += 1.6) {
      for (const [x, z, ry] of [
        [0.72, 0, 0],
        [-0.72, 0, 0],
        [0, 0.72, Math.PI / 2],
        [0, -0.72, Math.PI / 2],
      ] as const) {
        list.push({ p: [x, y, z], r: [0, ry, (y / 1.6) % 2 < 1 ? 0.75 : -0.75] })
      }
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    items.forEach((it, i) => {
      dummy.position.set(...it.p)
      dummy.rotation.set(...it.r)
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, dark, items.length]}>
      <boxGeometry args={[0.08, 2.05, 0.08]} />
    </instancedMesh>
  )
}

/**
 * タワークレーン（基地の目印。Lv3 から乗れる）。
 *
 * Crane（根元）
 * ├─ 塔
 * └─ Slew（rotation.y：旋回）── 運転室・腕（ジブ）・うしろの腕とおもり
 *    └─ Trolley（position.z：フックを吊る台車）
 * ロープ・フック・真下の印は、揺れを付けるためワールドに直接置く（コントローラが位置を決める）。
 */
export function Crane({ anchorRef }: { anchorRef: RefObject<THREE.Object3D | null> }) {
  const slew = useRef<THREE.Group>(null)
  const trolley = useRef<THREE.Group>(null)
  const rope = useRef<THREE.Mesh>(null)
  const hook = useRef<THREE.Group>(null)
  const marker = useRef<THREE.Group>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const rig = useMemo(() => ({ slew, trolley, rope, hook, marker, dots, cameraAnchor: anchorRef }), [anchorRef])
  useCraneController(rig)

  return (
    <>
      <group position={[CRANE.x, 0, CRANE.z]}>
        <mesh position-y={0.4} material={dark} receiveShadow>
          <boxGeometry args={[4, 0.8, 4]} />
        </mesh>
        {/* 塔（4 本の柱＋すじかい） */}
        {[
          [0.7, 0.7],
          [-0.7, 0.7],
          [0.7, -0.7],
          [-0.7, -0.7],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, H / 2, z]} material={yellow} castShadow>
            <boxGeometry args={[0.22, H, 0.22]} />
          </mesh>
        ))}
        <Lattice />

        <group ref={slew} position-y={H}>
          <mesh position-y={0.25} material={dark}>
            <cylinderGeometry args={[1.1, 1.1, 0.5, 12]} />
          </mesh>
          {/* 運転室（腕の付け根の横） */}
          <group position={[1.2, 0.2, 0.6]}>
            <mesh position-y={0.9} material={yellow} castShadow>
              <boxGeometry args={[1.4, 1.6, 1.6]} />
            </mesh>
            <mesh position={[0, 1.1, 0.81]} material={cabGlass}>
              <boxGeometry args={[1.2, 0.9, 0.02]} />
            </mesh>
          </group>
          {/* 腕（ジブ）とうしろの腕・おもり */}
          <mesh position={[0, CRANE.jibY - H, L / 2]} material={yellow} castShadow>
            <boxGeometry args={[0.9, 0.9, L + 1]} />
          </mesh>
          <mesh position={[0, CRANE.jibY - H, -3.5]} material={yellow}>
            <boxGeometry args={[0.9, 0.7, 7]} />
          </mesh>
          <mesh position={[0, CRANE.jibY - H - 0.5, -6.2]} material={dark} castShadow>
            <boxGeometry args={[1.8, 1.8, 1.8]} />
          </mesh>
          {/* てっぺんの三角（塔頂） */}
          <mesh position={[0, CRANE.jibY - H + 2.2, 0]} material={yellow}>
            <coneGeometry args={[0.7, 3.6, 4]} />
          </mesh>
          <group ref={trolley} position={[0, CRANE.jibY - H - 0.55, CRANE.trolley.initial]}>
            <mesh material={dark}>
              <boxGeometry args={[1.1, 0.35, 1.2]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* カメラが追いかける点（コントローラが動かす） */}
      <object3D ref={anchorRef} />
      {/* ロープ（高さ 1 の円柱をのばす）とフック */}
      <mesh ref={rope} material={ropeMat}>
        <cylinderGeometry args={[0.045, 0.045, 1, 6]} />
      </mesh>
      <group ref={hook}>
        <mesh position-y={-0.25} material={yellow} castShadow>
          <boxGeometry args={[0.7, 0.5, 0.45]} />
        </mesh>
        <mesh position-y={-0.62} rotation-x={Math.PI / 2} material={hookMat}>
          <torusGeometry args={[0.16, 0.06, 6, 12, Math.PI * 1.4]} />
        </mesh>
      </group>

      {/* フックの真下の印（つかめると緑、つかんでいるとオレンジ） */}
      <group ref={marker} visible={false}>
        <mesh rotation-x={-Math.PI / 2} material={markerMat} renderOrder={5}>
          <ringGeometry args={[0.55, 0.85, 24]} />
        </mesh>
      </group>
      <instancedMesh ref={dots} args={[undefined, dotMat, MARKER_DOTS]} visible={false} renderOrder={5}>
        <sphereGeometry args={[0.07, 6, 4]} />
      </instancedMesh>
    </>
  )
}
