import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * ビル（Lv8）・タワー（Lv9）づくりの記録。ブラウザ（localStorage）に保存する（建てたものは、次に開いてもそのまま）。
 * - offices：できあがったビルの数 / officeFloors：いま建てているビルの階の数 / officeStones：いまの階に使った石の数
 * - towerStage：できあがったタワーの段の数 / towerStones：いまの段に使った石の数
 */
interface CityState {
  offices: number
  officeFloors: number
  officeStones: number
  towerStage: number
  towerStones: number
  addOfficeStone: () => void
  addTowerStone: () => void
  /** ビルの 1 階ができた。ビルが完成したら true */
  buildOfficeFloor: (floors: number) => boolean
  /** タワーの 1 段ができた */
  buildTowerStage: () => void
  resetCity: () => void
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

export const useCityStore = create<CityState>()(
  persist(
    (set, get) => ({
      offices: 0,
      officeFloors: 0,
      officeStones: 0,
      towerStage: 0,
      towerStones: 0,
      addOfficeStone: () => set({ officeStones: get().officeStones + 1 }),
      addTowerStone: () => set({ towerStones: get().towerStones + 1 }),
      buildOfficeFloor: (floors) => {
        const n = get().officeFloors + 1
        if (n >= floors) {
          set({ offices: get().offices + 1, officeFloors: 0, officeStones: 0 })
          return true
        }
        set({ officeFloors: n, officeStones: 0 })
        return false
      },
      buildTowerStage: () => set({ towerStage: get().towerStage + 1, towerStones: 0 }),
      resetCity: () => set({ offices: 0, officeFloors: 0, officeStones: 0, towerStage: 0, towerStones: 0 }),
    }),
    { name: 'kenki-asobi-city', storage: safeStorage },
  ),
)

// 保護者向け：URL に ?reset-progress を付けて開くと、ビル・タワーも消す
if (new URLSearchParams(location.search).has('reset-progress')) useCityStore.getState().resetCity()
