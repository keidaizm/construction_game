import type { OreId } from '../cargo/ores/oreTypes'

/**
 * 基地の工房でつくれるもの（ユーザー提案：鉱石を使ったクラフト）。
 * - ペンキ：車の色（車庫で塗れる）。きいろ・あか・あおは、はじめから持っている
 * - かざり：トロフィーなど（事務所の前の展示棚に飾られる）
 * 材料は「持っている鉱石」（図鑑の記録は減らない）。
 * 光るものを映す環境マップがないので、metalness を上げすぎると黒く見える（0.4 くらいまで）。
 */
export type Cost = Partial<Record<OreId, number>>

export interface PaintRecipe {
  id: string
  name: string
  color: string
  metalness: number
  roughness: number
  /** ほんのり光る（キラキラの色） */
  emissive?: string
  /** つくるのに使う鉱石（null = はじめから持っている） */
  cost: Cost | null
}

export const PAINTS: readonly PaintRecipe[] = [
  { id: 'yellow', name: 'きいろ', color: '#f2b705', metalness: 0.15, roughness: 0.55, cost: null },
  { id: 'red', name: 'あか', color: '#d93a2b', metalness: 0.15, roughness: 0.5, cost: null },
  { id: 'blue', name: 'あお', color: '#2f6fd6', metalness: 0.15, roughness: 0.5, cost: null },
  { id: 'green', name: 'みどり', color: '#2faa55', metalness: 0.2, roughness: 0.45, cost: { emerald: 2 } },
  { id: 'purple', name: 'むらさき', color: '#8e4fd6', metalness: 0.25, roughness: 0.45, cost: { lapis: 2, ruby: 1 } },
  { id: 'silver', name: 'ぎんいろ', color: '#d5dae2', metalness: 0.35, roughness: 0.25, emissive: '#2a2e33', cost: { iron: 4 } },
  { id: 'gold', name: 'きんいろ', color: '#ffcf33', metalness: 0.4, roughness: 0.22, emissive: '#4a3300', cost: { gold: 3 } },
  { id: 'pink', name: 'にじいろピンク', color: '#ff9fd6', metalness: 0.3, roughness: 0.3, emissive: '#5a1f44', cost: { opal: 1, copper: 2 } },
  { id: 'diamond', name: 'ダイヤモンド', color: '#a8f0ff', metalness: 0.25, roughness: 0.12, emissive: '#1f5560', cost: { diamond: 2 } },
  { id: 'night', name: 'ほたるの ひかり', color: '#5cf2a6', metalness: 0.2, roughness: 0.35, emissive: '#1f8a55', cost: { fluorite: 1, coal: 3 } },
]

export interface DecorRecipe {
  id: string
  name: string
  emoji: string
  cost: Cost
}

export const DECORATIONS: readonly DecorRecipe[] = [
  { id: 'trophy', name: 'きんの トロフィー', emoji: '🏆', cost: { gold: 3, coal: 2 } },
  { id: 'crown', name: 'ダイヤの かんむり', emoji: '👑', cost: { diamond: 1, gold: 2 } },
  { id: 'dino', name: 'きょうりゅうの もけい', emoji: '🦖', cost: { fossil: 2 } },
  { id: 'star', name: 'ひかる ほし', emoji: '⭐', cost: { starshard: 1, glowstone: 2 } },
  { id: 'robot', name: 'てつの ロボット', emoji: '🤖', cost: { iron: 4, copper: 2 } },
]

/** 車庫で色をかえられる車両 */
export type PaintableVehicle = 'excavator' | 'dumpTruck' | 'bulldozer'
