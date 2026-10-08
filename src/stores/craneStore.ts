import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * クレーンのミニゲームの状態。
 * - game：null = 乗ったばかりでえらぶ画面、'containers' = コンテナはこび、'tower' = つみきタワー
 * - コンテナはこび：台の式（a + b）に合う数字のコンテナを台にのせる
 * - つみきタワー：いまの高さと、さいこう記録（保存する）
 */
export type CraneGame = 'containers' | 'tower'

export interface ContainerQuestion {
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

/** 新しい問題：答えは 2〜10、コンテナの数字は答え＋ちがう数 4 つ（1〜10、かさならない） */
export function makeQuestion(): ContainerQuestion {
  const answer = 2 + Math.floor(Math.random() * 9)
  const a = 1 + Math.floor(Math.random() * (answer - 1))
  const nums = new Set([answer])
  while (nums.size < CONTAINER_COUNT) nums.add(1 + Math.floor(Math.random() * 10))
  const options = [...nums].sort(() => Math.random() - 0.5)
  return { a, b: answer - a, options }
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
