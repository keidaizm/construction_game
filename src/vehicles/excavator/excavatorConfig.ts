import { FIELD } from '../../world/fieldLayout'
import type { JointConfig } from '../shared/joint'

const deg = (d: number) => (d * Math.PI) / 180

/**
 * ショベルカーの寸法・可動範囲・速度。
 * 角度はすべて「親に対する仰角」（+ で上向き）。
 * 車両ローカル座標は +Z が前、+Y が上、+X が左。
 */
export const EXCAVATOR = {
  drive: {
    /**
     * 2 段階の速さ（画面のカメ／ウサギのボタンで切り替え）
     * - slow：石の近くで細かく動かすとき（もとの速さ）
     * - fast：遠くの石の場所まで走るとき（約 2 倍。ふだんはこちら）
     */
    gears: {
      slow: { maxSpeed: 3.2, maxReverseSpeed: 2.2, maxTurnRate: 0.9 },
      fast: { maxSpeed: 6.4, maxReverseSpeed: 3.5, maxTurnRate: 1.2 },
    },
    response: 3.0,
    fieldLimit: FIELD.driveLimit, // この範囲から出られない
  },
  /** 車両どうしの接触判定用の足元の円 [ローカル Z, 半径] */
  footprint: [
    [1.2, 1.45],
    [-1.2, 1.45],
  ] as const,
  swing: { initial: 0, min: -Infinity, max: Infinity, maxSpeed: 0.8, response: 3.5 } as JointConfig,
  boom: { initial: deg(30), min: deg(-18), max: deg(58), maxSpeed: 0.55, response: 5 } as JointConfig,
  arm: { initial: deg(-105), min: deg(-155), max: deg(-35), maxSpeed: 0.75, response: 5 } as JointConfig,
  bucket: { initial: deg(-40), min: deg(-115), max: deg(40), maxSpeed: 1.3, response: 6 } as JointConfig,

  geometry: {
    trackGauge: 1.05, // 左右履帯の中心の X 位置
    trackLength: 3.1, // 直線部の長さ
    trackRadius: 0.38, // 前後の丸み
    trackWidth: 0.6,
    upperBodyHeight: 1.0,
    boomPivot: [-0.15, 0.7, 1.0] as const, // 上部旋回体ローカル
    boomLength: 4.2,
    armLength: 2.4,
  },

  /** バケット先端がこの高さより下へは掘り込めない（地面に当たる感覚） */
  groundDigLimit: -0.25,
}
