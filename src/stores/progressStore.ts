import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { BREAKER_LEVEL, levelForStars } from '../missions/levels'

/**
 * 遊んだ記録（集めた星）。ブラウザ（localStorage）に保存し、次に開いたときも続きから遊べる。
 * レベルは星の数から決まる（levelForStars）。
 */
interface ProgressState {
  stars: number
  /** 星を足す。レベルが上がったら新しいレベル番号を返す */
  addStars: (n: number) => number | null
  /**
   * グレードアップのお祝いを見せたいちばん上のレベル。星が増えてこれより上のレベルになったら、
   * どこで星をもらっても（ミッション・クレーン・金色の石・地図など）お祝いを出す（LevelUpCelebration）
   */
  shownLevel: number
  markLevelShown: (level: number) => void
  resetProgress: () => void
}

/** localStorage が使えない環境（プライベートモード等）でも落ちないようにする */
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

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      stars: 0,
      addStars: (n) => {
        const before = levelForStars(get().stars).level
        const stars = get().stars + n
        set({ stars })
        const after = levelForStars(stars).level
        return after > before ? after : null
      },
      shownLevel: 1,
      markLevelShown: (level) => set((s) => ({ shownLevel: Math.max(s.shownLevel, level) })),
      resetProgress: () => set({ stars: 0, shownLevel: 1 }),
    }),
    {
      name: 'kenki-asobi-progress',
      storage: safeStorage,
      version: 1,
      // 前の版の記録：いまのレベルのお祝いは見たことにする。
      // ただし Lv4（ブレーカー）は、ミッション以外で星をもらうとお祝いが出なかったので、もう一度見せる
      migrate: (persisted) => {
        const old = persisted as { stars?: number }
        const level = levelForStars(old.stars ?? 0).level
        return { ...old, shownLevel: level >= BREAKER_LEVEL ? BREAKER_LEVEL - 1 : level } as ProgressState
      },
    },
  ),
)

/** 今のレベルの設定（React コンポーネント用） */
export const useLevel = () => useProgressStore((s) => levelForStars(s.stars))

// 保護者向け：URL に ?reset-progress を付けて開くと、集めた星を消して最初から
if (new URLSearchParams(location.search).has('reset-progress')) useProgressStore.getState().resetProgress()
