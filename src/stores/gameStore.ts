import { create } from 'zustand'
import type { VehicleId } from '../vehicles/types'
import { useInputStore } from './inputStore'
import { audio } from '../audio/AudioManager'
import { useCraneStore } from './craneStore'
import { useProgressStore } from './progressStore'
import { BREAKER_LEVEL, DEMOLISH_LEVEL, GRAPPLE_LEVEL, levelForStars } from '../missions/levels'

/** 将来の視点切り替え用。Phase 1 では 'chase' のみ実装。 */
export type CameraMode = 'chase' | 'cab' | 'top'

/**
 * ショベルのアタッチメント：バケット（すくう）／油圧ブレーカー（大きな岩・ビルを割る、Lv4）／グラップル（木材をつかむ、Lv6）／
 * スケルトンバケット（がれきをふるって鉄骨だけにする、Lv7）
 */
export type ExcavatorTool = 'bucket' | 'breaker' | 'grapple' | 'skeleton'

/** そのレベルで使えるアタッチメント（切り替えボタンはこの順に回る） */
export function availableTools(level: number): ExcavatorTool[] {
  return [
    'bucket',
    ...(level >= BREAKER_LEVEL ? (['breaker'] as const) : []),
    ...(level >= GRAPPLE_LEVEL ? (['grapple'] as const) : []),
    ...(level >= DEMOLISH_LEVEL ? (['skeleton'] as const) : []),
  ]
}

/** 時間帯（ボタンで 昼 → 夕焼け → 夜 → 昼… と回る） */
export type TimeOfDay = 'day' | 'dusk' | 'night'

const NEXT_TIME: Record<TimeOfDay, TimeOfDay> = { day: 'dusk', dusk: 'night', night: 'day' }

/** のりかえボタンで回る順番 */
export const VEHICLE_ORDER: readonly VehicleId[] = ['excavator', 'dumpTruck', 'bulldozer']

export const nextVehicle = (v: VehicleId): VehicleId => VEHICLE_ORDER[(VEHICLE_ORDER.indexOf(v) + 1) % VEHICLE_ORDER.length]

interface GameState {
  activeVehicle: VehicleId
  cameraMode: CameraMode
  /** 値が変わると車両が初期位置・初期姿勢に戻る */
  resetToken: number
  requestReset: () => void
  /** 乗る車両を切り替える（ショベルカー → ダンプカー → ブルドーザー → ショベルカー…） */
  switchVehicle: () => void
  /** クレーンに乗る前に乗っていた車両（おりるとこれに戻る） */
  previousVehicle: VehicleId
  /** クレーンに乗る（Lv3 から。近づくと出るボタン） */
  boardCrane: () => void
  /** クレーンからおりて、乗ってきた車両に戻る */
  leaveCrane: () => void
  /** ショベルの先のアタッチメント（Lv4 から油圧ブレーカーに付けかえられる） */
  excavatorTool: ExcavatorTool
  toggleExcavatorTool: () => void
  /** 地図を開いているか */
  mapOpen: boolean
  toggleMap: () => void
  /** 図鑑を開いているか */
  zukanOpen: boolean
  toggleZukan: () => void
  /** レベルの一覧を開いているか（左上のレベルの札を押す） */
  levelsOpen: boolean
  toggleLevels: () => void
  /** 基地の建物に入っているか（じむしょ・しゃこ・こうぼう。null = 入っていない） */
  baseRoom: 'office' | 'garage' | 'workshop' | 'showcase' | null
  setBaseRoom: (room: 'office' | 'garage' | 'workshop' | 'showcase' | null) => void
  /** 時間帯（空や光はゆっくり変わる。world/DayNight.tsx） */
  timeOfDay: TimeOfDay
  cycleTimeOfDay: () => void
  /** 乗っている車両のライトを点けているか（夕焼け・夜だけ。昼に戻ると消える） */
  headlights: boolean
  toggleHeadlights: () => void
}

export const useGameStore = create<GameState>((set) => ({
  activeVehicle: 'excavator',
  cameraMode: 'chase',
  resetToken: 0,
  requestReset: () => set((s) => ({ resetToken: s.resetToken + 1 })),
  switchVehicle: () => {
    // 押しっぱなしのレバーが次の車両に効かないよう、タッチ入力を消す
    useInputStore.getState().resetSource('touch')
    audio.play('switch')
    set((s) => (s.activeVehicle === 'crane' ? s : { activeVehicle: nextVehicle(s.activeVehicle) }))
  },
  previousVehicle: 'excavator',
  boardCrane: () => {
    useInputStore.getState().resetSource('touch')
    audio.play('switch')
    useCraneStore.getState().setGame(null)
    set((s) => (s.activeVehicle === 'crane' ? s : { previousVehicle: s.activeVehicle, activeVehicle: 'crane' }))
  },
  leaveCrane: () => {
    useInputStore.getState().resetSource('touch')
    audio.play('switch')
    set((s) => ({ activeVehicle: s.previousVehicle }))
  },
  excavatorTool: 'bucket',
  toggleExcavatorTool: () => {
    const tools = availableTools(levelForStars(useProgressStore.getState().stars).level)
    if (tools.length < 2) return
    audio.play('switch')
    set((s) => ({ excavatorTool: tools[(tools.indexOf(s.excavatorTool) + 1) % tools.length] }))
  },
  mapOpen: false,
  toggleMap: () => set((s) => ({ mapOpen: !s.mapOpen, zukanOpen: false, levelsOpen: false, baseRoom: null })),
  zukanOpen: false,
  toggleZukan: () => set((s) => ({ zukanOpen: !s.zukanOpen, mapOpen: false, levelsOpen: false, baseRoom: null })),
  levelsOpen: false,
  toggleLevels: () => set((s) => ({ levelsOpen: !s.levelsOpen, mapOpen: false, zukanOpen: false, baseRoom: null })),
  baseRoom: null,
  setBaseRoom: (baseRoom) => {
    if (baseRoom) {
      useInputStore.getState().resetSource('touch')
      audio.play('switch')
    }
    set({ baseRoom, mapOpen: false, zukanOpen: false, levelsOpen: false })
  },
  timeOfDay: 'day',
  cycleTimeOfDay: () => {
    audio.play('switch')
    set((s) => {
      const timeOfDay = NEXT_TIME[s.timeOfDay]
      return { timeOfDay, headlights: timeOfDay === 'day' ? false : s.headlights }
    })
  },
  headlights: false,
  toggleHeadlights: () => {
    audio.play('switch')
    set((s) => ({ headlights: s.timeOfDay !== 'day' && !s.headlights }))
  },
}))
