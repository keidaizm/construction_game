import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { oreById, type OreId } from '../cargo/ores/oreTypes'
import { useToastStore } from './toastStore'

/**
 * 図鑑（見つけた鉱石の数）。ブラウザ（localStorage）に保存する。
 * lastFind は画面の「◯◯ を みつけた！」のお知らせ用（保存しない）。
 */
interface CollectionState {
  counts: Partial<Record<OreId, number>>
  lastFind: { ore: OreId; isNew: boolean; at: number } | null
  /** いま持っている鉱石の数（工房のクラフトで使うと減る。図鑑の counts は減らない） */
  held: Partial<Record<OreId, number>>
  /** 鉱石を見つけた。初めてなら true */
  add: (ore: OreId) => boolean
  /** 持っている鉱石を使う。足りなければ何もせず false */
  spend: (cost: Partial<Record<OreId, number>>) => boolean
  resetCollection: () => void
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

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      counts: {},
      held: {},
      lastFind: null,
      add: (ore) => {
        const before = get().counts[ore] ?? 0
        set({
          counts: { ...get().counts, [ore]: before + 1 },
          held: { ...get().held, [ore]: (get().held[ore] ?? 0) + 1 },
          lastFind: { ore, isNew: before === 0, at: performance.now() },
        })
        const o = oreById(ore)
        useToastStore.getState().show({ title: o.name + ' を みつけた！', icon: 'gem', color: o.color, stars: o.stars, isNew: before === 0 })
        return before === 0
      },
      spend: (cost) => {
        const held = { ...get().held }
        for (const [ore, n] of Object.entries(cost) as Array<[OreId, number]>) if ((held[ore] ?? 0) < n) return false
        for (const [ore, n] of Object.entries(cost) as Array<[OreId, number]>) held[ore] = (held[ore] ?? 0) - n
        set({ held })
        return true
      },
      resetCollection: () => set({ counts: {}, held: {}, lastFind: null }),
    }),
    {
      name: 'kenki-asobi-collection',
      storage: safeStorage,
      partialize: (s) => ({ counts: s.counts, held: s.held }),
      version: 1,
      // 前の版の記録：持っている数 ＝ 見つけた数
      migrate: (persisted) => {
        const old = persisted as { counts?: Partial<Record<OreId, number>> }
        return { counts: old.counts ?? {}, held: { ...(old.counts ?? {}) } } as CollectionState
      },
    },
  ),
)

// 保護者向け：URL に ?reset-progress を付けて開くと、図鑑も消す
if (new URLSearchParams(location.search).has('reset-progress')) useCollectionStore.getState().resetCollection()
