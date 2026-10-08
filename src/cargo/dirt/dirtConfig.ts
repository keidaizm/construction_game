import type { TimeOfDay } from '../../stores/gameStore'
import type { RockColor } from '../rocks/rockTypes'
import { BIOME_ANGLE, OUTER_BIOMES, type OuterBiome } from '../../world/biomes'
import { ORES, type OreId } from '../ores/oreTypes'

/** 土ブロック 1 この大きさ（一辺） [m] */
export const BLOCK = 0.7
/** 土の山の広さ（一辺のブロック数） */
export const MOUND_GRID = 5

/**
 * 土の山の置き場所。石の置き場（外周の輪）の間、中心から 60〜80m くらいに置く。
 * 「はじめから」や次のミッションで元に戻る。
 */
export interface DirtMoundConfig {
  id: string
  center: readonly [x: number, z: number]
  /** 宝の山（フィールドの外側、地帯ごとに 1 つ）。レアな鉱石と、その地帯だけの鉱石が出やすい */
  treasure?: OuterBiome
}

export const DIRT_MOUNDS: readonly DirtMoundConfig[] = [22, 82, 142, 202, 262, 322].map((deg, i) => {
  const a = (deg * Math.PI) / 180
  const r = 62 + (i % 3) * 8
  return { id: `mound-${deg}`, center: [Math.round(Math.sin(a) * r), Math.round(Math.cos(a) * r)] as const }
})

/** 宝の山の置き場所：各地帯のまん中から少しずらした方角、中心から 152m（石の置き場の輪より外） */
const TREASURE_RADIUS = 152

export const TREASURE_MOUNDS: readonly DirtMoundConfig[] = OUTER_BIOMES.map((biome) => {
  const a = ((BIOME_ANGLE[biome] + 20) * Math.PI) / 180
  return {
    id: `treasure-${biome}`,
    center: [Math.round(Math.sin(a) * TREASURE_RADIUS), Math.round(Math.cos(a) * TREASURE_RADIUS)] as const,
    treasure: biome,
  }
})

/** 土の山すべて（ふつうの山＋宝の山） */
export const ALL_MOUNDS: readonly DirtMoundConfig[] = [...DIRT_MOUNDS, ...TREASURE_MOUNDS]

/** 山の形：まん中が高く（3 段）、まわりが低い */
export function initialHeights(): number[] {
  const h: number[] = []
  const c = (MOUND_GRID - 1) / 2
  for (let i = 0; i < MOUND_GRID; i++) {
    for (let j = 0; j < MOUND_GRID; j++) h.push(Math.max(1, 3 - Math.round(Math.hypot(i - c, j - c))))
  }
  return h
}

/** 宝の山で、★3 以上の鉱石が出やすくなる倍率 */
const TREASURE_RARE_BOOST = 3

/** ブロックを崩したときに出てくるもの */
export type DigDrop = { kind: 'nothing' } | { kind: 'rock'; color: RockColor } | { kind: 'ore'; ore: OreId }

/**
 * 出てくるものを決める（ブロック 1 こあたり）。
 * だいたい：なにもなし 約 5 割・ふつうの石 25%・色の石 10%・鉱石 約 10%（レアなものほど出にくい）。
 * 夕焼け・夜は、その時間帯だけの鉱石（OreType.onlyAt）もそれぞれ約 2.6% 出る。
 * 宝の山（treasure）では ★3 以上の鉱石が 3 倍出やすく、その地帯だけの鉱石（OreType.onlyIn）も出る
 */
export function rollDrop(time: TimeOfDay, treasure?: OuterBiome): DigDrop {
  let r = Math.random() * 100
  for (const ore of ORES) {
    if (ore.onlyAt && ore.onlyAt !== time) continue
    if (ore.onlyIn && ore.onlyIn !== treasure) continue
    if (ore.fromBoulder) continue
    const weight = treasure && ore.stars >= 3 && !ore.onlyIn ? ore.weight * TREASURE_RARE_BOOST : ore.weight
    if (r < weight) return { kind: 'ore', ore: ore.id }
    r -= weight
  }
  if (r < 25) return { kind: 'rock', color: 'gray' }
  r -= 25
  if (r < 10) {
    const colors: RockColor[] = ['black', 'red', 'white']
    return { kind: 'rock', color: colors[Math.floor(Math.random() * colors.length)] }
  }
  return { kind: 'nothing' }
}
