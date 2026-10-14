import { FIELD } from '../../world/fieldLayout'
import type { JointConfig } from '../shared/joint'

const deg = (d: number) => (d * Math.PI) / 180

/**
 * ブルドーザーの寸法・速さ・排土板の設定。
 * 車両ローカル座標は +Z が前、+Y が上、+X が左。原点は地面の高さ・履帯のまん中。
 * 排土板で石を押せるが、土の山（土ブロック）は壊せない（壁のように止まる）。
 */
export const BULLDOZER = {
  /** 初期位置（ショベルの右どなり） */
  start: { x: -6, z: 1, heading: 0 },

  drive: {
    maxSpeed: 5.5,
    maxReverseSpeed: 3.0,
    maxTurnRate: 1.2,
    response: 3.0,
    fieldLimit: FIELD.driveLimit,
  },

  tracks: { gauge: 0.95, length: 2.6, radius: 0.36, width: 0.55 },

  /**
   * 排土板を上げ下げする腕の角度（0 = 地面すれすれ、+ で持ち上がる）。
   * 腕の根元は履帯フレームの横、先に排土板がつく。
   */
  lift: { initial: deg(3), min: 0, max: deg(22), maxSpeed: 0.35, response: 4 } as JointConfig,

  geometry: {
    /** 腕の根元の高さと前後位置（ローカル） */
    armPivot: [0, 0.6, 0.2] as const,
    /** 腕の左右の位置（履帯の外側） */
    armX: 1.32,
    /** 腕が水平（角度 0）のとき、排土板の下端の高さ */
    bladeClearance: 0.03,
    /** 根元から排土板までの長さ */
    armLength: 2.25,
    bladeWidth: 2.9,
    bladeHeight: 0.85,
  },

  /** 車両どうし・木・土の山との接触判定用の足元の円 [ローカル Z, 半径]。前の円は排土板 */
  footprint: [
    [0.8, 1.25],
    [-0.9, 1.25],
    [2.0, 1.2],
  ] as const,
}
