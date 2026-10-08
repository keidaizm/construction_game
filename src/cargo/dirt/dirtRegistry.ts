import type { OuterBiome } from '../../world/biomes'

/**
 * 土の山の一覧。ショベルのバケットが山に入ったときに、どの山のどのブロックを崩すかを問い合わせる。
 */
export interface DirtMoundHandle {
  id: string
  center: readonly [number, number]
  /** 宝の山なら、その地帯 */
  treasure?: OuterBiome
  /**
   * (x, y, z) の点（バケットの先）が山のブロックに入っていたら、その列のいちばん上のブロックを崩す。
   * 崩したブロックの中心の座標を返す（崩さなかったら null）
   */
  tryDig(x: number, y: number, z: number): { x: number; y: number; z: number } | null
}

export const dirtRegistry = {
  mounds: [] as DirtMoundHandle[],
  add(m: DirtMoundHandle) {
    this.mounds.push(m)
  },
  remove(m: DirtMoundHandle) {
    const i = this.mounds.indexOf(m)
    if (i >= 0) this.mounds.splice(i, 1)
  },
}
