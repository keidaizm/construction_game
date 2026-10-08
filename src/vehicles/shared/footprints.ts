import type { VehicleId } from '../types'
import { STATIC_OBSTACLES } from '../../world/fieldLayout'

/**
 * 車両どうしがすり抜けないための簡易な接触判定。
 * 各車両の足元を、前後方向に並べた数個の円で近似する（[ローカル Z, 半径]）。
 * 車両は kinematic で動かしているため物理エンジンでは止まらないので、ここで判定する。
 * 木・大きな岩・建物（fieldLayout の STATIC_OBSTACLES）にもぶつかって止まる。
 */
export type FootprintCircles = ReadonlyArray<readonly [localZ: number, radius: number]>

interface Placed {
  x: number
  z: number
  heading: number
  circles: FootprintCircles
}

const placed = new Map<VehicleId, Placed>()
/** 出たり消えたりする障害物（土の山など。掘りつくすと消える） */
const dynamicObstacles = new Map<string, { x: number; z: number; r: number }>()

export function setDynamicObstacle(id: string, obstacle: { x: number; z: number; r: number } | null) {
  if (obstacle) dynamicObstacles.set(id, obstacle)
  else dynamicObstacles.delete(id)
}

export function setFootprint(id: VehicleId, x: number, z: number, heading: number, circles: FootprintCircles) {
  placed.set(id, { x, z, heading, circles })
}

export function removeFootprint(id: VehicleId) {
  placed.delete(id)
}

/** (x, z) の半径 r の円に、どれかの車両の足元が触れているか（宝箱を開けるときなど） */
export function footprintTouches(x: number, z: number, r: number): VehicleId | null {
  for (const [id, o] of placed) {
    const sin = Math.sin(o.heading)
    const cos = Math.cos(o.heading)
    for (const [lz, cr] of o.circles) if (Math.hypot(o.x + sin * lz - x, o.z + cos * lz - z) < cr + r) return id
  }
  return null
}

/** (x, z) の半径 r の円に触れている車両と、その足元の円の中心（なければ null） */
export function touchingFootprint(x: number, z: number, r: number): { id: VehicleId; cx: number; cz: number } | null {
  for (const [id, o] of placed) {
    const sin = Math.sin(o.heading)
    const cos = Math.cos(o.heading)
    for (const [lz, cr] of o.circles) {
      const cx = o.x + sin * lz
      const cz = o.z + cos * lz
      if (Math.hypot(cx - x, cz - z) < cr + r) return { id, cx, cz }
    }
  }
  return null
}

/** 指定の位置に置いたとき、他の車両や木・岩とどれだけ重なるか（重ならなければ 0） */
export function overlapDepth(id: VehicleId, x: number, z: number, heading: number, circles: FootprintCircles): number {
  let worst = 0
  const sin = Math.sin(heading)
  const cos = Math.cos(heading)
  for (const [lz, r] of circles) {
    const ax = x + sin * lz
    const az = z + cos * lz
    for (const o of [...STATIC_OBSTACLES, ...dynamicObstacles.values()]) {
      // 遠いものはすぐ飛ばす（木や岩は 100 個ほどあるので）
      const dx = ax - o.x
      const dz = az - o.z
      if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue
      worst = Math.max(worst, r + o.r - Math.hypot(dx, dz))
    }
  }
  for (const [otherId, o] of placed) {
    if (otherId === id) continue
    const os = Math.sin(o.heading)
    const oc = Math.cos(o.heading)
    for (const [lz, r] of circles) {
      const ax = x + sin * lz
      const az = z + cos * lz
      for (const [olz, or] of o.circles) {
        const d = Math.hypot(ax - (o.x + os * olz), az - (o.z + oc * olz))
        worst = Math.max(worst, r + or - d)
      }
    }
  }
  return worst
}

/**
 * 車両を動かすときの共通処理。重なりが増える動きなら false を返す（呼び出し側で動きを取り消す）。
 * 重なっている状態から離れる動きは許す（引っかかって動けなくならないように）。
 */
export function canMoveTo(
  id: VehicleId,
  from: { x: number; z: number; heading: number },
  to: { x: number; z: number; heading: number },
  circles: FootprintCircles,
): boolean {
  const next = overlapDepth(id, to.x, to.z, to.heading, circles)
  if (next <= 0) return true
  return next < overlapDepth(id, from.x, from.z, from.heading, circles) - 1e-4
}
