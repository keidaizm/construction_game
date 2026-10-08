import type { RockColor } from './rockTypes'

/**
 * 岩の置き場所（探検で見つける場所）。色ごとに 2 か所。
 * スタート（フィールドの中心）のまわりには置かず、中心から 105〜135m の輪の上に、
 * 方角ごとに色が変わるように並べる（どの方向へ走っても何かが見つかる）。
 * 各場所には、その色の旗が立つ（遠くからでも見える）。
 */
export interface RockSite {
  id: string
  color: RockColor
  center: readonly [x: number, z: number]
  count: number
  /** 岩を積む範囲の半径の目安 [m] */
  spread: number
}

/** 輪の上の位置（angle は度。0 = スタートの前方 +Z、90 = 左 +X） */
function onRing(angleDeg: number, radius: number): readonly [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [Math.round(Math.sin(a) * radius), Math.round(Math.cos(a) * radius)]
}

const RING: ReadonlyArray<readonly [RockColor, number, number]> = [
  ['gray', 0, 120],
  ['black', 45, 110],
  ['red', 90, 130],
  ['white', 135, 115],
  ['gray', 180, 125],
  ['black', 225, 120],
  ['red', 270, 110],
  ['white', 315, 130],
]

export const ROCK_SITES: readonly RockSite[] = RING.map(([color, angle, radius]) => ({
  id: `${color}-${angle}`,
  color,
  center: onRing(angle, radius),
  count: 9,
  spread: 1.0,
}))

/** その色の岩が全部で何個あるか（ミッションの数がこれを超えないようにする） */
export function rocksAvailable(color: RockColor): number {
  return ROCK_SITES.filter((s) => s.color === color).reduce((sum, s) => sum + s.count, 0)
}
