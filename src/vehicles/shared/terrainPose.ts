import type * as THREE from 'three'
import { heightAt } from '../../world/terrain'
import { approach } from './joint'

/** 傾きの追従の速さ（大きいほどキビキビ。小さいとふわっと） */
const RESPONSE = 10

export interface TerrainPose {
  y: number
  pitch: number
  roll: number
}

export const createTerrainPose = (): TerrainPose => ({ y: 0, pitch: 0, roll: 0 })

/**
 * 丘の上で車両を地面にそわせる（高さと、前後・左右の傾き）。
 * 車体の前後・左右の 4 点の地面の高さから傾きを決める。rotation の順番は YXZ（向き → 前後 → 左右）。
 * halfLength / halfWidth：車体の前後・左右の半分の長さ [m]
 */
export function applyTerrainPose(
  root: THREE.Object3D,
  pose: TerrainPose,
  x: number,
  z: number,
  heading: number,
  halfLength: number,
  halfWidth: number,
  dt: number,
  yOffset = 0,
) {
  const sin = Math.sin(heading)
  const cos = Math.cos(heading)
  const front = heightAt(x + sin * halfLength, z + cos * halfLength)
  const back = heightAt(x - sin * halfLength, z - cos * halfLength)
  // ローカル +X（左）
  const left = heightAt(x + cos * halfWidth, z - sin * halfWidth)
  const right = heightAt(x - cos * halfWidth, z + sin * halfWidth)
  const k = dt > 0 ? dt : 1 / 60
  pose.y = approach(pose.y, Math.max((front + back + left + right) / 4, heightAt(x, z)), RESPONSE * 1.5, k)
  // 前が高いと機首上げ（rotation.x はマイナス）、左が高いと左上がり（rotation.z はプラス）
  pose.pitch = approach(pose.pitch, -Math.atan2(front - back, halfLength * 2), RESPONSE, k)
  pose.roll = approach(pose.roll, Math.atan2(left - right, halfWidth * 2), RESPONSE, k)
  root.position.set(x, pose.y + yOffset, z)
  root.rotation.set(pose.pitch, heading, pose.roll, 'YXZ')
}
