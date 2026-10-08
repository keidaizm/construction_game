import { useEffect, type RefObject } from 'react'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { logRegistry, type LogEntry } from '../../cargo/logs/logRegistry'
import { audio } from '../../audio/AudioManager'
import { excavatorSensors } from './excavatorSensors'
import { GRAPPLE_HOLD } from './parts/GrappleModel'
import type { RigListener } from '../shared/rig'

/** つめがこれより閉じたら、まん中の近くの木材をつかむ */
const GRAB_BELOW = 0.35
/** つめがこれより開いたら、はなす */
const RELEASE_ABOVE = 0.55
/** つかめる距離（つかむ所から木材の中心まで） [m] */
const GRAB_REACH = 1.0
const holdWorld = new THREE.Vector3()
const prev = new THREE.Vector3()
const vel = new THREE.Vector3()
const q = new THREE.Quaternion()
const p = new THREE.Vector3()
const sc = new THREE.Vector3()

/**
 * グラップル（Lv6）：つめを閉じると、まん中の近くの木材をつかみ（kinematic でついてくる）、開くとはなす。
 * 木材はつめと同じ向き（グラップルのローカル X＝ショベルの左右）に持つ。地面・荷台の木材どちらもつかめる。
 */
export function useGrapple(attachment: RefObject<THREE.Group | null>, listeners: RefObject<RigListener[]>) {
  const { rapier } = useRapier()
  useEffect(() => {
    let held: LogEntry | null = null
    let lastOpen = excavatorSensors.grappleOpen

    const release = () => {
      if (!held) return
      held.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
      held.body.setLinvel(vel.clampLength(0, 3), true)
      held.state = 'free'
      held = null
      audio.play('rockDrop')
    }

    const listener: RigListener = {
      update(dt) {
        const a = attachment.current
        if (excavatorSensors.tool !== 'grapple' || !a) {
          release()
          return
        }
        a.matrixWorld.decompose(p, q, sc)
        holdWorld.set(...GRAPPLE_HOLD).applyMatrix4(a.matrixWorld)
        if (dt > 0) vel.subVectors(holdWorld, prev).divideScalar(dt)
        prev.copy(holdWorld)
        const open = excavatorSensors.grappleOpen
        const closing = open < lastOpen - 1e-4
        lastOpen = open

        // ほかの所（荷台・はじめから）で状態が変わったら、持っていない
        if (held && held.state !== 'held') held = null

        if (held) {
          if (open > RELEASE_ABOVE) {
            release()
            return
          }
          held.body.setNextKinematicTranslation(holdWorld)
          held.body.setNextKinematicRotation(q)
          return
        }

        if (closing && open < GRAB_BELOW) {
          let best: LogEntry | null = null
          let bestD = GRAB_REACH
          for (const log of logRegistry.logs) {
            if (log.state !== 'free' && log.state !== 'truck') continue
            const t = log.body.translation()
            const d = Math.hypot(t.x - holdWorld.x, t.y - holdWorld.y, t.z - holdWorld.z)
            if (d < bestD) {
              bestD = d
              best = log
            }
          }
          if (best) {
            best.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
            best.state = 'held'
            held = best
            audio.play('rockLoad')
          }
        }
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
      release()
    }
  }, [attachment, listeners, rapier])
}
