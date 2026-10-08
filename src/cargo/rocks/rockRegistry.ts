import type * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import type { RockColor, RockKind } from './rockTypes'

/**
 * 岩の状態
 * - free : 地面などに置かれていて、物理演算で動く
 * - held : バケットに入っていて、バケットに追従する（物理は止めている）
 * - truck : ダンプの荷台に載っていて、荷台に追従する（物理は止めている）
 * - pooled : 土の山から出てくる岩の控え（見えない所に止めてある。数えない・すくえない）
 *
 * おきばに運んだかどうかは状態で持たず、毎回「いま円の中にあるか」で数える（転がり出たら数が減る）
 */
export type RockState = 'free' | 'held' | 'truck' | 'pooled'

export interface RockEntry {
  id: number
  kind: RockKind
  color: RockColor
  radius: number
  body: RapierRigidBody
  mesh: THREE.Mesh
  /** 初期位置（リセット・場外に出たときに戻す） */
  home: readonly [number, number, number]
  state: RockState
  /** この時刻（秒）までは再びすくわれない（落とした直後に吸い込まれないように） */
  grabCooldownUntil: number
  /**
   * 最後に「落とされた回」の番号（バケットからこぼした／荷台から降ろした 1 回ごとに増える）。
   * 同じ番号の岩を 1 つの数としてまとめ、2 + 3 = 5 のような式を作る。0 = まだ落とされていない
   */
  batchId: number
  /** 土の山から出てくる用の控えの岩か（リセットで控えに戻る） */
  pooled: boolean
}

/**
 * 岩の一覧。useFrame から毎フレーム読むので React の state にはしない。
 * バケット・ダンプ・ミッション判定などはここを参照する。
 */
export const rockRegistry = {
  rocks: [] as RockEntry[],
  lastBatchId: 0,
  /** 新しい「落とす回」の番号を発行する */
  nextBatchId() {
    return ++this.lastBatchId
  },
  /**
   * 控えの岩を 1 こ、指定の場所に出す（土の山を崩したとき）。出せたら true。
   * 物理エンジンの操作が必要なので、RockField が中身を差し込む
   */
  spawn: null as ((color: RockColor, x: number, y: number, z: number) => boolean) | null,
  /** 控えの岩を控えの場所へ戻す（金色の石をすくったとき）。RockField が中身を差し込む */
  despawn: null as ((rock: RockEntry) => void) | null,
  add(entry: RockEntry) {
    this.rocks.push(entry)
  },
  remove(entry: RockEntry) {
    const i = this.rocks.indexOf(entry)
    if (i >= 0) this.rocks.splice(i, 1)
  },
}
