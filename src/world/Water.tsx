import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BRIDGE_WIDTH, BRIDGES, LAKES, RIVER, RIVER_WIDTH, bridgePose } from './waterLayout'

const waterMaterial = new THREE.MeshStandardMaterial({ color: '#3f9bd6', roughness: 0.15, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 })
const iceMaterial = new THREE.MeshStandardMaterial({ color: '#cdeaf7', roughness: 0.1, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -2 })
const bankMaterial = new THREE.MeshStandardMaterial({ color: '#7a6a4f', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })
const sandBankMaterial = new THREE.MeshStandardMaterial({ color: '#d9bf86', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })
const snowBankMaterial = new THREE.MeshStandardMaterial({ color: '#f6f9fb', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })
const woodMaterial = new THREE.MeshStandardMaterial({ color: '#9a6a3c', roughness: 0.9 })
const darkWoodMaterial = new THREE.MeshStandardMaterial({ color: '#6b4626', roughness: 0.9 })

/** 折れ線にそった帯（川の水面・川岸）。y の高さで地面の上に置く */
function ribbon(points: ReadonlyArray<readonly [number, number]>, width: number, y: number) {
  const pos: number[] = []
  const idx: number[] = []
  points.forEach(([x, z], i) => {
    const [px, pz] = points[Math.max(0, i - 1)]
    const [nx, nz] = points[Math.min(points.length - 1, i + 1)]
    const dx = nx - px
    const dz = nz - pz
    const len = Math.hypot(dx, dz)
    // 流れに直角な向き（左右）
    const ox = (dz / len) * (width / 2)
    const oz = (-dx / len) * (width / 2)
    pos.push(x + ox, y, z + oz, x - ox, y, z - oz)
    if (i > 0) {
      const a = (i - 1) * 2
      // 上から見て反時計回り（上向きの面）になる順
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** 木の橋（川の流れに直角に渡す）。手すりつき */
function Bridge({ segment, t }: { segment: number; t: number }) {
  const p = bridgePose({ segment, t })
  const span = RIVER_WIDTH + 5
  return (
    <group position={[p.x, 0, p.z]} rotation-y={p.flow}>
      <mesh position-y={0.06} material={woodMaterial} receiveShadow>
        <boxGeometry args={[span, 0.12, BRIDGE_WIDTH]} />
      </mesh>
      {/* 板の継ぎ目 */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-span / 2 + (i + 0.5) * (span / 6), 0.125, 0]} material={darkWoodMaterial}>
          <boxGeometry args={[0.08, 0.02, BRIDGE_WIDTH]} />
        </mesh>
      ))}
      {/* 手すり（柱とはり） */}
      {[BRIDGE_WIDTH / 2, -BRIDGE_WIDTH / 2].map((z) => (
        <group key={z}>
          <mesh position={[0, 0.9, z]} material={darkWoodMaterial} castShadow>
            <boxGeometry args={[span, 0.14, 0.14]} />
          </mesh>
          {[-span / 2, -span / 4, 0, span / 4, span / 2].map((x) => (
            <mesh key={x} position={[x, 0.5, z]} material={darkWoodMaterial}>
              <boxGeometry args={[0.18, 0.9, 0.18]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 池・川・橋の見た目（車両が入れないのは water.ts の障害物で） */
export function Water() {
  const river = useMemo(() => ribbon(RIVER, RIVER_WIDTH, 0.05), [])
  const riverBank = useMemo(() => ribbon(RIVER, RIVER_WIDTH + 4, 0.03), [])
  useEffect(
    () => () => {
      river.dispose()
      riverBank.dispose()
    },
    [river, riverBank],
  )

  return (
    <group>
      <mesh geometry={riverBank} material={bankMaterial} receiveShadow />
      <mesh geometry={river} material={waterMaterial} />
      {LAKES.map((l, i) => {
        const bank = l.frozen ? snowBankMaterial : i === 1 ? sandBankMaterial : bankMaterial
        return (
          <group key={i} position={[l.x, 0, l.z]}>
            <mesh position-y={0.03} rotation-x={-Math.PI / 2} material={bank} receiveShadow>
              <circleGeometry args={[l.r + 2.2, 40]} />
            </mesh>
            <mesh position-y={0.05} rotation-x={-Math.PI / 2} material={l.frozen ? iceMaterial : waterMaterial} receiveShadow={l.frozen}>
              <circleGeometry args={[l.r, 40]} />
            </mesh>
          </group>
        )
      })}
      {BRIDGES.map((b, i) => (
        <Bridge key={i} {...b} />
      ))}
    </group>
  )
}
