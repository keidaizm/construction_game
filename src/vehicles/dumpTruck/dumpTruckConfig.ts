import { FIELD } from '../../world/fieldLayout'
import type { JointConfig } from '../shared/joint'

const deg = (d: number) => (d * Math.PI) / 180

/**
 * ダンプカーの寸法・速度・荷台の設定。
 * 車両ローカル座標は +Z が前、+Y が上、+X が左。原点は地面の高さ・前後輪の間あたり。
 */
export const DUMP_TRUCK = {
  /** 初期位置。ショベルカーの左側（キャブ側）に並べ、左に旋回すれば積み込める位置。カメラ（右後ろ）の視界をふさがない */
  start: { x: 4.6, z: 5.5, heading: 0 },

  drive: {
    /** 速さは 1 段階だけ（前はカメ／ウサギで切り替えたが、あまり使わないのでなくした＝ユーザー判断） */
    maxSpeed: 13,
    accelResponse: 1.8,
    maxReverseSpeed: 4,
    /** 荷台を上げている間の最高速度 */
    bedUpMaxSpeed: 1.5,
    brakeResponse: 3.5,
    maxSteer: deg(32),
    /** 速いときはハンドルの切れる角度を減らす（この速さで maxSteer の minSteerRatio 倍まで減る） */
    steerFadeSpeed: 13,
    minSteerRatio: 0.4,
    steerResponse: 4,
    fieldLimit: FIELD.driveLimit,
  },

  /** 荷台の角度（0 = 下げた状態、+ で前が持ち上がる） */
  bed: { initial: 0, min: 0, max: deg(50), maxSpeed: 0.35, response: 3 } as JointConfig,

  cargo: {
    /** 荷台がこの角度より下のとき、落ち着いた岩を荷台に固定する */
    attachBelowAngle: deg(3),
    /** 荷台がこの角度を超えたら岩を物理に戻す（そのあと傾きで滑り落ちる） */
    releaseAboveAngle: deg(15),
    /** 荷台がこの角度を超えたら後ろのあおり（テールゲート）の当たり判定を消す */
    tailgateOpenAngle: deg(6),
    /** これより速く動いている岩はまだ固定しない（落ちてきて跳ねている最中） */
    settleSpeed: 1.0,
    /** 荷台がこの角度を超えたら、降ろしている岩を後ろへ押し出す（角に引っかからないように） */
    slideAssistAboveAngle: deg(28),
    /** 押し出すとき、荷台から出るまで最低この速さ [m/s] で後ろへ滑らせる */
    slideOutSpeed: 1.2,
  },
}

/**
 * ダンプの大きさ。Lv5 から大きな重ダンプ（オフロードダンプ）になる（ユーザー要望：バケットに合わせてダンプもグレードアップ）。
 * 荷台のふちの高さは、ショベルのバケットが届く高さ（荷台の中ほどで 3.2m 以上）より十分低くする。
 */
export interface TruckGeometry {
  kind: 'standard' | 'big'
  wheelRadius: number
  /** タイヤの幅（後輪はダブルタイヤ） */
  frontTireWidth: number
  rearTireWidth: number
  frontAxleZ: number
  rearAxleZ: readonly number[]
  frontTrackHalf: number
  rearTrackHalf: number
  /** 前輪〜後輪（の中間）の距離。曲がり具合が決まる */
  wheelBase: number
  /** 荷台のヒンジ（後端）の位置 */
  bedHinge: readonly [number, number, number]
  bedLength: number
  bedWidth: number
  bedFloorThickness: number
  bedWallHeight: number
  bedWallThickness: number
  /** 荷台を持ち上げる油圧シリンダーの付け根（車体）と先（荷台のローカル） */
  hoistBase: readonly [number, number, number]
  hoistEnd: readonly [number, number, number]
  /** 車体の当たり判定：フレームと、前（キャブ・エンジン）の箱 [半分の大きさ, 位置] */
  frameBox: readonly [readonly [number, number, number], readonly [number, number, number]]
  frontBox: readonly [readonly [number, number, number], readonly [number, number, number]]
  /** 車両どうしの接触判定用の足元の円 [ローカル Z, 半径] */
  footprint: ReadonlyArray<readonly [number, number]>
  /** 傾きを決めるときの、車体の前後・左右の半分の長さ */
  poseHalf: readonly [number, number]
}

export const TRUCK_SIZES: Record<TruckGeometry['kind'], TruckGeometry> = {
  standard: {
    kind: 'standard',
    wheelRadius: 0.52,
    frontTireWidth: 0.36,
    rearTireWidth: 0.55,
    frontAxleZ: 2.35,
    rearAxleZ: [-1.35, -2.65],
    frontTrackHalf: 1.0,
    rearTrackHalf: 0.95,
    wheelBase: 4.35,
    bedHinge: [0, 1.25, -3.35],
    bedLength: 4.3,
    bedWidth: 2.3,
    bedFloorThickness: 0.12,
    bedWallHeight: 0.65,
    bedWallThickness: 0.08,
    hoistBase: [0, 0.9, 0.2],
    hoistEnd: [0, -0.1, 3.0],
    frameBox: [
      [1.15, 0.35, 3.1],
      [0, 0.75, -0.05],
    ],
    frontBox: [
      [1.15, 0.95, 0.8],
      [0, 1.85, 2.8],
    ],
    footprint: [
      [2.4, 1.3],
      [0.2, 1.3],
      [-2.2, 1.3],
    ],
    poseHalf: [2.6, 1.1],
  },
  // 重ダンプ：大きなタイヤ・左に寄った運転席・運転席の上までのびる荷台のひさし
  big: {
    kind: 'big',
    wheelRadius: 0.82,
    frontTireWidth: 0.6,
    rearTireWidth: 0.95,
    frontAxleZ: 2.5,
    rearAxleZ: [-2.15],
    frontTrackHalf: 1.2,
    rearTrackHalf: 1.15,
    wheelBase: 4.65,
    bedHinge: [0, 1.75, -3.55],
    bedLength: 5.4,
    bedWidth: 2.9,
    bedFloorThickness: 0.14,
    bedWallHeight: 0.85,
    bedWallThickness: 0.1,
    hoistBase: [0, 1.3, 0.7],
    hoistEnd: [0, -0.1, 3.6],
    frameBox: [
      [1.3, 0.5, 3.4],
      [0, 1.15, -0.15],
    ],
    frontBox: [
      [1.55, 0.95, 1.0],
      [0, 2.35, 2.75],
    ],
    footprint: [
      [2.7, 1.6],
      [0.2, 1.6],
      [-2.5, 1.6],
    ],
    poseHalf: [2.9, 1.3],
  },
}

/** いま使っているダンプの大きさ（DumpTruck がレベルに合わせて入れかえる。コントローラ・荷台の処理が毎フレーム読む） */
export const truckShape = { current: TRUCK_SIZES.standard }
