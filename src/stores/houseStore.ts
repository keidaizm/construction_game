import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * 家づくり（Lv6）の記録：建てた家の数と、いま建てている家に使った木材の数。ブラウザ（localStorage）に保存する
 * （村は、次に開いてもそのまま）。
 */
interface HouseState {
  built: number
  progress: number
  /** 木材を 1 本使った。家ができたら true */
  addLog: (perHouse: number) => boolean
  resetHouses: () => void
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

export const useHouseStore = create<HouseState>()(
  persist(
    (set, get) => ({
      built: 0,
      progress: 0,
      addLog: (perHouse) => {
        const progress = get().progress + 1
        if (progress >= perHouse) {
          set({ built: get().built + 1, progress: 0 })
          return true
        }
        set({ progress })
        return false
      },
      resetHouses: () => set({ built: 0, progress: 0 }),
    }),
    { name: 'kenki-asobi-houses', storage: safeStorage },
  ),
)

// 保護者向け：URL に ?reset-progress を付けて開くと、村も消す
if (new URLSearchParams(location.search).has('reset-progress')) useHouseStore.getState().resetHouses()
