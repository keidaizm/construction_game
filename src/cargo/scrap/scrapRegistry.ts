import type { RapierRigidBody } from '@react-three/rapier'

/** がれき（鉄骨）の大きさ：長さ（ローカル X）・高さ・幅。ダンプの荷台・スケルトンバケットに横向きで入る */
export const SCRAP = { length: 1.0, height: 0.26, width: 0.3 }
/** 用意しておくがれきの数（遊んでいる最中に物理ボディを作らない）。ビル 1 つで 6 こ出る */
export const SCRAP_POOL = 16

/**
 * がれきの状態
 * - pooled：控え（遠くに止めてある）
 * - free：地面などにあって物理で動く
 * - held：スケルトンバケットに入っている
 * - truck：ダンプの荷台に載っている
 */
export type ScrapState = 'pooled' | 'free' | 'held' | 'truck'

/**
 * がれきの中身
 * - mixed：コンクリートのかたまりがついた鉄骨（ビルをこわすと出る。リサイクル場では数えない）
 * - steel：ふるいにかけて、コンクリートが落ちた鉄骨（リサイクル場で、てっこつになる）
 */
export type ScrapKind = 'mixed' | 'steel'

export interface ScrapEntry {
  id: string
  body: RapierRigidBody
  state: ScrapState
  kind: ScrapKind
  /** ふるった度合い（0〜1。1 で steel になる） */
  sift: number
  /** この時刻（scrapRegistry.now）までは、スケルトンバケットでまたすくわない */
  grabCooldownUntil: number
  /** コンクリートの見た目（mixed のときだけ見せる） */
  concrete: { visible: boolean } | null
}

/**
 * がれきの一覧。useFrame から読むので React の state にしない。
 * spawn / despawn / setKind は物理エンジン・見た目が必要なので ScrapField が中身を差し込む。
 */
export const scrapRegistry = {
  pieces: [] as ScrapEntry[],
  /** いまの時刻 [s]（ScrapField が毎フレーム進める） */
  now: 0,
  /** がれきを 1 こ出す（yaw は長い向き）。控えがなければ出さない */
  spawn: null as ((x: number, y: number, z: number, yaw: number) => ScrapEntry | null) | null,
  despawn: null as ((piece: ScrapEntry) => void) | null,
}

/** 中身を変える（ふるい終わったら steel）。見た目もそろえる */
export function setScrapKind(piece: ScrapEntry, kind: ScrapKind) {
  piece.kind = kind
  piece.sift = kind === 'steel' ? 1 : 0
  if (piece.concrete) piece.concrete.visible = kind === 'mixed'
}
