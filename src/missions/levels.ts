import { rocksAvailable } from '../cargo/rocks/rockSites'
import { ROCK_COLOR_ORDER, type RockColor } from '../cargo/rocks/rockTypes'

/**
 * レベル（グレードアップ）の設定。星を集めるとレベルが上がり、
 * バケットが大きくなって一度に運べる数が増え、ミッションの数と色の種類も増える。
 */
export interface LevelConfig {
  level: number
  /** このレベルになるのに必要な星の合計 */
  starsRequired: number
  /** バケットの大きさ（見た目・当たり判定の倍率） */
  bucketScale: number
  /** 一度にすくえる最大の数（BUCKET_SLOTS_BY_CAPACITY のキー） */
  bucketCapacity: 3 | 5 | 8
  /** ミッションの合計の範囲 [最小, 最大] */
  targetRange: readonly [number, number]
  /** 1 つのミッションで集める色の数の範囲 [最小, 最大] */
  colorRange: readonly [number, number]
  /** バケットの差し色（レベルが上がったのが見て分かるように） */
  bucketAccent: string
  /**
   * ショベル（本体・ブーム・アーム）の大きさの倍率。Lv5 から重ダンプに合わせて 1.3 倍（ユーザー要望）。
   * バケットの大きさ（bucketScale）は、ショベルが大きくなっても変えない
   */
  excavatorScale: number
}

