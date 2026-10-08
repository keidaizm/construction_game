import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { FIELD } from '../world/fieldLayout'

/**
 * 探検の記録（地図のどこまで行ったか）。フィールドを 20m のマスに分け、行ったマスを覚える。
 * ブラウザ（localStorage）に保存し、次に開いても地図は広がったまま。
 */
export const MAP_CELL = 20
/** 地図のマスの数（一辺） */
export const MAP_CELLS = Math.ceil((FIELD.driveLimit * 2 + 20) / MAP_CELL)
const HALF = (MAP_CELLS * MAP_CELL) / 2
/** 車両のまわりこの距離 [m] のマスを「行った」ことにする */
export const REVEAL_RADIUS = 35

export const cellKey = (cx: number, cz: number) => `${cx},${cz}`
export const cellOf = (x: number, z: number) => [Math.floor((x + HALF) / MAP_CELL), Math.floor((z + HALF) / MAP_CELL)] as const
/** マスの中心のワールド座標 */
export const cellCenter = (cx: number, cz: number) => [cx * MAP_CELL - HALF + MAP_CELL / 2, cz * MAP_CELL - HALF + MAP_CELL / 2] as const
export const MAP_HALF = HALF

interface ExplorationState {
  /** 行ったマス（"cx,cz"） */
  cells: string[]
  /** (x, z) のまわりのマスを行ったことにする。新しいマスがあれば true */
  reveal: (x: number, z: number) => boolean
  /** 地図を 100% にしたごほうび（星）をもうもらったか */
  completeRewarded: boolean
  setCompleteRewarded: () => void
  resetExploration: () => void
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

/** 読み込み直後でも速く調べられるように Set でも持つ */
let known = new Set<string>()

export const useExplorationStore = create<ExplorationState>()(
  persist(
    (set, get) => ({
      cells: [],
      reveal: (x, z) => {
        const [cx, cz] = cellOf(x, z)
        const span = Math.ceil(REVEAL_RADIUS / MAP_CELL)
        const added: string[] = []
        for (let dx = -span; dx <= span; dx++) {
          for (let dz = -span; dz <= span; dz++) {
            const nx = cx + dx
            const nz = cz + dz
            if (nx < 0 || nz < 0 || nx >= MAP_CELLS || nz >= MAP_CELLS) continue
            const [wx, wz] = cellCenter(nx, nz)
            if (Math.hypot(wx - x, wz - z) > REVEAL_RADIUS + MAP_CELL / 2) continue
            const key = cellKey(nx, nz)
            if (!known.has(key)) added.push(key)
          }
        }
        if (added.length === 0) return false
        added.forEach((k) => known.add(k))
        set({ cells: [...get().cells, ...added] })
        return true
      },
      completeRewarded: false,
      setCompleteRewarded: () => set({ completeRewarded: true }),
      resetExploration: () => {
        known = new Set()
        set({ cells: [], completeRewarded: false })
      },
    }),
    {
      name: 'kenki-asobi-exploration',
      storage: safeStorage,
      onRehydrateStorage: () => (state) => {
        known = new Set(state?.cells ?? [])
      },
    },
  ),
)

/** 走れる範囲の中にあるマス（探検の割合を出すときの分母） */
const EXPLORABLE: readonly string[] = (() => {
  const keys: string[] = []
  for (let cx = 0; cx < MAP_CELLS; cx++)
    for (let cz = 0; cz < MAP_CELLS; cz++) {
      const [x, z] = cellCenter(cx, cz)
      if (Math.abs(x) < FIELD.driveLimit && Math.abs(z) < FIELD.driveLimit) keys.push(cellKey(cx, cz))
    }
  return keys
})()

/** 探検した割合 [%]（走れる範囲のマスのうち、行ったマス） */
export function explorePercent(cells: readonly string[]) {
  const set = new Set(cells)
  return Math.round((EXPLORABLE.filter((k) => set.has(k)).length / EXPLORABLE.length) * 100)
}

/** (x, z) はもう行ったことのある場所か */
export function isExplored(x: number, z: number) {
  const [cx, cz] = cellOf(x, z)
  return known.has(cellKey(cx, cz))
}

// 保護者向け：URL に ?reset-progress を付けて開くと、地図の記録も消す
if (new URLSearchParams(location.search).has('reset-progress')) useExplorationStore.getState().resetExploration()
