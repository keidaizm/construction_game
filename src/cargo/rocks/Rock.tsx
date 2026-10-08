import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ConvexHullCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { getRockGeometry } from './rockGeometry'
import { rockRegistry, type RockEntry } from './rockRegistry'
import { ROCK_COLORS, ROCK_KINDS, type RockColor, type RockKind } from './rockTypes'

const materials = new Map<string, THREE.MeshStandardMaterial>()
function rockMaterial(color: string, shiny = false) {
  let m = materials.get(color)
  if (!m) {
    m = shiny
      ? new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.8, emissive: color, emissiveIntensity: 0.35, flatShading: true })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })
    materials.set(color, m)
  }
  return m
}

interface RockProps {
  id: number
  kind: RockKind
  color: RockColor
  /** 形のパターン番号 */
  variant: number
  position: readonly [number, number, number]
  /** 土の山から出てくる用の控えの岩（はじめは見えない所で止まっている） */
  pooled?: boolean
}

/** 物理演算で動く岩 1 個 */
export function Rock({ id, kind, color, variant, position, pooled = false }: RockProps) {
  const body = useRef<RapierRigidBody>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const cfg = ROCK_KINDS[kind]
  const geometry = getRockGeometry(kind, variant)
  const hull = useMemo(() => geometry.attributes.position.array as Float32Array, [geometry])
  const shades = ROCK_COLORS[color].shades
  const material = rockMaterial(shades[(id * 7 + variant) % shades.length], color === 'gold')

  useEffect(() => {
    if (!body.current || !mesh.current) return
    const entry: RockEntry = {
      id,
      kind,
      color,
      radius: cfg.radius,
      body: body.current,
      mesh: mesh.current,
      home: position,
      state: pooled ? 'pooled' : 'free',
      grabCooldownUntil: 0,
      batchId: 0,
      pooled,
    }
    rockRegistry.add(entry)
    return () => rockRegistry.remove(entry)
    // 位置は初期値としてのみ使う
  }, [id, kind, color])

  return (
    <RigidBody
      ref={body}
      position={[...position]}
      rotation={[0, id * 1.3, 0]}
      type={pooled ? 'kinematicPosition' : 'dynamic'}
      colliders={false}
      linearDamping={0.2}
      angularDamping={1.2}
      ccd
    >
      <ConvexHullCollider args={[hull]} density={cfg.density} friction={1.1} restitution={0.05} />
      <mesh ref={mesh} geometry={geometry} material={material} castShadow receiveShadow />
    </RigidBody>
  )
}
