import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { seededRandom } from './textures'
import { FIELD, LANDMARKS, STATIC_TREES, type Prop, type TreeKind } from './fieldLayout'
import { FOLIAGE, trunkGeometry, trunkMaterial } from './treeModels'
import { ROCK_SITES } from '../cargo/rocks/rockSites'
import { BIOME_INFO, biomeAt, type Biome } from './biomes'
import { heightAt } from './terrain'

const dummy = new THREE.Object3D()

/** 遠くの山の色（その方角の地帯に合わせる：北は雪山、東は緑の山…） */
function hillColor(x: number, z: number, t: number) {
  const c = new THREE.Color(BIOME_INFO[biomeAt(x, z)].ground)
  return c.multiplyScalar(0.78 + t * 0.15)
}

/** フィールドを囲む遠くの山。フラットシェーディングで軽く。 */
function Hills() {
  const hills = useMemo(() => {
    const rand = seededRandom(3)
    const n = 22
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rand() * 0.2
      const r = FIELD.driveLimit + 45 + rand() * 30
      return {
        position: [Math.cos(a) * r, 0, Math.sin(a) * r] as const,
        scale: [28 + rand() * 24, 16 + rand() * 26, 28 + rand() * 24] as const,
        color: hillColor(Math.cos(a) * r, Math.sin(a) * r, rand()),
      }
    })
  }, [])
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} position={h.position} scale={h.scale}>
          <coneGeometry args={[1, 1, 7]} />
          <meshStandardMaterial color={h.color} flatShading roughness={1} />
        </mesh>
      ))}
    </>
  )
}

/**
 * 地面に散らばる砂利（飾り。物理判定なし）。1 回の描画でまとめて描く。
 * すくえる岩と見分けがつくよう、小さく・岩置き場の周りには置かない。
 */
const PEBBLE_COLORS: Record<Biome, string> = { base: '#9c8468', snow: '#9aa3ad', forest: '#7c7a6a', desert: '#b8976a', rocky: '#77716b' }
const color = new THREE.Color()

function Pebbles({ count = 700 }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const rand = seededRandom(11)
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2
      const r = 6 + Math.sqrt(rand()) * (FIELD.driveLimit - 6)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const nearSite = ROCK_SITES.some((s) => Math.hypot(x - s.center[0], z - s.center[1]) < 6)
      dummy.position.set(x, nearSite ? -5 : heightAt(x, z) + 0.02, z) // 岩置き場の周りは地面の下へ隠す
      dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3)
      dummy.scale.setScalar(0.04 + rand() * 0.07)
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
      ref.current!.setColorAt(i, color.set(PEBBLE_COLORS[biomeAt(x, z)]))
    }
    ref.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [count])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffffff" flatShading roughness={1} />
    </instancedMesh>
  )
}

/** 同じ形を多数並べる（1 回の描画でまとめて描く） */
function Instances({
  props,
  geometry,
  material,
  y,
  scale,
  castShadow = false,
  colorOf,
}: {
  props: readonly Prop[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  y: (p: Prop) => number
  scale: (p: Prop) => readonly [number, number, number]
  castShadow?: boolean
  /** 1 こずつ色を変えるとき（material の色は白にしておく） */
  colorOf?: (p: Prop) => string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    props.forEach((p, i) => {
      dummy.position.set(p.x, y(p), p.z)
      dummy.rotation.set(0, p.rotation, 0)
      dummy.scale.set(...scale(p))
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
      if (colorOf) ref.current!.setColorAt(i, color.set(colorOf(p)))
    })
    ref.current!.instanceMatrix.needsUpdate = true
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
  }, [props, y, scale, colorOf])
  return <instancedMesh ref={ref} args={[geometry, material, props.length]} castShadow={castShadow} />
}

const uniform = (p: Prop) => [p.scale, p.scale, p.scale] as const
/** 木の根元は地面の高さに（丘の斜面では少し埋めて、浮いて見えないように） */
const atGround = (p: Prop) => heightAt(p.x, p.z) - 0.25

/** 倒れない木（基地のまわり・サボテン・ヤシ）。車両がぶつかると止まる。倒せる木は TreeField */
function Trees() {
  const trunks = useMemo(() => STATIC_TREES.filter((t) => t.kind !== 'cactus' && t.kind !== 'palm'), [])
  const byKind = useMemo(() => (Object.keys(FOLIAGE) as TreeKind[]).map((kind) => [kind, STATIC_TREES.filter((t) => t.kind === kind)] as const), [])
  return (
    <>
      <Instances props={trunks} geometry={trunkGeometry} material={trunkMaterial} y={atGround} scale={uniform} />
      {byKind.flatMap(([kind, props]) =>
        props.length === 0
          ? []
          : FOLIAGE[kind].map((f, i) => (
              <Instances key={`${kind}-${i}`} props={props} geometry={f.geometry} material={f.material} y={atGround} scale={uniform} castShadow />
            )),
      )}
    </>
  )
}

/** 三角コーン。ダンプの初期位置から「おきば」へまっすぐ続く道の両側に並べる */
const CONE_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [7.4, 10], [7.4, 15], [7.4, 20], [7.4, 25],
  [1.8, 17], [1.8, 21], [1.8, 25],
  [-6, 10], [-8, 14], [-10, 18], [0, -12], [4, -12], [-4, -12],
]

/** 三角コーンの描画。走ったときに動いている感覚も分かる。 */
function TrafficCones() {
  const cones = useRef<THREE.InstancedMesh>(null)
  const bases = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    dummy.rotation.set(0, 0, 0)
    dummy.scale.setScalar(1)
    CONE_POSITIONS.forEach(([x, z], i) => {
      dummy.position.set(x, 0.4, z)
      dummy.updateMatrix()
      cones.current!.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, 0.03, z)
      dummy.updateMatrix()
      bases.current!.setMatrixAt(i, dummy.matrix)
    })
    cones.current!.instanceMatrix.needsUpdate = true
    bases.current!.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <>
      <instancedMesh ref={cones} args={[undefined, undefined, CONE_POSITIONS.length]} castShadow>
        <coneGeometry args={[0.25, 0.8, 12]} />
        <meshStandardMaterial color="#ff6a13" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={bases} args={[undefined, undefined, CONE_POSITIONS.length]}>
        <boxGeometry args={[0.6, 0.06, 0.6]} />
        <meshStandardMaterial color="#222" />
      </instancedMesh>
    </>
  )
}

/** 現場事務所 */
function SiteHut() {
  return (
    <group position={[LANDMARKS.hut.x, 0, LANDMARKS.hut.z]} rotation-y={0.6}>
      <mesh position-y={1.3} castShadow>
        <boxGeometry args={[6, 2.6, 2.6]} />
        <meshStandardMaterial color="#e8e4da" roughness={0.8} />
      </mesh>
      <mesh position-y={2.68}>
        <boxGeometry args={[6.3, 0.16, 2.9]} />
        <meshStandardMaterial color="#3a6ea5" />
      </mesh>
      <mesh position={[0.8, 1.5, 1.31]}>
        <boxGeometry args={[1.6, 0.9, 0.02]} />
        <meshStandardMaterial color="#7fb6d9" roughness={0.2} />
      </mesh>
      <mesh position={[-1.8, 1.0, 1.31]}>
        <boxGeometry args={[0.9, 2.0, 0.02]} />
        <meshStandardMaterial color="#6b5a4a" />
      </mesh>
    </group>
  )
}

export function Environment() {
  return (
    <>
      <Hills />
      <Pebbles />
      <Trees />
      <TrafficCones />
      <SiteHut />
    </>
  )
}
