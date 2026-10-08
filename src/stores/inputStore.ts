import { create } from 'zustand'

/**
 * 全車両で共通の操作軸。値は -1〜1。
 * - driveY : +前進 / -後退
 * - driveX : +右 / -左
 * - swing  : +右旋回 / -左旋回（上部旋回体）
 * - boom   : +上げ / -下げ
 * - arm    : +押し出し / -引き込み
 * - bucket : +開く（ダンプ方向） / -巻き込む（掘る方向）
 * - bed    : +荷台を上げる / -下げる（ダンプカー）
 * - blade  : +排土板を上げる / -下げる（ブルドーザー）
 *
 * 各車両は自分に関係する軸だけを読む。
 */
export type AxisName = 'driveY' | 'driveX' | 'swing' | 'boom' | 'arm' | 'bucket' | 'bed' | 'blade'
export type Axes = Record<AxisName, number>

/** 入力元。タッチとキーボードを別々に保持し、読み出し時に合成する。 */
export type InputSource = 'touch' | 'keyboard'

export const AXIS_NAMES: readonly AxisName[] = ['driveY', 'driveX', 'swing', 'boom', 'arm', 'bucket', 'bed', 'blade']

export const zeroAxes = (): Axes => ({ driveY: 0, driveX: 0, swing: 0, boom: 0, arm: 0, bucket: 0, bed: 0, blade: 0 })

interface InputState {
  sources: Record<InputSource, Axes>
  setAxis: (source: InputSource, axis: AxisName, value: number) => void
  setAxes: (source: InputSource, values: Partial<Axes>) => void
  resetSource: (source: InputSource) => void
}

export const useInputStore = create<InputState>((set) => ({
  sources: { touch: zeroAxes(), keyboard: zeroAxes() },
  setAxis: (source, axis, value) =>
    set((s) => {
      if (s.sources[source][axis] === value) return s
      return { sources: { ...s.sources, [source]: { ...s.sources[source], [axis]: value } } }
    }),
  setAxes: (source, values) =>
    set((s) => ({ sources: { ...s.sources, [source]: { ...s.sources[source], ...values } } })),
  resetSource: (source) => set((s) => ({ sources: { ...s.sources, [source]: zeroAxes() } })),
}))

/** useFrame 内から毎フレーム呼ぶ。React の再レンダーを発生させない。 */
export function readAxes(out: Axes = zeroAxes()): Axes {
  const { touch, keyboard } = useInputStore.getState().sources
  for (const axis of AXIS_NAMES) {
    out[axis] = Math.max(-1, Math.min(1, touch[axis] + keyboard[axis]))
  }
  return out
}
