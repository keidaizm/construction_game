import { create } from 'zustand'
import type { SightId } from '../world/discoveryLayout'

/**
 * 画面のまん中あたりに少しだけ出るお知らせ（「◯◯ を みつけた！」など）。
 * icon：'gem' = 宝石の絵（color の色）／'star' = 星／'sight' = 名所の絵（sight）
 */
export interface Toast {
  title: string
  icon: 'gem' | 'star' | 'sight'
  sight?: SightId
  color: string
  /** レア度の★の数（0 なら出さない） */
  stars: number
  isNew: boolean
  at: number
}

interface ToastState {
  toast: Toast | null
  show: (toast: Omit<Toast, 'at'>) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (toast) => set({ toast: { ...toast, at: performance.now() } }),
}))
