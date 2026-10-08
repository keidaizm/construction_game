/** 中心付近の小さなブレを無視し、残りを 0〜1 に再マップする。 */
export function applyDeadzone(v: number, deadzone = 0.12): number {
  const a = Math.abs(v)
  if (a <= deadzone) return 0
  return (Math.sign(v) * (a - deadzone)) / (1 - deadzone)
}

/** 小さく倒したときにゆっくり動かせるよう、入力に緩いカーブをかける。 */
export function applyCurve(v: number, exponent = 1.6): number {
  return Math.sign(v) * Math.pow(Math.abs(v), exponent)
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** レバー／スティックの生の値（-1〜1）を操作量へ変換する。 */
export function shapeInput(v: number): number {
  return applyCurve(applyDeadzone(clamp(v, -1, 1)))
}
