/**
 * 岩の大きさの種類。小・中・大などを追加するときはここに足す。
 * 現在は 'medium' のみ使用。
 */
export type RockKind = 'small' | 'medium' | 'large'

export interface RockKindConfig {
  /** おおよその半径 [m] */
  radius: number
  /** 密度（質量 = 密度 × 体積） */
  density: number
}

export const ROCK_KINDS: Record<RockKind, RockKindConfig> = {
  small: { radius: 0.16, density: 2.5 },
  medium: { radius: 0.27, density: 2.5 },
  large: { radius: 0.34, density: 2.5 },
}

/**
 * 岩の色の種類。色別ミッション（くろ 3こ ＋ ふつう 2こ など）と、探検で探す場所に使う。
 * 茶色の地面の上で見分けやすい色にしてある。
 */
export type RockColor = 'gray' | 'black' | 'red' | 'white' | 'gold'

export interface RockColorConfig {
  /** 画面に出す名前（ひらがな。「◯◯ いし」の ◯◯） */
  label: string
  /** 3D の岩の色（数パターンから選んで、同じ色でも少しずつ違って見えるように） */
  shades: readonly string[]
  /** 画面のアイコン・矢印・旗の色 */
  icon: string
  /** アイコンのふちの色 */
  outline: string
}

export const ROCK_COLORS: Record<RockColor, RockColorConfig> = {
  gray: { label: 'ふつうの', shades: ['#8e9096', '#7d7f86', '#9a9288', '#85796c'], icon: '#8e9096', outline: '#3b3d40' },
  black: { label: 'くろい', shades: ['#2c2d31', '#35363b', '#26272b'], icon: '#2c2d31', outline: '#000000' },
  red: { label: 'あかい', shades: ['#b3432b', '#c0503a', '#a63b25'], icon: '#c0503a', outline: '#6d1f10' },
  white: { label: 'しろい', shades: ['#ecebe4', '#e2e0d6', '#f4f3ee'], icon: '#f4f3ee', outline: '#8e8a7c' },
  // ボーナスの宝物（ミッション・矢印には使わない。ROCK_COLOR_ORDER に入れない）
  gold: { label: 'きんいろの', shades: ['#ffc933'], icon: '#ffc933', outline: '#a07000' },
}

/** ミッションで集める色（金色は入れない） */
export const ROCK_COLOR_ORDER: readonly RockColor[] = ['gray', 'black', 'red', 'white']
