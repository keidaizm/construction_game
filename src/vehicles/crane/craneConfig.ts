import { LANDMARKS } from '../../world/fieldLayout'

const deg = (d: number) => (d * Math.PI) / 180

/**
 * タワークレーン（基地の目印）。Lv3 から、近づくと乗れる（ミニゲーム：コンテナはこび・つみきタワー）。
 * 座標：クレーンの根元が原点、旋回角 yaw は上から見て +Z から +X へ（車両の heading と同じ向き）。
 */
export const CRANE = {
  x: LANDMARKS.crane.x,
  z: LANDMARKS.crane.z,
  /** 塔の高さ・腕（ジブ）の高さ [m] */
  towerHeight: 20,
  jibY: 21.2,
  jibLength: 18,
  /** 乗れるレベル */
  unlockLevel: 3,
  /** この距離 [m] まで車両で近づくと「クレーンに のる？」が出る */
  boardRadius: 18,

  slew: { initial: deg(46), maxSpeed: 0.45, response: 3 },
  /** トロリー（フックを吊る台車）の、塔からの距離 [m] */
  trolley: { initial: 9, min: 3.5, max: 16.5, maxSpeed: 2.8, response: 4 },
  /** ロープの長さ [m] */
  rope: { initial: 9, min: 1.2, maxSpeed: 3.4, response: 5 },
  /** フック（滑車とかぎ）の高さ。ロープの先からフックの下まで [m] */
  hookHeight: 0.8,
  /** フックの揺れ（少しだけ）：ゆれの大きさの上限 [rad]・おさまる速さ */
  sway: { maxAngle: deg(4.5), damping: 2.6, gain: 0.35 },
  /** フックの下がこれだけの範囲に荷物の上があれば、つかめる [m] */
  grabReach: { below: 0.35, above: 0.9 },
} as const