export const LEVELS: readonly LevelConfig[] = [
  { level: 1, starsRequired: 0, bucketScale: 1, bucketCapacity: 3, targetRange: [3, 5], colorRange: [1, 1], bucketAccent: '#3b3d40', excavatorScale: 1 },
  { level: 2, starsRequired: 9, bucketScale: 1.3, bucketCapacity: 5, targetRange: [5, 10], colorRange: [1, 2], bucketAccent: '#2f80ed', excavatorScale: 1 },
  { level: 3, starsRequired: 24, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#e0a000', excavatorScale: 1 },
  // Lv4：バケットと数は Lv3 のまま。ショベルのアタッチメントを油圧ブレーカーに付けかえられる（大きな岩を割れる）
  { level: 4, starsRequired: 36, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#d64545', excavatorScale: 1 },
  // Lv5：ブルドーザーで外がわの木を倒せる（木材が出る）／ Lv6：ショベルにグラップル（木材をつかんで運び、家を建てる）
  { level: 5, starsRequired: 44, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#2fbf5b', excavatorScale: 1.3 },
  { level: 6, starsRequired: 52, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#9b51e0', excavatorScale: 1.3 },
  // Lv7：基地の南に古いビルが出る。ブレーカーでこわし、スケルトンバケットでふるって、てっこつを集める
  { level: 7, starsRequired: 60, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#00a3a3', excavatorScale: 1.3 },
  // Lv8：てっこつと石でビルを建てる／ Lv9：てっこつと石でタワー（東京タワーのような）を建てる
  { level: 8, starsRequired: 68, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#2f80ed', excavatorScale: 1.3 },
  { level: 9, starsRequired: 76, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#e8562a', excavatorScale: 1.3 },
  // Lv10：屋上のクレーンで鉄骨をつり上げて、ビルをどんどん高くする（クライミングクレーン）
  { level: 10, starsRequired: 84, bucketScale: 1.6, bucketCapacity: 8, targetRange: [10, 20], colorRange: [2, 3], bucketAccent: '#ffc400', excavatorScale: 1.3 },
]

/** 油圧ブレーカーが使えるレベル */
export const BREAKER_LEVEL = 4
/** ダンプが大きな重ダンプになるレベル */
export const BIG_TRUCK_LEVEL = 5
/** ブルドーザーで木を倒せるレベル */
export const FELL_LEVEL = 5
/** グラップル（木材をつかむ）が使えるレベル。ここから木材は消えずに残る */
export const GRAPPLE_LEVEL = 6
/** 古いビルが出て、こわせるレベル（スケルトンバケット・てっこつ集め） */
export const DEMOLISH_LEVEL = 7
/** てっこつと石でビルを建てられるレベル */
export const OFFICE_LEVEL = 8
/** てっこつと石でタワーを建てられるレベル */
export const TOWER_LEVEL = 9
/** 屋上のクレーンで、ビルをどんどん高くできるレベル */
export const SKYSCRAPER_LEVEL = 10

export function levelForStars(stars: number): LevelConfig {
  let result = LEVELS[0]
  for (const l of LEVELS) if (stars >= l.starsRequired) result = l
  return result
}

/** 次のレベル（最高レベルなら null） */
export function nextLevel(level: number): LevelConfig | null {
  return LEVELS.find((l) => l.level === level + 1) ?? null
}

/** ミッションの 1 色ぶん（くろい いし 3こ など） */
export interface MissionPart {
  color: RockColor
  count: number
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const signature = (parts: readonly MissionPart[]) => parts.map((p) => `${p.color}${p.count}`).join(',')

/**
 * 「はこぼう」の中身を決める（くろい いし 3こ ＋ ふつうの いし 2こ など）。
 * - 合計はレベルの範囲から、色の数もレベルの範囲から選ぶ
 * - 1 色あたりの数は、その色の岩の数より少し少なく（取りこぼしがあっても足りるように）
 * - 前回とまったく同じミッションは避ける（何度遊んでも変化があるように）
 */
function pickCarryParts(level: LevelConfig, previous: readonly MissionPart[] | null): MissionPart[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const colorCount = randInt(level.colorRange[0], level.colorRange[1])
    const colors = shuffle(ROCK_COLOR_ORDER).slice(0, colorCount)
    const total = randInt(Math.max(level.targetRange[0], colorCount), level.targetRange[1])
    // 合計を色に分ける（どの色も 1 こ以上）
    const counts = colors.map(() => 1)
    for (let rest = total - colorCount; rest > 0; rest--) counts[Math.floor(Math.random() * counts.length)]++
    const parts = colors.map((color, i) => ({ color, count: counts[i] }))
    if (parts.some((p) => p.count > rocksAvailable(p.color) - 2)) continue
    // 表示の順番をそろえる（ふつう → くろ → あか → しろ）
    parts.sort((a, b) => ROCK_COLOR_ORDER.indexOf(a.color) - ROCK_COLOR_ORDER.indexOf(b.color))
    if (previous && signature(parts) === signature(previous)) continue
    return parts
  }
  return [{ color: 'gray', count: level.targetRange[0] }]
}

/**
 * ミッションの種類
 * - carry  : はこぼう（色と数が決まっている）
 * - make   : ◯を つくろう（好きな色を 2 しゅるい以上あわせて、合計をぴったりに）
 * - remove : とりのぞこう（おきばにある石を減らして、ぴったりの数にする＝ひき算）
 */
export type MissionKind = 'carry' | 'make' | 'remove'

export interface Mission {
  kind: MissionKind
  /** carry のときの色と数（make・remove は空） */
  parts: MissionPart[]
  /** 最後におきばにある数（ぴったりの目標） */
  target: number
  /** remove のとき、はじめにおきばにある数 */
  startCount: number
}

/** 「◯を つくろう」の合計（レベルごと） */
const MAKE_TARGETS: Record<number, readonly number[]> = { 1: [5], 2: [10], 3: [10, 12, 15, 18, 20] }
/** 「とりのぞこう」の はじめの数・とりのぞく数の範囲（レベルごと） */
const REMOVE_RANGE: Record<number, { start: readonly [number, number]; remove: readonly [number, number] }> = {
  1: { start: [4, 6], remove: [1, 3] },
  2: { start: [7, 10], remove: [2, 5] },
  3: { start: [12, 18], remove: [3, 9] },
}

/**
 * ミッションを決める。種類はだいたい はこぼう 5 割・つくろう 2.5 割・とりのぞこう 2.5 割。
 * 前回と同じ種類が続きすぎないよう、前回が carry 以外なら carry を出やすくする。
 */
export function pickMission(level: LevelConfig, previous: Mission | null): Mission {
  const r = Math.random()
  const carryBias = previous && previous.kind !== 'carry' ? 0.65 : 0.5
  if (r < carryBias) {
    const parts = pickCarryParts(level, previous?.kind === 'carry' ? previous.parts : null)
    return { kind: 'carry', parts, target: parts.reduce((n, p) => n + p.count, 0), startCount: 0 }
  }
  if (r < carryBias + (1 - carryBias) / 2 && previous?.kind !== 'make') {
    const list = MAKE_TARGETS[level.level] ?? [10]
    return { kind: 'make', parts: [], target: list[randInt(0, list.length - 1)], startCount: 0 }
  }
  const range = REMOVE_RANGE[level.level] ?? REMOVE_RANGE[1]
  const start = randInt(range.start[0], range.start[1])
  const remove = Math.min(start - 1, randInt(range.remove[0], range.remove[1]))
  return { kind: 'remove', parts: [], target: start - remove, startCount: start }
}
