import { create } from 'zustand'

/** いまお祝いの画面が出ているか（グレードアップのお祝いを重ねて出さないように） */
export const useCelebrationStore = create<{ mapComplete: boolean; setMapComplete: (on: boolean) => void }>((set) => ({
  mapComplete: false,
  setMapComplete: (mapComplete) => set({ mapComplete }),
}))
