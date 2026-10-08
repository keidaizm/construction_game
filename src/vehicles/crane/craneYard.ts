import type { RapierRigidBody } from '@react-three/rapier'
import { CRANE } from './craneConfig'
import { CONTAINER_COUNT, type CraneGame } from '../../stores/craneStore'

/**
 * クレーンのまわりの置き場（ミニゲームの道具）。腕の届く範囲（塔から 3.5〜16.5m）に置く。
 * 角度は塔から見た方角（度。0 = +Z、90 = +X）。
 * 車両は基地の方（北東、方角 0〜115°）から近づいて乗るので、道具はそこをあけて反対がわに置く。
 * - コンテナはこび：西がわにコンテナ 5 こ、北西に台（と式の看板）
 * - つみきタワー：南がわに大きさ・形のちがうブロック 10 こ、南西に土台（と高さのものさし）
 * 横から見るカメラ（腕に直角）では奥行きが分かりにくいので、道具は腕の向き（塔からまっすぐ外へ）に並べ、
 * 旋回で方向を合わせたら、トロリー（画面の左右）とフックの上げ下げだけで届くようにする。
 */
const deg = (d: number) => (d * Math.PI) / 180

/** 塔から見た方角 angle・距離 r の場所（ワールド） */
export function yardPoint(angleDeg: number, r: number, side = 0) {
  const a = deg(angleDeg)
  // side：方角に直角な向き（左右）へずらす量
  return { x: CRANE.x + Math.sin(a) * r + Math.cos(a) * side, z: CRANE.z + Math.cos(a) * r - Math.sin(a) * side, yaw: a }
}

export type LoadShape = 'box' | 'roof'

export interface LoadDef {
  id: string
  game: CraneGame
  shape: LoadShape
  /** 大きさ [幅 x, 高さ y, 奥行き z] [m] */
  size: readonly [number, number, number]
  color: string
  home: { x: number; z: number; yaw: number }
}

export interface LoadEntry extends LoadDef {
  body: RapierRigidBody
  /** コンテナに書いてある数字（つみきは 0） */
  number: number
}

/** いま場にある荷物（CraneLoads が登録する。useFrame から読むので React の state にしない） */
export const craneLoads = { list: [] as LoadEntry[] }

export const CONTAINER_SIZE = [2.2, 1.3, 1.3] as const
const CONTAINER_COLORS = ['#e05a3a', '#2f80ed', '#2fbf5b', '#f2b705', '#9b51e0']

export const CONTAINERS: readonly LoadDef[] = Array.from({ length: CONTAINER_COUNT }, (_, i) => {
  const p = yardPoint(272, 4.8 + i * 2.6)
  return { id: `container-${i}`, game: 'containers', shape: 'box', size: CONTAINER_SIZE, color: CONTAINER_COLORS[i], home: p }
})

/** コンテナをのせる台 */
export const CONTAINER_PAD = { ...yardPoint(322, 11.5), size: 3.6 }
/** 台の式の看板（台の向こうがわ。横から見るカメラの方を向く） */
export const CONTAINER_SIGN = yardPoint(322, 11.5, 4.2)

/** つみき：大きさ・形がいろいろ（高く積むにはどれを下にするかがだいじ） */
const BLOCK_KINDS: ReadonlyArray<{ shape: LoadShape; size: readonly [number, number, number]; color: string }> = [
  { shape: 'box', size: [1.6, 1.6, 1.6], color: '#e05a3a' },
  { shape: 'box', size: [1.6, 1.6, 1.6], color: '#2f80ed' },
  { shape: 'box', size: [2.8, 0.5, 2.8], color: '#9b51e0' },
  { shape: 'box', size: [3.2, 0.7, 0.9], color: '#ff8a00' },
  { shape: 'box', size: [3.2, 0.7, 0.9], color: '#ff8a00' },
  { shape: 'box', size: [0.9, 2.4, 0.9], color: '#17a2a2' },
  { shape: 'box', size: [0.9, 2.4, 0.9], color: '#17a2a2' },
  { shape: 'box', size: [1.0, 1.0, 1.0], color: '#f2b705' },
  { shape: 'box', size: [1.0, 1.0, 1.0], color: '#2fbf5b' },
  { shape: 'roof', size: [2.2, 1.2, 1.6], color: '#d64545' },
]

/** つみきの置き場所 [方角, 距離]（3 つの方角に、腕の向きに並べる。長いブロックは外がわ） */
const BLOCK_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [130, 6.5],
  [160, 6.5],
  [240, 10.5],
  [130, 14.5],
  [160, 14.5],
  [130, 10.5],
  [160, 10.5],
  [240, 6.5],
  [240, 14.5],
  [160, 3.6],
]

export const BLOCKS: readonly LoadDef[] = BLOCK_KINDS.map((k, i) => {
  const [angle, r] = BLOCK_SLOTS[i]
  return { id: `block-${i}`, game: 'tower', ...k, home: yardPoint(angle, r) }
})

/** つみきタワーの土台と、高さのものさし */
export const TOWER_BASE = { ...yardPoint(200, 10), size: 3.6 }
export const TOWER_RULER = yardPoint(200, 10, 3.2)
/** ものさしの高さ [m] */
export const RULER_HEIGHT = 12

export const ALL_LOADS: readonly LoadDef[] = [...CONTAINERS, ...BLOCKS]

