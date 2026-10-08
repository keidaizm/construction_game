import { create } from 'zustand'
import { levelForStars, pickMission, type Mission, type MissionKind, type MissionPart } from '../missions/levels'
import type { RockColor } from '../cargo/rocks/rockTypes'
import { audio } from '../audio/AudioManager'
import { useGameStore } from './gameStore'
import { useProgressStore } from './progressStore'

/** 1 回ぶんの運搬（足し算の式の 1 つの数） */
export interface Load {
  batchId: number
  count: number
}

/** おきばの円の中にある岩 1 個ぶんの情報 */
export interface ZoneRock {
  batchId: number
  color: RockColor
}

/**
 * - playing : 運んでいる最中（多すぎるときも playing のまま。ショベルで取り除けばよい）
 * - cleared : ぴったり運べた
 */
export type MissionStatus = 'playing' | 'cleared'

/** もらった星の内訳（クリア画面で表示） */
export interface StarResult {
  clear: boolean
  /** 一度も多すぎにならずに運べた */
  neverOver: boolean
  /** 2 回以上に分けて運んだ（足し算の式ができた） */
  equation: boolean
}

export type ColorCounts = Partial<Record<RockColor, number>>

interface MissionState {
  /** ミッションの種類（はこぼう・つくろう・とりのぞこう） */
  kind: MissionKind
  /** はこぼう のときの色と数（くろい いし 3こ ＋ ふつうの いし 2こ など） */
  parts: MissionPart[]
  /** 最後におきばにある数（ぴったりの目標） */
  target: number
  /** とりのぞこう のとき、はじめにおきばにある数 */
  startCount: number
  /** とりのぞこう のはじめの石を、おきばに並べる必要があるか（MissionSetup が並べる） */
  needsSetup: boolean
  /** いまおきばにある（数える対象の）岩の、運んだ回ごとの個数（運んだ順） */
  loads: Load[]
  /** いまおきばにある岩の、色ごとの数（数えない色も含む） */
  colorCounts: ColorCounts
  /** いまおきばにある、数える対象の岩の合計（はこぼう はミッションの色だけ、ほかは全部） */
  delivered: number
  status: MissionStatus
  /** このミッションで一度でも（落ち着いた状態で）多すぎになったか */
  wasOver: boolean
  /** おきばの中身が最後に変わった時刻（performance.now()）。0 = 判定待ちなし */
  pendingSince: number
  stars: StarResult | null
  /** このクリアでレベルが上がったら新しいレベル番号 */
  levelUp: number | null
  /** いまおきばの円の中にある岩の一覧を知らせる（毎回数え直す。転がり出たら減る） */
  setZoneContents: (rocks: ZoneRock[]) => void
  /** 中身が落ち着いたら呼ぶ。ぴったりならクリア（多すぎ・足りないなら続ける） */
  judge: () => void
  /** 次のミッションへ（車両と岩も最初の状態に戻す） */
  next: () => void
  /** 進み具合だけ消す（はじめから） */
  restart: () => void
}

/** おきばの中身が変わってから、この時間 [ms] 変化がなければ判定する（降ろした岩が全部止まるのを待つ） */
export const JUDGE_DELAY_MS = 1500

const currentLevel = () => levelForStars(useProgressStore.getState().stars)

/** その色は、あと何こ必要か（負なら多すぎ）。ミッションにない色は 0 から数える */
export function remainingOf(parts: readonly MissionPart[], counts: ColorCounts, color: RockColor): number {
  return (parts.find((p) => p.color === color)?.count ?? 0) - (counts[color] ?? 0)
}

/**
 * ミッションの種類に合わせた「その色はあと何こ入れてよいか」（負なら多すぎ）。
 * はこぼう は色ごと、つくろう・とりのぞこう は色に関係なく合計で見る。
 */
export function remainingFor(m: { kind: MissionKind; parts: readonly MissionPart[]; colorCounts: ColorCounts; target: number; delivered: number }) {
  return (color: RockColor) => {
    if (m.kind !== 'carry') return m.target - m.delivered
    // ミッションにない色は数えないので、いくつあってもよい
    return m.parts.some((p) => p.color === color) ? remainingOf(m.parts, m.colorCounts, color) : Infinity
  }
}

/** おきばに入っている色の数（つくろう は 2 しゅるい以上が条件） */
export const colorKinds = (counts: ColorCounts) => Object.values(counts).filter((n) => (n ?? 0) > 0).length

/** 多すぎる色（ミッションの色だけを見る。ほかの色は数えないので多すぎにならない） */
export function overColors(parts: readonly MissionPart[], counts: ColorCounts): RockColor[] {
  return parts.map((p) => p.color).filter((c) => remainingOf(parts, counts, c) < 0)
}

