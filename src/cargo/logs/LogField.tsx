import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CylinderCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { LOG, LOG_LIFETIME, LOG_POOL, logRegistry, type LogEntry } from './logRegistry'
import { useProgressStore } from '../../stores/progressStore'
import { GRAPPLE_LEVEL, levelForStars } from '../../missions/levels'
import { digEffects } from '../../effects/DigEffects'
import { heightAt } from '../../world/terrain'
import { isInWater, isOnBridge } from '../../world/waterLayout'
import { touchingFootprint } from '../../vehicles/shared/footprints'

const bark = new THREE.MeshStandardMaterial({ color: '#7a4f2a', roughness: 1, flatShading: true })
const cut = new THREE.MeshStandardMaterial({ color: '#e2c08a', roughness: 0.9 })
/** 円柱の面の順：横・上・下（切り口は明るい木の色） */
const materials = [bark, cut, cut]
const geometry = new THREE.CylinderGeometry(LOG.radius, LOG.radius, LOG.length, 9).rotateZ(Math.PI / 2)
const parkAt = (i: number) => ({ x: 400 + i * 3, y: -40, z: 420 })
const FIELD_LIMIT = 185
/** 車体の上に乗った木材を、外へすべらせる速さ [m/s] */
const SLIDE_OFF_SPEED = 2.5
const quat = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

function Log({ index }: { index: number }) {
  const body = useRef<RapierRigidBody>(null)
  useEffect(() => {
    const b = body.current
    if (!b) return
    const entry: LogEntry = { id: `log-${index}`, body: b, state: 'pooled', spawnedAt: 0 }
    logRegistry.logs.push(entry)
    return () => {
      const i = logRegistry.logs.indexOf(entry)
      if (i >= 0) logRegistry.logs.splice(i, 1)
    }
  }, [index])
  const p = parkAt(index)
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[p.x, p.y, p.z]} linearDamping={0.2} angularDamping={0.8} ccd>
      {/* 丸太の長い向きはローカル X */}
      <CylinderCollider args={[LOG.length / 2, LOG.radius]} rotation={[0, 0, Math.PI / 2]} friction={0.9} restitution={0} />
      <mesh geometry={geometry} material={materials} castShadow />
    </RigidBody>
  )
}

/**
 * 木材（丸太）。木を倒すと出てくる（world/TreeField）。控えを遠くに止めておき、出すときに動かす。
 * Lv6（グラップル）になるまでは、出てから 30 秒で消える。場外・水の中・丘の中に入ったものは消す／出す。
 */
export function LogField() {
  const { rapier } = useRapier()
  const timer = useRef(0)
  const indices = useMemo(() => Array.from({ length: LOG_POOL }, (_, i) => i), [])

  useEffect(() => {
    const park = (log: LogEntry) => {
      const i = Number(log.id.slice(4))
      log.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
      log.body.setTranslation(parkAt(i), true)
      log.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      log.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      log.state = 'pooled'
    }
    logRegistry.despawn = park
    logRegistry.spawn = (x, y, z, yaw) => {
      let log = logRegistry.logs.find((l) => l.state === 'pooled')
      if (!log) {
        // 控えがない：いちばん古い（地面にある）木材を使い回す
        const free = logRegistry.logs.filter((l) => l.state === 'free').sort((a, b) => a.spawnedAt - b.spawnedAt)
        log = free[0]
        if (!log) return null
      }
      log.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
      log.body.setTranslation({ x, y, z }, true)
      // 丸太の長い向き（ローカル X）を yaw の向きへ
      log.body.setRotation(quat.setFromAxisAngle(UP, yaw - Math.PI / 2), true)
      log.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      log.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      log.state = 'free'
      log.spawnedAt = logRegistry.now
      return log
    }
    return () => {
      logRegistry.spawn = null
      logRegistry.despawn = null
    }
  }, [rapier])

  useFrame((_, dt) => {
    logRegistry.now += dt
    // 車体の上に乗った木材（地面から浮いていて、車両の足元に重なっている）は、車両の外へすべらせる
    // （ダンプは荷台に積むので対象にしない）
    for (const log of logRegistry.logs) {
      if (log.state !== 'free') continue
      const p = log.body.translation()
      if (p.y < heightAt(p.x, p.z) + LOG.radius + 0.35) continue
      const hit = touchingFootprint(p.x, p.z, 0.2)
      if (!hit || hit.id === 'dumpTruck') continue
      const ox = p.x - hit.cx
      const oz = p.z - hit.cz
      const len = Math.hypot(ox, oz) || 1
      const v = log.body.linvel()
      log.body.setLinvel({ x: (ox / len) * SLIDE_OFF_SPEED, y: Math.min(v.y, 0.5), z: (oz / len) * SLIDE_OFF_SPEED }, true)
    }
    timer.current += dt
    if (timer.current < 0.5) return
    timer.current = 0
    const keep = levelForStars(useProgressStore.getState().stars).level >= GRAPPLE_LEVEL
    for (const log of logRegistry.logs) {
      if (log.state !== 'free') continue
      const p = log.body.translation()
      // Lv6 までは時間で消える（ポンと土ぼこり）
      if (!keep && logRegistry.now - log.spawnedAt > LOG_LIFETIME) {
        digEffects.dust(p.x, p.y, p.z)
        logRegistry.despawn?.(log)
        continue
      }
      if (p.y < -2 || Math.abs(p.x) > FIELD_LIMIT || Math.abs(p.z) > FIELD_LIMIT || (isInWater(p.x, p.z) && !isOnBridge(p.x, p.z))) {
        logRegistry.despawn?.(log)
        continue
      }
      // 丘の中にもぐりこんだら、斜面の上へ出す
      const ground = heightAt(p.x, p.z)
      if (ground > 0.05 && p.y < ground - 0.02) {
        log.body.setTranslation({ x: p.x, y: ground + LOG.radius + 0.1, z: p.z }, true)
        log.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
  })

  return (
    <>
      {indices.map((i) => (
        <Log key={i} index={i} />
      ))}
    </>
  )
}
