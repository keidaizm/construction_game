/**
 * 関節の transform が更新された直後に毎フレーム呼ばれる処理（油圧シリンダー・当たり判定・すくい判定）。
 * コントローラの useFrame の最後にまとめて呼ぶことで、1 フレームの遅れなく関節に追従できる。
 */
export interface RigListener {
  update: (dt: number) => void
}
