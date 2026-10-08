import type { RapierRigidBody } from '@react-three/rapier'

/** 木材（丸太）の大きさ。ダンプの荷台に横向きでも入る長さ */
export const LOG = { length: 1.9, radius: 0.22 }
/** 用意しておく木材の数（遊んでいる最中に物理ボディを作らない） */
export const LOG_POOL = 30
/** Lv6 になるまでは、出てからこの時間 [s] で消える（グラップルで運べないので） */
export const LOG_LIFETIME = 30

/**
 * 木材の状態
 * - pooled：控え（遠くに止めてある）
 * - free：地面などにあって物理で動く
 * - held：グラップルでつかんでいる
 * - truck：ダンプの荷台に載っている
 */
export type LogState = 'pooled' | 'free' | 'held' | 'truck'

export interface LogEntry {
  id: string
  body: RapierRigidBody
  state: LogState
  /** 出てきた時刻（logRegistry.now の値） */
  spawnedAt: number
}

/**
 * 木材の一覧。useFrame から読むので React の state にしない。
 * spawn / despawn は物理エンジンが必要なので LogField が中身を差し込む。
 */
export const logRegistry = {
  logs: [] as LogEntry[],
  /** いまの時刻 [s]（LogField が毎フレーム進める） */
  now: 0,
  /** 木材を 1 本出す（yaw は丸太の長い向き）。控えがなければ、いちばん古い木材を使い回す */
  spawn: null as ((x: number, y: number, z: number, yaw: number) => LogEntry | null) | null,
  despawn: null as ((log: LogEntry) => void) | null,
}