/** はこぼう で数えない（ミッションにない）色の石が、おきばに何こあるか */
export function ignoredCount(parts: readonly MissionPart[], counts: ColorCounts): number {
  return (Object.keys(counts) as RockColor[]).filter((c) => !parts.some((p) => p.color === c)).reduce((n, c) => n + (counts[c] ?? 0), 0)
}

/** 最初のミッションは、いちばん分かりやすい「はこぼう」にする */
function firstMission(): Mission {
  for (let i = 0; i < 20; i++) {
    const m = pickMission(currentLevel(), null)
    if (m.kind === 'carry') return m
  }
  return pickMission(currentLevel(), null)
}
const first = firstMission()

export const useMissionStore = create<MissionState>((set, get) => ({
  kind: first.kind,
  parts: first.parts,
  target: first.target,
  startCount: first.startCount,
  needsSetup: first.kind === 'remove',
  loads: [],
  colorCounts: {},
  delivered: 0,
  status: 'playing',
  wasOver: false,
  pendingSince: 0,
  stars: null,
  levelUp: null,

  setZoneContents: (rocks) => {
    const s = get()
    if (s.status !== 'playing') return
    // はこぼう はミッションの色の石だけを数える（掘って出た色の石などがまざっても気にしなくてよい）
    const counted = s.kind === 'carry' ? rocks.filter((r) => s.parts.some((p) => p.color === r.color)) : rocks
    const byBatch = new Map<number, number>()
    const colorCounts: ColorCounts = {}
    for (const r of counted) byBatch.set(r.batchId, (byBatch.get(r.batchId) ?? 0) + 1)
    for (const r of rocks) colorCounts[r.color] = (colorCounts[r.color] ?? 0) + 1
    // 前からある回は元の順番のまま、新しい回は後ろに足す（式の並びが入れ替わらないように）
    const order = s.loads.map((l) => l.batchId).filter((id) => byBatch.has(id))
    for (const id of [...byBatch.keys()].sort((a, b) => a - b)) if (!order.includes(id)) order.push(id)
    const loads = order.map((id) => ({ batchId: id, count: byBatch.get(id)! }))
    const sameLoads =
      loads.length === s.loads.length && loads.every((l, i) => l.batchId === s.loads[i].batchId && l.count === s.loads[i].count)
    const colors = new Set([...Object.keys(colorCounts), ...Object.keys(s.colorCounts)]) as Set<RockColor>
    const sameColors = [...colors].every((c) => (colorCounts[c] ?? 0) === (s.colorCounts[c] ?? 0))
    if (sameLoads && sameColors) return
    set({ loads, colorCounts, delivered: counted.length, pendingSince: performance.now() })
  },

  judge: () => {
    const s = get()
    if (s.status !== 'playing' || s.pendingSince === 0) return
    const exact =
      (s.kind === 'carry' ? s.parts.every((p) => (s.colorCounts[p.color] ?? 0) === p.count) : s.delivered === s.target) &&
      (s.kind !== 'make' || colorKinds(s.colorCounts) >= 2)
    if (!exact) {
      // 足りない → 続けて運ぶ／多すぎる → ショベルで取り除く（どちらもミッションは続く）
      // とりのぞこう は「とりすぎ（目標より少ない）」が失敗扱い
      const over =
        s.kind === 'carry' ? overColors(s.parts, s.colorCounts).length > 0 : s.kind === 'make' ? s.delivered > s.target : s.delivered < s.target
      set({ pendingSince: 0, wasOver: s.wasOver || over })
      return
    }
    // 3 つめの星：はこぼう・つくろう は 2 回以上に分けて運んだら、とりのぞこう はひき算の式ができたらもらえる
    const stars: StarResult = { clear: true, neverOver: !s.wasOver, equation: s.kind === 'remove' || s.loads.length >= 2 }
    const earned = Number(stars.clear) + Number(stars.neverOver) + Number(stars.equation)
    const levelUp = useProgressStore.getState().addStars(earned)
    audio.play('missionClear')
    set({ status: 'cleared', pendingSince: 0, stars, levelUp })
  },

  next: () => {
    const s = get()
    const m = pickMission(currentLevel(), { kind: s.kind, parts: s.parts, target: s.target, startCount: s.startCount })
    set({ kind: m.kind, parts: m.parts, target: m.target, startCount: m.startCount })
    useGameStore.getState().requestReset() // → 下の購読で進み具合もリセットされる
  },

  restart: () =>
    set((s) => ({
      loads: [],
      colorCounts: {},
      delivered: 0,
      status: 'playing',
      wasOver: false,
      pendingSince: 0,
      stars: null,
      levelUp: null,
      needsSetup: s.kind === 'remove',
    })),
}))

// 「はじめから」（↻ ボタン・R キー）で岩が戻るので、数えた記録も消す
useGameStore.subscribe((s, prev) => {
  if (s.resetToken !== prev.resetToken) useMissionStore.getState().restart()
})
