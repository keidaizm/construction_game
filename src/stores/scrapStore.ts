import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** 1 回で運んだことにする間隔 [s]（荷台からまとめて落ちた鉄骨は、同じ回の数にする） */
const SAME_LOAD_WITHIN = 3

/**
 * てっこつ集め（Lv7）の記録。ブラウザ（localStorage）に保存する。
 * - steel：持っている てっこつ（Lv8・9 で塔やビルを建てるのに使う予定）
 * - target / loads：いまのお題（「てっこつを 5ほん あつめよう」）と、運んだ回ごとの数（2 + 3 = 5 の式にする）
 */
interface ScrapState {
  steel: number
  target: number
  loads: number[]
  /** 最後に 1 本数えた時刻 [ms]（同じ回かどうか） */
  lastAt: number
  /** クリアした回の式（お祝いの画面。閉じたら null） */
  cleared: { loads: number[]; target: number } | null
  /** リサイクル場で鉄骨を 1 本数えた。お題をクリアしたら true */
  deliver: () => boolean
  /** てっこつを n 本使う（ビル・タワーづくり）。足りなければ使わずに false */
  spendSteel: (n: number) => boolean
  /** お祝いを閉じて、次のお題へ */
  nextQuest: () => void
  resetScrap: () => void
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

/** お題の本数（ビル 1 つで 6 本出る。前と同じ数が続かないように） */
function pickTarget(previous: number) {
  for (;;) {
    const n = 3 + Math.floor(Math.random() * 4)
    if (n !== previous) return n
  }
}

export const useScrapStore = create<ScrapState>()(
  persist(
    (set, get) => ({
      steel: 0,
      target: 3,
      loads: [],
      lastAt: 0,
      cleared: null,
      deliver: () => {
        const s = get()
        const now = Date.now()
        const loads = [...s.loads]
        if (loads.length > 0 && now - s.lastAt < SAME_LOAD_WITHIN * 1000) loads[loads.length - 1]++
        else loads.push(1)
        const total = loads.reduce((n, k) => n + k, 0)
        if (total >= s.target) {
          set({ steel: s.steel + 1, loads: [], lastAt: 0, cleared: { loads, target: s.target }, target: pickTarget(s.target) })
          return true
        }
        set({ steel: s.steel + 1, loads, lastAt: now })
        return false
      },
      spendSteel: (n) => {
        if (get().steel < n) return false
        set({ steel: get().steel - n })
        return true
      },
      nextQuest: () => set({ cleared: null }),
      resetScrap: () => set({ steel: 0, target: 3, loads: [], lastAt: 0, cleared: null }),
    }),
    { name: 'kenki-asobi-scrap', storage: safeStorage, partialize: (s) => ({ steel: s.steel, target: s.target, loads: s.loads }) },
  ),
)

// 保護者向け：URL に ?reset-progress を付けて開くと、てっこつも消す
if (new URLSearchParams(location.search).has('reset-progress')) useScrapStore.getState().resetScrap()
