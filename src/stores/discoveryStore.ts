import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CHESTS, type SightId } from '../world/discoveryLayout'

/**
 * 探検で見つけたもの（名所・開けた宝箱）。ブラウザ（localStorage）に保存する。
 * 宝箱は全部開けると、また全部閉じる（chestRound が 1 増える＝図鑑に「◯かいめ」）。
 */
interface DiscoveryState {
  sights: SightId[]
  openedChests: string[]
  /** 宝箱を全部開けた回数 */
  chestRound: number
  /** 名所を見つけた。初めてなら true */
  discoverSight: (id: SightId) => boolean
  /** 宝箱を開けた。まだ開いていなかったら true */
  openChest: (id: string) => boolean
  resetDiscoveries: () => void
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

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set, get) => ({
      sights: [],
      openedChests: [],
      chestRound: 0,
      discoverSight: (id) => {
        if (get().sights.includes(id)) return false
        set({ sights: [...get().sights, id] })
        return true
      },
      openChest: (id) => {
        const { openedChests } = get()
        if (openedChests.includes(id)) return false
        set({ openedChests: [...openedChests, id] })
        return true
      },
      resetDiscoveries: () => set({ sights: [], openedChests: [], chestRound: 0 }),
    }),
    { name: 'kenki-asobi-discoveries', storage: safeStorage },
  ),
)

/** 全部開いていたら、また閉じる（宝箱が開くアニメーションのあとで呼ぶ） */
export function refillChestsIfAllOpen() {
  const s = useDiscoveryStore.getState()
  if (s.openedChests.length >= CHESTS.length) useDiscoveryStore.setState({ openedChests: [], chestRound: s.chestRound + 1 })
}

// 保護者向け：URL に ?reset-progress を付けて開くと、見つけた記録も消す
if (new URLSearchParams(location.search).has('reset-progress')) useDiscoveryStore.getState().resetDiscoveries()
