import type { VehicleId } from '../vehicles/types'
import { createWebAudioManager } from './webAudio'

/**
 * サウンドの窓口。車両やミッションのロジックはこのインターフェースだけを呼び、音の作り方は知らない。
 * 実装は webAudio.ts（効果音ファイルを使わず、ブラウザの音声合成で作る）。
 */
export type SoundId =
  /** バケットで石をすくった「ゴトッ」 */
  | 'rockHit'
  /** 石を落とした「ゴロッ」 */
  | 'rockDrop'
  /** 石がダンプの荷台に載った「ゴトン」 */
  | 'rockLoad'
  /** おきばで石を 1 こ数えた「ポコッ」 */
  | 'count'
  /** クリアのファンファーレ */
  | 'missionClear'
  /** グレードアップ */
  | 'levelUp'
  /** 乗り換え・ボタン */
  | 'switch'
  /** 土ブロックが崩れた「ザクッ」 */
  | 'dig'
  /** 鉱石を見つけた「キラン」 */
  | 'find'
  /** はじめての鉱石を見つけた（もっと豪華に） */
  | 'findNew'
  /** 油圧ブレーカーで岩を叩く「ガッ」 */
  | 'hammer'
  /** 大きな岩が割れた「ガラガラッ」 */
  | 'crack'

export interface AudioManager {
  play(id: SoundId): void
  /** 乗っている車両のエンジン。load は 0〜1（回転数・音量の元になる） */
  setEngine(vehicle: VehicleId, load: number): void
  /** 0〜1。油圧作動音の強さ */
  setHydraulicLoad(load: number): void
  /** ダンプがバックしているか（ピッ、ピッ の警告音） */
  setReversing(on: boolean): void
  muted: boolean
  setMuted(muted: boolean): void
}

export const audio: AudioManager = createWebAudioManager()
