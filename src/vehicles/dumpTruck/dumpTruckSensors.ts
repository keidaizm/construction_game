/**
 * ダンプカーの状態のうち、他のシステム（将来のミッション判定など）が毎フレーム読むもの。
 * React の state ではない。
 */
export const dumpTruckSensors = {
  /** 位置（ワールド） */
  x: 0,
  z: 0,
  heading: 0,
  /** 荷台の角度 [rad]（0 = 下げた状態） */
  bedAngle: 0,
  /** 走行速度 [m/s]（後退は負） */
  speed: 0,
  /** 荷台に載っている岩の数 */
  loadedCount: 0,
  /** 荷台に載っている木材の数（Lv6。緑の矢印が家の区画を指す） */
  loadedLogs: 0,
  /** 荷台に載っているがれきの数と、そのうち鉄骨だけ（ふるい終わった）の数（Lv7。緑の矢印がリサイクル場を指す） */
  loadedScrap: 0,
  loadedSteel: 0,
}
