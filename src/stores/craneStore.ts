import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useProgressStore } from './progressStore'
import { levelForStars } from '../missions/levels'

/**
 * クレーンのミニゲームの状態。
 * - game：null = 乗ったばかりでえらぶ画面、'containers' = コンテナはこび、'tower' = つみきタワー
 * - コンテナはこび：台の式（a + b など）に合う数字のコンテナを台にのせる
 * - つみきタワー：いまの高さと、さいこう記録（保存する）
 */
export type CraneGame = 'containers' | 'tower'

/** 式の種類：たし算・ひき算・かけ算 */
export type MathOp = '+' | '−' | '×'

export interface ContainerQuestion {
  op: MathOp
  a: number
  b: number
  /** コンテナに書く数字（答えを 1 つふくむ） */
  options: number[]
}

interface CraneState {
  game: CraneGame | null
  setGame: (game: CraneGame | null) => void
  /** つかむ／はなすボタンを押した回数（コントローラが増えたのを見て動く） */
  grabPresses: number
  pressGrab: () => void
  /** いまつかめる荷物がフックの下にあるか（ボタンを光らせる） */
  canGrab: boolean
  holding: boolean
  setGrabState: (canGrab: boolean, holding: boolean) => void

  question: ContainerQuestion
  solved: number
  /** 台にのせた結果（せいかい・ちがう数）。次の問題で消える */
  feedback: { kind: 'correct' | 'wrong'; number: number } | null
  setFeedback: (f: CraneState['feedback']) => void
  nextQuestion: () => void

  towerHeight: number
  towerBest: number
  setTowerHeight: (h: number) => void
  setTowerBest: (h: number) => void
}

const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // 保存できなくても遊びは続けられる
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // 何もしない
    }
  },
}))

/** コンテナの数（台に並べる数） */
export const CONTAINER_COUNT = 5

/** 2けたの たし算が出るレベル／ひき算／1けたの かけ算（ユーザー要望） */
export const CRANE_ADD2_LEVEL = 4
export const CRANE_SUB_LEVEL = 6
export const CRANE_MUL_LEVEL = 8

export const answerOf = (q: Pick<ContainerQuestion, 'op' | 'a' | 'b'>) => (q.op === '+' ? q.a + q.b : q.op === '−' ? q.a - q.b : q.a * q.b)

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

/** 問題の種類（レベルで増える）。どれも同じくらいの割合で出る */
type Kind = 'add1' | 'add2' | 'sub' | 'mul'

function makeExpression(kind: Kind): Pick<ContainerQuestion, 'op' | 'a' | 'b'> {
  switch (kind) {
    case 'add1': {
      // 答えが 2〜10 のたし算（はじめから）
      const answer = randInt(2, 10)
      const a = randInt(1, answer - 1)
      return { op: '+', a, b: answer - a }
    }
    case 'add2': {
      // 2けたの たし算（答えは 99 まで）。2けた ＋ 1けた と 2けた ＋ 2けた を半分ずつ
      const a = randInt(10, 79)
      const b = Math.random() < 0.5 ? randInt(2, 9) : randInt(10, Math.min(89, 99 - a))
      return { op: '+', a, b: Math.min(b, 99 - a) }
    }
    case 'sub': {
      // ひき算（答えは 1 以上）。1けた・10 までと、2けたを半分ずつ
      if (Math.random() < 0.5) {
        const a = randInt(3, 10)
        return { op: '−', a, b: randInt(1, a - 1) }
      }
      const a = randInt(11, 99)
      return { op: '−', a, b: randInt(2, Math.min(a - 1, 50)) }
    }
    case 'mul': {
      // 1けたの かけ算（2〜9 の段）
      return { op: '×', a: randInt(2, 9), b: randInt(2, 9) }
    }
  }
}

/**
 * まちがいの数（コンテナ 4 つぶん）：答えの近くの数と、よくあるまちがい（ひき算・かけ算で たしてしまう など）。
 * 答えが 10 までなら 1〜10 から（前と同じ）。どれも 0 より大きく、かさならない
 */
function distractors(q: Pick<ContainerQuestion, 'op' | 'a' | 'b'>, answer: number) {
  const nums = new Set([answer])
  const add = (n: number) => {
    if (nums.size < CONTAINER_COUNT && Number.isInteger(n) && n > 0 && n <= 99) nums.add(n)
  }
  if (answer <= 10 && q.op === '+') {
    while (nums.size < CONTAINER_COUNT) add(randInt(1, 10))
  } else {
    const likely = [q.op === '+' ? Math.abs(q.a - q.b) : q.a + q.b, answer + 10, answer - 10, answer + 1, answer - 1]
    for (const n of likely.sort(() => Math.random() - 0.5).slice(0, 2)) add(n)
    while (nums.size < CONTAINER_COUNT) add(answer + randInt(-12, 12))
  }
  return [...nums].sort(() => Math.random() - 0.5)
}

/** 新しい問題：レベルで出る式が増える（Lv4 から 2けたの たし算、Lv6 から ひき算、Lv8 から 1けたの かけ算） */
export function makeQuestion(): ContainerQuestion {
  const level = levelForStars(useProgressStore.getState().stars).level
  const kinds: Kind[] = ['add1']
  if (level >= CRANE_ADD2_LEVEL) kinds.push('add2')
  if (level >= CRANE_SUB_LEVEL) kinds.push('sub')
  if (level >= CRANE_MUL_LEVEL) kinds.push('mul')
  const expr = makeExpression(kinds[randInt(0, kinds.length - 1)])
  return { ...expr, options: distractors(expr, answerOf(expr)) }
}

export const useCraneStore = create<CraneState>()(
  persist(
    (set) => ({
      game: null,
      setGame: (game) => set({ game, feedback: null }),
      grabPresses: 0,
      pressGrab: () => set((s) => ({ grabPresses: s.grabPresses + 1 })),
      canGrab: false,
      holding: false,
      setGrabState: (canGrab, holding) => set({ canGrab, holding }),

      question: makeQuestion(),
      solved: 0,
      feedback: null,
      setFeedback: (feedback) => set({ feedback }),
      nextQuestion: () => set((s) => ({ question: makeQuestion(), feedback: null, solved: s.solved + 1 })),

      towerHeight: 0,
      towerBest: 0,
      setTowerHeight: (towerHeight) => set({ towerHeight }),
      setTowerBest: (towerBest) => set({ towerBest }),
    }),
    { name: 'kenki-asobi-crane', storage: safeStorage, partialize: (s) => ({ towerBest: s.towerBest }) },
  ),
)
