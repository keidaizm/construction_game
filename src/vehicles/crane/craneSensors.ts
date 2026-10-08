import * as THREE from 'three'

/** クレーンの状態のうち、ほかのシステム（ライト・ミニゲーム・UI）が毎フレーム読むもの */
export const craneSensors = {
  /** フックの下の先（ワールド） */
  hookTip: new THREE.Vector3(),
  /** トロリーの位置（ワールド） */
  trolley: new THREE.Vector3(),
  yaw: 0,
  /** つかんでいる荷物の id（なければ null） */
  holding: null as string | null,
}
