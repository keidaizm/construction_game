import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { SCRAP, SCRAP_POOL, scrapRegistry, setScrapKind, type ScrapEntry } from './scrapRegistry'
import { heightAt } from '../../world/terrain'
import { isInWater, isOnBridge } from '../../world/waterLayout'
import { touchingFootprint } from '../../vehicles/shared/footprints'

/** 鉄骨（H 形鋼）：上下のつばと、まん中の板。さび止めの赤茶色 */
const beamGeometry = (() => {
  const { length: L, height: H, width: W } = SCRAP
  const t = 0.045
  const top = new THREE.BoxGeometry(L, t, W).translate(0, H / 2 - t / 2, 0)
  const bottom = new THREE.BoxGeometry(L, t, W).translate(0, -H / 2 + t / 2, 0)
  const web = new THREE.BoxGeometry(L, H - t * 2, 0.05)
  return mergeGeometries([top, bottom, web])!
})()
/** 鉄骨にくっついたコンクリートのかたまり（ふるうと落ちる） */
const concreteGeometry = (() => {
  const chunks = [
    new THREE.DodecahedronGeometry(0.24, 0).scale(1.1, 0.9, 1).translate(-0.28, 0.04, 0.02),
    new THREE.DodecahedronGeometry(0.2, 0).translate(0.08, 0.06, -0.03),
    new THREE.DodecahedronGeometry(0.17, 0).scale(1, 0.8, 1.1).translate(0.34, -0.02, 0.04),
  ]
  return mergeGeometries(chunks)!
})()
const steelMaterial = new THREE.MeshStandardMaterial({ color: '#b04a2e', roughness: 0.6, metalness: 0.4 })
const concreteMaterial = new THREE.MeshStandardMaterial({ color: '#a9a8a2', roughness: 1, flatShading: true })

const parkAt = (i: number) => ({ x: 400 + i * 3, y: -50, z: 440 })
const FIELD_LIMIT = 185
/** 車体の上に乗ったがれきを、外へすべらせる速さ [m/s] */
const SLIDE_OFF_SPEED = 2.5
const quat = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

function ScrapPiece({ index }: { index: number }) {
  const body = useRef<RapierRigidBody>(null)
  const concrete = useRef<THREE.Mesh>(null)
  useEffect(() => {
    const b = body.current
    if (!b) return
    const entry: ScrapEntry = { id: `scrap-${index}`, body: b, state: 'pooled', kind: 'mixed', sift: 0, grabCooldownUntil: 0, concrete: concrete.current }
    scrapRegistry.pieces.push(entry)
    return () => {
      const i = scrapRegistry.pieces.indexOf(entry)
      if (i >= 0) scrapRegistry.pieces.splice(i, 1)
    }
  }, [index])
  const p = parkAt(index)
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[p.x, p.y, p.z]} linearDamping={0.2} angularDamping={0.8} ccd>
      {/* 長い向きはローカル X。コンクリートつきでも鉄骨だけでも、当たり判定は同じ箱 */}
      <CuboidCollider args={[SCRAP.length / 2, 0.17, 0.2]} friction={0.9} restitution={0} />
      <mesh geometry={beamGeometry} material={steelMaterial} castShadow />
      <mesh ref={concrete} geometry={concreteGeometry} material={concreteMaterial} castShadow />
    </RigidBody>
  )
}

/**
 * がれき（Lv7）。古いビルをこわすと出てくる（world/DemolitionSite）。控えを遠くに止めておき、出すときに動かす。
 * コンクリートつき（mixed）はスケルトンバケットでふるうと鉄骨だけ（steel）になる。
 * 場外・水の中に入ったものは控えに戻し、丘の中に入ったものは上へ出す。
 */
export function ScrapField() {
  const { rapier } = useRapier()
  const timer = useRef(0)
  const indices = useMemo(() => Array.from({ length: SCRAP_POOL }, (_, i) => i), [])

  useEffect(() => {
    const park = (piece: ScrapEntry) => {
      const i = Number(piece.id.slice(6))
      piece.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
      piece.body.setTranslation(parkAt(i), true)
      piece.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      piece.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      piece.state = 'pooled'
      setScrapKind(piece, 'mixed')
    }
    scrapRegistry.despawn = park
    scrapRegistry.spawn = (x, y, z, yaw) => {
      const piece = scrapRegistry.pieces.find((s) => s.state === 'pooled')
      if (!piece) return null
      setScrapKind(piece, 'mixed')
      piece.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
      piece.body.setTranslation({ x, y, z }, true)
      piece.body.setRotation(quat.setFromAxisAngle(UP, yaw - Math.PI / 2), true)
      piece.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      piece.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      piece.state = 'free'
      piece.grabCooldownUntil = 0
      return piece
    }
    // 最初はどれも控え（コンクリートつきの見た目）
    for (const piece of scrapRegistry.pieces) setScrapKind(piece, piece.kind)
    return () => {
      scrapRegistry.spawn = null
      scrapRegistry.despawn = null
    }
  }, [rapier])

  useFrame((_, dt) => {
    scrapRegistry.now += dt
    // 車体の上に乗ったがれきは、車両の外へすべらせる（ダンプは荷台に積むので対象にしない）
    for (const piece of scrapRegistry.pieces) {
      if (piece.state !== 'free') continue
      const p = piece.body.translation()
      if (p.y < heightAt(p.x, p.z) + 0.6) continue
      const hit = touchingFootprint(p.x, p.z, 0.2)
      if (!hit || hit.id === 'dumpTruck') continue
      const ox = p.x - hit.cx
      const oz = p.z - hit.cz
      const len = Math.hypot(ox, oz) || 1
      const v = piece.body.linvel()
      piece.body.setLinvel({ x: (ox / len) * SLIDE_OFF_SPEED, y: Math.min(v.y, 0.5), z: (oz / len) * SLIDE_OFF_SPEED }, true)
    }
    timer.current += dt
    if (timer.current < 0.5) return
    timer.current = 0
    for (const piece of scrapRegistry.pieces) {
      if (piece.state !== 'free') continue
      const p = piece.body.translation()
      if (p.y < -2 || Math.abs(p.x) > FIELD_LIMIT || Math.abs(p.z) > FIELD_LIMIT || (isInWater(p.x, p.z) && !isOnBridge(p.x, p.z))) {
        scrapRegistry.despawn?.(piece)
        continue
      }
      const ground = heightAt(p.x, p.z)
      if (ground > 0.05 && p.y < ground - 0.02) {
        piece.body.setTranslation({ x: p.x, y: ground + 0.3, z: p.z }, true)
        piece.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
  })

  return (
    <>
      {indices.map((i) => (
        <ScrapPiece key={i} index={i} />
      ))}
    </>
  )
}
