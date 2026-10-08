import { isInWater, isOnBridge } from '../../world/waterLayout'
import { heightAt } from '../../world/terrain'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useGameStore } from '../../stores/gameStore'
import { seededRandom } from '../../world/textures'
import { Rock } from './Rock'
import { PickupMarkers } from './PickupMarkers'
import { rockRegistry, type RockEntry } from './rockRegistry'
import { ROCK_SITES, type RockSite } from './rockSites'
import { ROCK_COLORS, type RockColor, type RockKind } from './rockTypes'

/** これより外・地面の下に落ちた岩は元の場所に戻す */
const FIELD_LIMIT = 185

/**
 * 土の山を崩したときに出てくる岩の控え（色ごとの数）。
 * 遊んでいる最中に物理ボディを作ると重いので、はじめから作って遠くに止めておき、出すときに動かす。
 */
const POOL: ReadonlyArray<readonly [RockColor, number]> = [
  ['gray', 14],
  ['black', 8],
  ['red', 8],
  ['white', 8],
  ['gold', 1],
]
/** 控えの岩を止めておく場所（カメラに映らない遠く・地面の下） */
const parkAt = (i: number) => [400 + i * 3, -30, 400] as const

interface PlacedRock {
  id: number
  color: RockColor
  variant: number
  position: readonly [number, number, number]
  pooled?: boolean
}

/** 1 か所ぶんの岩を、下の段ほど広く・上の段ほど狭く積んで、小さな岩山にする */
function placeSite(site: RockSite, firstId: number, seed: number): PlacedRock[] {
  const rand = seededRandom(seed)
  const spread = site.spread * Math.sqrt(Math.max(1, site.count / 18))
  return Array.from({ length: site.count }, (_, i) => {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * spread
    const layer = Math.floor(i / 7)
    const shrink = Math.max(0.25, 1 - layer * 0.28)
    return {
      id: firstId + i,
      color: site.color,
      variant: firstId + i,
      position: [site.center[0] + Math.cos(a) * r * shrink, 0.3 + layer * 0.5, site.center[1] + Math.sin(a) * r * shrink] as const,
    }
  })
}

/** 岩置き場の目印：少し暗い土と、岩の色の旗（遠くからでも見えるように高く） */
function SiteMarker({ site }: { site: RockSite }) {
  const c = ROCK_COLORS[site.color]
  const spread = site.spread * Math.sqrt(Math.max(1, site.count / 18))
  return (
    <group position={[site.center[0], 0, site.center[1]]}>
      <mesh position-y={0.01} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[spread + 1.6, 28]} />
        <meshStandardMaterial color="#8f6d47" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <group position={[spread + 2.2, 0, 0]}>
        <mesh position-y={3} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 6, 8]} />
          <meshStandardMaterial color="#dddddd" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.75, 5.4, 0]} castShadow>
          <boxGeometry args={[1.5, 1, 0.05]} />
          <meshStandardMaterial color={c.icon} roughness={0.7} />
        </mesh>
        {/* 旗のふち（白い旗・黒い旗でも形が分かるように） */}
        <mesh position={[0.75, 5.4, -0.01]}>
          <boxGeometry args={[1.62, 1.12, 0.03]} />
          <meshStandardMaterial color={c.outline} roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * フィールドじゅうの岩置き場（rockSites.ts）と岩。
 * 「はじめから」で全部の岩を元の場所へ戻し、場外や地面の下に落ちた岩も戻す。
 */
export function RockField({ kind = 'medium' }: { kind?: RockKind }) {
  const { rapier } = useRapier()
  const resetToken = useGameStore((s) => s.resetToken)
  const checkTimer = useRef(0)

  const rocks = useMemo(() => {
    let nextId = 0
    const placed: PlacedRock[] = ROCK_SITES.flatMap((site, i) => {
      const list = placeSite(site, nextId, 42 + i * 101)
      nextId += site.count
      return list
    })
    let poolIndex = 0
    for (const [color, count] of POOL) {
      for (let i = 0; i < count; i++) {
        placed.push({ id: nextId, color, variant: nextId, position: parkAt(poolIndex++), pooled: true })
        nextId++
      }
    }
    return placed
  }, [])

  /** 岩を元に戻す（控えの岩は控えの場所へ） */
  const respawn = (rock: RockEntry) => {
    const b = rock.body
    if (rock.pooled) {
      b.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
      b.setTranslation({ x: rock.home[0], y: rock.home[1], z: rock.home[2] }, true)
      rock.mesh.scale.setScalar(1)
      rock.state = 'pooled'
      rock.batchId = 0
      return
    }
    b.setBodyType(rapier.RigidBodyType.Dynamic, true)
    b.setTranslation({ x: rock.home[0], y: rock.home[1], z: rock.home[2] }, true)
    b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
    b.setAngvel({ x: 0, y: 0, z: 0 }, true)
    rock.mesh.scale.setScalar(1)
    rock.state = 'free'
    rock.grabCooldownUntil = 0
    rock.batchId = 0
  }

  // 土の山から岩を出す関数を差し込む
  useEffect(() => {
    rockRegistry.spawn = (color, x, y, z) => {
      const rock = rockRegistry.rocks.find((r) => r.pooled && r.state === 'pooled' && r.color === color)
      if (!rock) return false
      const b = rock.body
      b.setBodyType(rapier.RigidBodyType.Dynamic, true)
      b.setTranslation({ x, y, z }, true)
      b.setRotation({ x: 0, y: Math.sin(x + z), z: 0, w: Math.cos(x + z) }, true)
      b.setLinvel({ x: 0, y: 1.5, z: 0 }, true) // ぽんと少し飛び出す
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
      rock.state = 'free'
      rock.batchId = 0
      rock.grabCooldownUntil = 0
      return true
    }
    rockRegistry.despawn = (rock) => respawn(rock)
    return () => {
      rockRegistry.spawn = null
      rockRegistry.despawn = null
    }
  }, [rapier])

  // 「はじめから」で岩も元に戻す
  const lastResetToken = useRef(resetToken)
  useEffect(() => {
    if (lastResetToken.current === resetToken) return
    lastResetToken.current = resetToken
    rockRegistry.rocks.forEach(respawn)
    // respawn は rapier だけを使う
  }, [resetToken])

  useFrame((_, dt) => {
    checkTimer.current += dt
    if (checkTimer.current < 0.5) return
    checkTimer.current = 0
    for (const rock of rockRegistry.rocks) {
      if (rock.state !== 'free') continue
      const p = rock.body.translation()
      // 場外・地面の下・水の中（車両が行けない所）に落ちた岩は置き場に戻す
      if (p.y < -2 || Math.abs(p.x) > FIELD_LIMIT || Math.abs(p.z) > FIELD_LIMIT || (isInWater(p.x, p.z) && !isOnBridge(p.x, p.z))) {
        respawn(rock)
        continue
      }
      // 丘の中にもぐりこんだ岩（中心が斜面より下）は、斜面の上へ出す（見えなくなって、すくえなくなるので）
      const ground = heightAt(p.x, p.z)
      if (ground > 0.05 && p.y < ground - 0.02) {
        rock.body.setTranslation({ x: p.x, y: ground + rock.radius + 0.1, z: p.z }, true)
        rock.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        rock.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
  })

  return (
    <>
      {ROCK_SITES.map((site) => (
        <SiteMarker key={site.id} site={site} />
      ))}
      {rocks.map((r) => (
        <Rock key={r.id} id={r.id} kind={kind} color={r.color} variant={r.variant} position={r.position} pooled={r.pooled} />
      ))}
      <PickupMarkers max={rocks.length} />
    </>
  )
}
