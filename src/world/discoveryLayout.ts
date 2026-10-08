import type { OuterBiome } from './biomes'

/**
 * 探検で見つけるもの（ユーザー要望「宝箱・ランドマーク探し」）。
 * - 名所（SIGHTS）：各地帯に 1 つ。近くへ行くと「◯◯を はっけん！」で図鑑の「はっけん」に記録
 * - 宝箱（CHESTS）：各地帯に 2 こ。車両でさわると開いて、鉱石が 1 こ出てくる。
 *   全部開けると、また閉じた宝箱が出てくる（discoveryStore）
 * どちらも車両はぶつかって止まる（fieldLayout の STATIC_OBSTACLES）。宝箱は、車両の足元の円が触れたら開く。
 */
export type SightId = 'snowman' | 'windmill' | 'pyramid' | 'volcano'

export interface Sight {
  id: SightId
  name: string
  /** お知らせ・図鑑の絵（windmill は合う絵文字がないので SightIcon で絵を描く） */
  emoji: string
  biome: OuterBiome
  x: number
  z: number
  /** ぶつかる半径 [m] */
  r: number
}

export const SIGHTS: readonly Sight[] = [
  { id: 'snowman', name: 'おおきな ゆきだるま', emoji: '⛄', biome: 'snow', x: -24, z: 130, r: 2.6 },
  { id: 'windmill', name: 'かざぐるまの とう', emoji: '', biome: 'forest', x: -150, z: -62, r: 2.6 },
  { id: 'pyramid', name: 'ピラミッド', emoji: '🔺', biome: 'desert', x: -30, z: -156, r: 8.5 },
  { id: 'volcano', name: 'ちいさな かざん', emoji: '🌋', biome: 'rocky', x: 148, z: 40, r: 9 },
]

/** この距離 [m] まで近づくと「はっけん」 */
export const SIGHT_DISCOVER_RADIUS = 24

export interface Chest {
  id: string
  biome: OuterBiome
  x: number
  z: number
  /** 向き [rad] */
  rotation: number
}

export const CHESTS: readonly Chest[] = [
  { id: 'chest-snow-1', biome: 'snow', x: 40, z: 160, rotation: 0.4 },
  { id: 'chest-snow-2', biome: 'snow', x: -95, z: 150, rotation: -0.6 },
  { id: 'chest-forest-1', biome: 'forest', x: -162, z: -22, rotation: 1.2 },
  { id: 'chest-forest-2', biome: 'forest', x: -110, z: 62, rotation: -0.3 },
  { id: 'chest-desert-1', biome: 'desert', x: 92, z: -150, rotation: 2.4 },
  { id: 'chest-desert-2', biome: 'desert', x: -96, z: -128, rotation: 0.9 },
  { id: 'chest-rocky-1', biome: 'rocky', x: 160, z: -82, rotation: -1.4 },
  { id: 'chest-rocky-2', biome: 'rocky', x: 118, z: 112, rotation: 0.2 },
]

/** 宝箱のぶつかる半径 [m] */
export const CHEST_RADIUS = 0.9
/** 車両の足元の円が、ぶつかる所からこれだけ手前まで来たら開く [m] */
export const CHEST_TOUCH_MARGIN = 0.6
