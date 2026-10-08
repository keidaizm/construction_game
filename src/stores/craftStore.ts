import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { PAINTS, type Cost, type PaintableVehicle } from '../base/craftRecipes'
import { useCollectionStore } from './collectionStore'

/**
 * 工房でつくったもの（ペンキ・かざり）と、車庫で塗った車の色。ブラウザ（localStorage）に保存する。
 */
interface CraftState {
  /** 持っているペンキ（はじめから持っている色は入れなくてよい） */
  paints: string[]
  decorations: string[]
  vehicleColors: Record<PaintableVehicle, string>
  /** 鉱石を使ってつくる。足りなければ false */
  craft: (kind: 'paint' | 'decor', id: string, cost: Cost) => boolean
  setColor: (vehicle: PaintableVehicle, paint: string) => void
  resetCraft: () => void
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

const DEFAULT_COLORS: Record<PaintableVehicle, string> = { excavator: 'yellow', dumpTruck: 'yellow', bulldozer: 'yellow' }

/** そのペンキを持っているか（はじめから持っている色もふくむ） */
export const ownsPaint = (owned: readonly string[], id: string) => owned.includes(id) || PAINTS.find((p) => p.id === id)?.cost === null

export const useCraftStore = create<CraftState>()(
  persist(
    (set, get) => ({
      paints: [],
      decorations: [],
      vehicleColors: DEFAULT_COLORS,
      craft: (kind, id, cost) => {
        if (!useCollectionStore.getState().spend(cost)) return false
        if (kind === 'paint') set({ paints: [...new Set([...get().paints, id])] })
        else set({ decorations: [...new Set([...get().decorations, id])] })
        return true
      },
      setColor: (vehicle, paint) => set({ vehicleColors: { ...get().vehicleColors, [vehicle]: paint } }),
      resetCraft: () => set({ paints: [], decorations: [], vehicleColors: DEFAULT_COLORS }),
    }),
    { name: 'kenki-asobi-craft', storage: safeStorage },
  ),
)

// 保護者向け：URL に ?reset-progress を付けて開くと、つくったものも消す
if (new URLSearchParams(location.search).has('reset-progress')) useCraftStore.getState().resetCraft()
