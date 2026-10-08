/**
 * バケットの形状データ。見た目・当たり判定・すくい判定で共有する。
 * 座標はバケットのローカル（原点 = アーム先端のピン、+Z = 爪の方向）。
 * 側面形状は (y, z) の組で表し、口は -Y 側を向く。
 */
export type YZ = readonly [y: number, z: number]

/** 外殻の断面（ピン付近 → 背面 → 爪先） */
export const BUCKET_PROFILE: readonly YZ[] = [
  [-0.3, 0.05],
  [0.05, -0.05],
  [0.35, 0.15],
  [0.45, 0.55],
  [0.25, 0.95],
  [-0.1, 1.2],
]
export const BUCKET_WIDTH = 1.0
export const BUCKET_TIP: readonly [number, number, number] = [0, -0.14, 1.34]

/**
 * すくい判定の領域（側面）。
 * 外殻の内側に加え、口の外側へ少しはみ出した帯も含める
 * （岩は外殻に当たって口のあたりで止まるため、中心が完全に中へ入ることは少ない）。
 */
export const BUCKET_CAPTURE_POLYGON: readonly YZ[] = (() => {
  const first = BUCKET_PROFILE[0]
  const last = BUCKET_PROFILE[BUCKET_PROFILE.length - 1]
  // 口（first → last の弦）の外向き法線
  const dy = last[0] - first[0]
  const dz = last[1] - first[1]
  const len = Math.hypot(dy, dz)
  const n: YZ = [-dz / len, dy / len]
  const out = n[0] < 0 ? n : ([-n[0], -n[1]] as YZ) // -Y 側を向く方
  const band = 0.4
  return [
    [first[0] + out[0] * band, first[1] + out[1] * band],
    ...BUCKET_PROFILE,
    [last[0] + out[0] * band, last[1] + out[1] * band],
  ]
})()

type Slot = readonly [x: number, y: number, z: number]

/**
 * すくった岩を並べる位置（バケットローカル x, y, z）。数 = 一度に運べる最大個数。
 * レベルが上がるとバケットが大きくなる（5 こ = 1.3 倍、8 こ = 1.6 倍）ので、
 * ローカル座標では岩が小さく見える分だけ詰めて並べる。
 */
export const BUCKET_SLOTS_BY_CAPACITY: Record<3 | 5 | 8, readonly Slot[]> = {
  3: [
    [-0.24, 0.16, 0.55],
    [0.24, 0.16, 0.55],
    [0, 0.12, 0.92],
  ],
  5: [
    [-0.22, 0.2, 0.42],
    [0.22, 0.2, 0.42],
    [-0.22, 0.12, 0.82],
    [0.22, 0.12, 0.82],
    [0, 0.44, 0.62],
  ],
  8: [
    [-0.34, 0.17, 0.42],
    [0, 0.17, 0.42],
    [0.34, 0.17, 0.42],
    [-0.34, 0.1, 0.78],
    [0, 0.1, 0.78],
    [0.34, 0.1, 0.78],
    [-0.17, 0.4, 0.6],
    [0.17, 0.4, 0.6],
  ],
}

export function pointInPolygon(y: number, z: number, poly: readonly YZ[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, zi] = poly[i]
    const [yj, zj] = poly[j]
    if (zi > z !== zj > z && y < ((yj - yi) * (z - zi)) / (zj - zi) + yi) inside = !inside
  }
  return inside
}
