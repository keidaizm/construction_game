import * as THREE from 'three'
import type { ExcavatorTool } from '../../stores/gameStore'

/**
 * ショベルカーの状態のうち、他のシステム（「とれる」マーカー、将来のミッション判定など）が
 * 毎フレーム読むもの。コントローラが毎フレーム書き込む。React の state ではない。
 */
export const excavatorSensors = {
  /** ショベル（本体・ブーム・アーム）の大きさの倍率（Lv5 から 1.3） */
  scale: 1,
  /** 位置と向き（地図・道案内用） */
  x: 0,
  z: 0,
  heading: 0,
  /** 運転席（上部旋回体）の向き。夜のライトはこちらを向く */
  cabHeading: 0,
  /** バケット先端のワールド座標 */
  bucketTip: new THREE.Vector3(),
  /** バケットの口の上向き度合い（+1 真上 / 0 横 / -1 真下） */
  bucketOpenUp: 0,
  /** バケットの開き具合（0 = いちばん巻き込んだ / 1 = いちばん開いた） */
  bucketOpenRatio: 0,
  /** バケットのレバー（+ 開く / - 巻き込む、-1〜1） */
  bucketLever: 0,
  /** すくう動きをしているか（アームを引いている・バケットを巻き込んでいる）。石を引き寄せる合図 */
  scooping: false,
  /** いま付けているアタッチメント */
  tool: 'bucket' as ExcavatorTool,
  /** グラップルのつめの開き具合（0 = 閉じた / 1 = いちばん開いた） */
  grappleOpen: 0.6,
  /** ブレーカーで岩を叩いているところか（のみを振動させる） */
  hammering: false,
  /** いまバケットに入っている岩の数 */
  heldCount: 0,
  /** バケットの空き（0 なら満杯） */
  freeSlots: 0,
}
