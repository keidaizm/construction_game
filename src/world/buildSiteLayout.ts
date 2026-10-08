import { BUILD_SITE } from './fieldLayout'

/**
 * 家を建てる場所（Lv6）。基地の左がわ（地図で見て）に、家の区画を 2 列 × 3 つ（地図の上下に長く並ぶ）。
 * 基地に近い方から順に建てる。どの家も、基地の方（ワールドの -X）を向く。
 */
export const LOGS_PER_HOUSE = 12
/** 家ができたときにもらえる星 */
export const HOUSE_STARS = 3
/** 区画の上のこの半径 [m] に置いた木材を、家に使う */
export const PLOT_RADIUS = 4.5

export const PLOTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: BUILD_SITE.x - 5, z: BUILD_SITE.z },
  { x: BUILD_SITE.x - 5, z: BUILD_SITE.z + 13 },
  { x: BUILD_SITE.x - 5, z: BUILD_SITE.z - 13 },
  { x: BUILD_SITE.x + 6, z: BUILD_SITE.z },
  { x: BUILD_SITE.x + 6, z: BUILD_SITE.z + 13 },
  { x: BUILD_SITE.x + 6, z: BUILD_SITE.z - 13 },
]

/** 家の向き（基地＝ワールドの -X の方を向く） */
export const HOUSE_YAW = -Math.PI / 2
/** 家（丸太小屋）の大きさ：正面の幅・奥行き・丸太 1 段の高さ・段の数 */
export const HOUSE = { width: 5, depth: 4, layer: 0.42, layers: 8 }
