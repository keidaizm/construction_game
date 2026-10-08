import { rockRegistry, type RockState } from '../cargo/rocks/rockRegistry'
import type { RockColor } from '../cargo/rocks/rockTypes'
import type { ColorCounts } from '../stores/missionStore'

/** その状態（荷台の中・バケットの中など）の岩を色ごとに数える */
export function countByColor(state: RockState): ColorCounts {
  const counts: ColorCounts = {}
  for (const r of rockRegistry.rocks) if (r.state === state) counts[r.color] = (counts[r.color] ?? 0) + 1
  return counts
}

/** 荷台に多すぎる色（残りより多い色・ミッションにない色） */
export function truckOverColors(remaining: (color: RockColor) => number): Set<RockColor> {
  const truck = countByColor('truck')
  return new Set((Object.keys(truck) as RockColor[]).filter((c) => (truck[c] ?? 0) > remaining(c)))
}
