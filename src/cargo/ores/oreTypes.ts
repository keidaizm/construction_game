/**
 * 掘ると出てくる鉱石（図鑑に集める）。マインクラフトの鉱石を参考にした種類。
 * weight が小さいほど出にくい（レア）。stars は図鑑に出すレア度（1〜5）。
 * onlyAt の鉱石は、その時間帯（夕焼け・夜）に掘ったときだけ出る。
 * onlyIn の鉱石は、その地帯の宝の山（フィールドの外側）を掘ったときだけ出る。
 * fromBoulder の鉱石は、大きな岩を油圧ブレーカーで割ったときだけ出る（Lv4）。
 */
import type { TimeOfDay } from '../../stores/gameStore'
import type { OuterBiome } from '../../world/biomes'

export type OreId = 'coal' | 'iron' | 'copper' | 'gold' | 'lapis' | 'ruby' | 'emerald' | 'diamond' | 'fossil' | 'glowstone' | 'amethyst' | 'fluorite' | 'amber' | 'sunstone' | 'opal' | 'icecrystal' | 'jade' | 'desertrose' | 'obsidian' | 'geode' | 'meteorite' | 'starshard'

export interface OreType {
  id: OreId
  /** 図鑑・お知らせに出す名前（ひらがな・カタカナ） */
  name: string
  /** 宝石の色 */
  color: string
  /** 光り方（レアなものほど光らせる） */
  glow: number
  /** 出やすさ（ブロック 1 こあたりの確率 [%]） */
  weight: number
  /** レア度（図鑑の★の数） */
  stars: number
  /** この時間帯に掘ったときだけ出る */
  onlyAt?: Exclude<TimeOfDay, 'day'>
  /** この地帯の宝の山を掘ったときだけ出る */
  onlyIn?: OuterBiome
  /** 大きな岩を割ったときだけ出る */
  fromBoulder?: boolean
}

export const ORES: readonly OreType[] = [
  { id: 'coal', name: 'せきたん', color: '#2b2b2b', glow: 0, weight: 3.5, stars: 1 },
  { id: 'iron', name: 'てっこうせき', color: '#d8a47f', glow: 0.05, weight: 2.5, stars: 1 },
  { id: 'copper', name: 'どうこうせき', color: '#e07a4b', glow: 0.1, weight: 1.6, stars: 2 },
  { id: 'gold', name: 'きん', color: '#ffd23f', glow: 0.35, weight: 0.9, stars: 3 },
  { id: 'lapis', name: 'ラピスラズリ', color: '#2f5fd0', glow: 0.35, weight: 0.6, stars: 3 },
  { id: 'ruby', name: 'ルビー', color: '#e0204f', glow: 0.45, weight: 0.4, stars: 4 },
  { id: 'emerald', name: 'エメラルド', color: '#1fcf6b', glow: 0.5, weight: 0.3, stars: 4 },
  { id: 'fossil', name: 'きょうりゅうの ほね', color: '#efe6cf', glow: 0.2, weight: 0.2, stars: 5 },
  { id: 'diamond', name: 'ダイヤモンド', color: '#7ff3ff', glow: 0.7, weight: 0.25, stars: 5 },
  // 夕焼けだけ（夕日の色）
  { id: 'amber', name: 'こはく', color: '#ffae2b', glow: 0.6, weight: 1.5, stars: 3, onlyAt: 'dusk' },
  { id: 'sunstone', name: 'サンストーン', color: '#ff7038', glow: 0.8, weight: 0.8, stars: 4, onlyAt: 'dusk' },
  { id: 'opal', name: 'にじいろ オパール', color: '#ffb8e1', glow: 0.9, weight: 0.4, stars: 5, onlyAt: 'dusk' },
  // 夜だけ（暗やみで光る）
  { id: 'glowstone', name: 'グロウストーン', color: '#ffd45e', glow: 1.2, weight: 1.5, stars: 3, onlyAt: 'night' },
  { id: 'amethyst', name: 'アメジスト', color: '#b46cff', glow: 1.1, weight: 0.8, stars: 4, onlyAt: 'night' },
  { id: 'fluorite', name: 'ほたるいし', color: '#6dffb4', glow: 1.3, weight: 0.4, stars: 5, onlyAt: 'night' },
  // 宝の山だけ（その地帯の宝の山を掘ると出る）
  { id: 'icecrystal', name: 'こおりの けっしょう', color: '#a8e8ff', glow: 0.8, weight: 4, stars: 4, onlyIn: 'snow' },
  { id: 'jade', name: 'ひすい', color: '#3fbf86', glow: 0.6, weight: 4, stars: 4, onlyIn: 'forest' },
  { id: 'desertrose', name: 'さばくの バラ', color: '#e8a27c', glow: 0.5, weight: 4, stars: 4, onlyIn: 'desert' },
  { id: 'obsidian', name: 'こくようせき', color: '#4a3470', glow: 0.7, weight: 4, stars: 4, onlyIn: 'rocky' },
  // 大きな岩を割ったときだけ（weight は割ったとき 1 回あたりの [%]）
  { id: 'geode', name: 'ジオード', color: '#c58cff', glow: 0.7, weight: 30, stars: 3, fromBoulder: true },
  { id: 'meteorite', name: 'いんせき', color: '#6b6f7a', glow: 0.5, weight: 16, stars: 4, fromBoulder: true },
  { id: 'starshard', name: 'ほしの かけら', color: '#fff27a', glow: 1.4, weight: 7, stars: 5, fromBoulder: true },
]

export const oreById = (id: OreId) => ORES.find((o) => o.id === id)!
