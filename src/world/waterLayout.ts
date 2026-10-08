import type { Obstacle } from './fieldLayout'

/**
 * 池・川・橋（ユーザー要望「景色に変化を」）。車両は水に入れない（足元の円の障害物）。
 * 橋の上だけは川を渡れる。雪原の池は凍っていて、上を走れる。
 * 置き場所は石の置き場・土の山・宝の山から離してある。
 */
export interface Lake {
  x: number
  z: number
  r: number
  /** 凍っている（上を走れる） */
  frozen?: boolean
}

/** 川の幅 [m] */
export const RIVER_WIDTH = 8
/** 川の流れ（東の森：フィールドの端から湖へ） */
export const RIVER: ReadonlyArray<readonly [x: number, z: number]> = [
  [-178, 20],
  [-160, 12],
  [-148, 2],
  [-140, -12],
  [-130, -28],
]

export const LAKES: readonly Lake[] = [
  // 森の湖（川が流れこむ）
  { x: -124, z: -40, r: 14 },
  // 砂漠のオアシス
  { x: 45, z: -140, r: 9 },
  // 雪原の凍った池（走れる）
  { x: -45, z: 140, r: 13, frozen: true },
]

/** 橋（川の上。[川の点の番号, その点から次の点までの割合]） */
export const BRIDGES: ReadonlyArray<{ segment: number; t: number }> = [
  { segment: 1, t: 0.5 },
  { segment: 3, t: 0.4 },
]
/** 橋の幅（車両が通れる幅） [m] */
export const BRIDGE_WIDTH = 7

/** 橋の中心と向き（川の流れの向き） */
export function bridgePose(b: { segment: number; t: number }) {
  const [x0, z0] = RIVER[b.segment]
  const [x1, z1] = RIVER[b.segment + 1]
  return { x: x0 + (x1 - x0) * b.t, z: z0 + (z1 - z0) * b.t, flow: Math.atan2(x1 - x0, z1 - z0) }
}

/** (x, z) から線分 a-b までの距離と、線分上の位置（0〜1） */
function segmentDistance(x: number, z: number, a: readonly [number, number], b: readonly [number, number]) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
  return { d: Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)), t }
}

/** (x, z) が水の中か（margin だけ広めに調べる）。凍った池は水に入れない */
export function isInWater(x: number, z: number, margin = 0) {
  for (const l of LAKES) if (!l.frozen && Math.hypot(x - l.x, z - l.z) < l.r + margin) return true
  for (let i = 0; i < RIVER.length - 1; i++) if (segmentDistance(x, z, RIVER[i], RIVER[i + 1]).d < RIVER_WIDTH / 2 + margin) return true
  return false
}

/** (x, z) が橋の上か */
export function isOnBridge(x: number, z: number) {
  return BRIDGES.some((b) => {
    const p = bridgePose(b)
    const dx = x - p.x
    const dz = z - p.z
    // 流れの向きにそった距離（橋の幅の半分まで）
    const along = Math.abs(dx * Math.sin(p.flow) + dz * Math.cos(p.flow))
    const across = Math.abs(dx * Math.cos(p.flow) - dz * Math.sin(p.flow))
    return along < BRIDGE_WIDTH / 2 && across < RIVER_WIDTH / 2 + 3
  })
}

/**
 * 車両が水に入らないための障害物（円を並べる）。橋の所はあける。
 * 円は川の両岸の少し内側に並べ、川の中を走れないようにする。
 */
export const WATER_OBSTACLES: readonly Obstacle[] = (() => {
  const out: Obstacle[] = []
  for (const l of LAKES) if (!l.frozen) out.push({ x: l.x, z: l.z, r: l.r - 0.5 })
  const step = 2.5
  const r = RIVER_WIDTH / 2 - 0.5
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [x0, z0] = RIVER[i]
    const [x1, z1] = RIVER[i + 1]
    const len = Math.hypot(x1 - x0, z1 - z0)
    for (let s = 0; s <= len; s += step) {
      const x = x0 + ((x1 - x0) * s) / len
      const z = z0 + ((z1 - z0) * s) / len
      if (isOnBridgeAxis(x, z)) continue
      out.push({ x, z, r })
    }
  }
  return out
})()

/** 川の中心線上で、橋に近い所（障害物を置かない所） */
function isOnBridgeAxis(x: number, z: number) {
  return BRIDGES.some((b) => {
    const p = bridgePose(b)
    // 円（半径 = 川幅の半分）が橋の幅の外にくるように、橋の中心から十分離す
    return Math.hypot(x - p.x, z - p.z) < BRIDGE_WIDTH / 2 + 2.7
  })
}
