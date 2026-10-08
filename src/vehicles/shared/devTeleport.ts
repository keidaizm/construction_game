import type { VehicleId } from '../types'

/**
 * 車両を指定の場所へ瞬間移動させる。セーブから戻すとき（関節の角度も）と、開発用の自動テストで使う。
 * `__game.teleport('dumpTruck', x, z, heading)` で予約し、各コントローラが次のフレームで取り出す（applyTeleport）。
 */
export interface TeleportRequest {
  x: number
  z: number
  heading: number
  /** 関節の角度（コントローラの状態の名前 → 角度）。例：{ boom: 0.5 } */
  joints?: Record<string, number>
}

const pending = new Map<VehicleId, TeleportRequest>()

/** 各コントローラのいまの状態（位置・関節）。セーブするときに読む（コントローラが毎フレーム入れる） */
export const vehicleStates: Partial<Record<VehicleId, Record<string, unknown>>> = {}

export function requestTeleport(id: VehicleId, x: number, z: number, heading = 0, joints?: Record<string, number>) {
  pending.set(id, { x, z, heading, joints })
}

/** 予約があれば、コントローラの状態に当てはめる（位置・向き・関節。速さは 0 に） */
export function applyTeleport(id: VehicleId, s: { x: number; z: number; heading: number; speed: number } & Record<string, unknown>) {
  const t = pending.get(id)
  if (!t) return
  pending.delete(id)
  s.x = t.x
  s.z = t.z
  s.heading = t.heading
  s.speed = 0
  for (const [name, angle] of Object.entries(t.joints ?? {})) {
    const joint = s[name] as { angle: number; vel: number } | undefined
    if (joint && typeof joint === 'object' && 'angle' in joint) {
      joint.angle = angle
      joint.vel = 0
    }
  }
}

/** 予約があれば取り出す（コントローラの useFrame から呼ぶ） */
export function takeTeleport(id: VehicleId) {
  const t = pending.get(id)
  if (t) pending.delete(id)
  return t
}
