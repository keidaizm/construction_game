import { create } from 'zustand'
import { BOULDERS } from './fieldLayout'
import { heightAt } from './terrain'
import type { RockColor } from '../cargo/rocks/rockTypes'
import type { Biome } from './biomes'

/**
 * 大きな岩（フィールドの飾りの岩）。Lv4 の油圧ブレーカーで叩くと、ヒビが入って割れる（ユーザー要望）。
 * 割れると小さな石（ミッションに使える）が出て、ときどき岩だけの鉱石も出る。次のミッション（「はじめから」）で元に戻る。
 * 状態は毎フレーム読むので React の state にしない（地図用に割れた番号だけ zustand で持つ）。
 */
export interface BoulderState {
  /** 残りの固さ（叩いている秒数ぶん減る。0 で割れる） */
  hp: number
  maxHp: number
  broken: boolean
  /** 叩かれてから少しの間ゆれる（見た目） */
  shake: number
}

/** 岩の大きさ 1 倍あたり、割れるまで叩く時間 [s] */
const HP_PER_SCALE = 2.2

export const boulderStates: BoulderState[] = BOULDERS.map((b) => ({ hp: b.scale * HP_PER_SCALE, maxHp: b.scale * HP_PER_SCALE, broken: false, shake: 0 }))

/** 見た目を書きかえる必要があるか（BoulderField が見て、instance を更新する） */
export const boulderDirty = { value: true }

/** 岩の形（だ円体）の半径 [x, y, z] と、中心の高さ。見た目の大きさ（Environment の Boulders）に合わせる */
export function boulderShape(i: number) {
  const b = BOULDERS[i]
  const s = b.scale * 1.5
  return { cx: b.x, cy: heightAt(b.x, b.z) + 0.6 * b.scale, cz: b.z, rx: s, ry: s * 0.75, rz: s * 1.1, yaw: b.rotation }
}

/** 割れたときに出てくる石の色（地帯の色：雪原は白、砂漠は赤、岩山は黒） */
export const BOULDER_ROCK_COLOR: Record<Biome, RockColor> = { base: 'gray', snow: 'white', forest: 'gray', desert: 'red', rocky: 'black' }

/** 地図用：割れている岩の番号 */
export const useBoulderStore = create<{ broken: number[]; setBroken: (broken: number[]) => void }>((set) => ({
  broken: [],
  setBroken: (broken) => set({ broken }),
}))

/** 全部元に戻す（次のミッション・はじめから） */
export function restoreBoulders() {
  boulderStates.forEach((s) => {
    s.hp = s.maxHp
    s.broken = false
    s.shake = 0
  })
  boulderDirty.value = true
  useBoulderStore.getState().setBroken([])
}
