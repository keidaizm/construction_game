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

/**
 * クレーンを置く場所。基地のクレーン（yard）と、Lv10 の高いビルの屋上のクレーン（sky）の 2 台があり、
 * 同じ操作（useCraneController）で動かす。乗っている方（craneStore.site）だけが入力・カメラ・センサーを使う。
 * base.y はクレーンの根元の高さ（屋上のクレーンはビルが高くなるとせり上がる）
 */
export type CraneSiteId = 'yard' | 'sky'

export interface CraneSite {
  id: CraneSiteId
  x: number
  z: number
  /** 根元の高さ [m]（毎フレーム読む。屋上のクレーンは SkyscraperSite が書きかえる） */
  base: { y: number }
  /** フックを上げ下げする速さ [m/s]（屋上のクレーンはロープが長いので速く） */
  ropeSpeed: number
  /** カメラがフックの高さについていくか（屋上のクレーン）。しなければ、フックと地面の間 */
  followHook: boolean
  /** はなしたときに、そろえる先（あれば）。p は荷物の中心 */
  snap?: (x: number, z: number) => { x: number; z: number; yaw: number } | null
}

export const YARD_CRANE: CraneSite = { id: 'yard', x: CRANE.x, z: CRANE.z, base: { y: 0 }, ropeSpeed: CRANE.rope.maxSpeed, followHook: false }
