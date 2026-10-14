import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ORES, oreById, type OreId } from '../cargo/ores/oreTypes'
import { heightAt } from '../world/terrain'

/**
 * 掘ったときの演出。どこからでも digEffects.dust(...) / digEffects.ore(...) で呼べる。
 * 決まった数の部品を使い回す（遊んでいる最中に新しく作らない）。
 */
interface Particle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  age: number
  life: number
}
interface Gem {
  ore: OreId
  pos: THREE.Vector3
  age: number
}

const DUST_MAX = 80
/** ふるいから落ちる小石 */
const PEBBLE_MAX = 70
/** 小石が地面に落ちてから消えるまで [s] */
const PEBBLE_REST = 3
const GEM_MAX = 6
const GEM_LIFE = 1.8

const queue = { dust: [] as THREE.Vector3[], gems: [] as { ore: OreId; pos: THREE.Vector3 }[], pebbles: [] as { pos: THREE.Vector3; count: number }[] }

export const digEffects = {
  /** 土ぼこり（ブロックを崩したとき） */
  dust(x: number, y: number, z: number) {
    queue.dust.push(new THREE.Vector3(x, y, z))
  },
  /** 小石がぱらぱら落ちて、地面に少しの間たまる（スケルトンバケットでふるったとき） */
  pebbles(x: number, y: number, z: number, count: number) {
    queue.pebbles.push({ pos: new THREE.Vector3(x, y, z), count })
  },
  /** 鉱石がきらきら浮かび上がる（見つけたとき） */
  ore(ore: OreId, x: number, y: number, z: number) {
    queue.gems.push({ ore, pos: new THREE.Vector3(x, y, z) })
  },
}

const dummy = new THREE.Object3D()

export function DigEffects() {
  const dustMesh = useRef<THREE.InstancedMesh>(null)
  const pebbleMesh = useRef<THREE.InstancedMesh>(null)
  const pebbles = useRef<(Particle & { rest: number; size: number })[]>([])
  const gemRefs = useRef<(THREE.Mesh | null)[]>([])
  const particles = useRef<Particle[]>([])
  const gems = useRef<(Gem | null)[]>(Array(GEM_MAX).fill(null))

  const dustGeometry = useMemo(() => new THREE.BoxGeometry(0.22, 0.22, 0.22), [])
  const dustMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a7048', roughness: 1 }), [])
  const pebbleGeometry = useMemo(() => new THREE.DodecahedronGeometry(0.07, 0), [])
  const pebbleMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a19f98', roughness: 1, flatShading: true }), [])
  const gemGeometry = useMemo(() => new THREE.OctahedronGeometry(0.45, 0), [])
  const gemMaterials = useMemo(
    () =>
      Object.fromEntries(
        ORES.map((o) => [
          o.id,
          new THREE.MeshStandardMaterial({
            color: o.color,
            emissive: o.color,
            emissiveIntensity: 0.25 + o.glow,
            roughness: 0.25,
            metalness: 0.3,
            flatShading: true,
          }),
        ]),
      ) as Record<OreId, THREE.MeshStandardMaterial>,
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)

    // --- 土ぼこり ---
    for (const p of queue.dust.splice(0)) {
      for (let i = 0; i < 10; i++) {
        if (particles.current.length >= DUST_MAX) particles.current.shift()
        particles.current.push({
          pos: p.clone(),
          vel: new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3),
          age: 0,
          life: 0.6 + Math.random() * 0.5,
        })
      }
    }
    const mesh = dustMesh.current
    if (mesh) {
      particles.current = particles.current.filter((p) => (p.age += dt) < p.life)
      particles.current.forEach((p, i) => {
        p.vel.y -= 9.8 * dt
        p.pos.addScaledVector(p.vel, dt)
        dummy.position.copy(p.pos)
        dummy.rotation.set(p.age * 5, p.age * 3, 0)
        dummy.scale.setScalar(1 - p.age / p.life)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.count = particles.current.length
      mesh.instanceMatrix.needsUpdate = true
    }

    // --- ふるいから落ちる小石（地面で少し止まってから消える） ---
    for (const p of queue.pebbles.splice(0)) {
      for (let i = 0; i < p.count; i++) {
        if (pebbles.current.length >= PEBBLE_MAX) pebbles.current.shift()
        pebbles.current.push({
          pos: p.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.9)),
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, -0.5 - Math.random(), (Math.random() - 0.5) * 0.8),
          age: 0,
          life: 0,
          rest: 0,
          size: 0.7 + Math.random() * 0.8,
        })
      }
    }
    const pm = pebbleMesh.current
    if (pm) {
      pebbles.current = pebbles.current.filter((p) => p.rest < PEBBLE_REST)
      pebbles.current.forEach((p, i) => {
        p.age += dt
        const ground = heightAt(p.pos.x, p.pos.z) + 0.05
        if (p.pos.y > ground) {
          p.vel.y -= 9.8 * dt
          p.pos.addScaledVector(p.vel, dt)
          if (p.pos.y < ground) p.pos.y = ground
        } else {
          p.rest += dt
        }
        dummy.position.copy(p.pos)
        dummy.rotation.set(p.size * 7, p.size * 11, 0)
        dummy.scale.setScalar(p.size * Math.min(1, (PEBBLE_REST - p.rest) / 0.6))
        dummy.updateMatrix()
        pm.setMatrixAt(i, dummy.matrix)
      })
      pm.count = pebbles.current.length
      pm.instanceMatrix.needsUpdate = true
    }

    // --- 鉱石 ---
    for (const g of queue.gems.splice(0)) {
      const slot = gems.current.findIndex((x) => x === null)
      gems.current[slot >= 0 ? slot : 0] = { ore: g.ore, pos: g.pos, age: 0 }
    }
    gems.current.forEach((g, i) => {
      const m = gemRefs.current[i]
      if (!m) return
      if (!g) {
        m.visible = false
        return
      }
      g.age += dt
      if (g.age > GEM_LIFE) {
        gems.current[i] = null
        m.visible = false
        return
      }
      const k = g.age / GEM_LIFE
      m.visible = true
      m.material = gemMaterials[g.ore]
      m.position.set(g.pos.x, g.pos.y + 0.5 + Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5) * 2.5, g.pos.z)
      m.rotation.set(0, g.age * 6, 0)
      // ぽんと大きくなって、最後に小さくなって消える
      const scale = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1
      m.scale.setScalar(scale * (oreById(g.ore).stars >= 4 ? 1.4 : 1))
    })
  })

  return (
    <>
      <instancedMesh ref={dustMesh} args={[dustGeometry, dustMaterial, DUST_MAX]} frustumCulled={false} />
      <instancedMesh ref={pebbleMesh} args={[pebbleGeometry, pebbleMaterial, PEBBLE_MAX]} frustumCulled={false} />
      {Array.from({ length: GEM_MAX }, (_, i) => (
        <mesh key={i} ref={(el) => void (gemRefs.current[i] = el)} geometry={gemGeometry} visible={false} renderOrder={5} />
      ))}
    </>
  )
}
