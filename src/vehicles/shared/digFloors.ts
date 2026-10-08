/**
 * バケットがそれより下へ入れない「床」（地面以外）。例：ダンプの荷台の床。
 * 床を持つ車両が毎フレーム登録し、ショベルカーはバケット先端の真下にある床の高さを問い合わせる。
 */
export interface DigFloor {
  x: number
  z: number
  heading: number
  /** ローカル X / Z 方向の半分の大きさ */
  halfWidth: number
  halfLength: number
  /** 床の上面の高さ（ワールド Y） */
  top: number
  /** こぼした岩を、この床の中へ寄せる対象にしない（大きな岩の上など。ダンプの荷台だけが対象） */
  noLanding?: boolean
}

const floors = new Map<string, DigFloor>()

export function setDigFloor(id: string, floor: DigFloor | null) {
  if (floor) floors.set(id, floor)
  else floors.delete(id)
}

/** (x, z) の真下にある床の上面の高さ。床がなければ null */
export function digFloorTopAt(x: number, z: number): number | null {
  let best: number | null = null
  for (const f of floors.values()) {
    const dx = x - f.x
    const dz = z - f.z
    const s = Math.sin(f.heading)
    const c = Math.cos(f.heading)
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    if (Math.abs(lx) <= f.halfWidth && Math.abs(lz) <= f.halfLength) best = Math.max(best ?? -Infinity, f.top)
  }
  return best
}

/**
 * (x, z) が床の近く（外側 margin 以内）なら、床の内側（端から inset 内側）で一番近い点を返す。
 * バケットからこぼした岩を、少しずれていても荷台の中へ落とすための補助に使う。
 */
export function landingTargetNear(
  x: number,
  z: number,
  margin: number,
  inset: number,
): { x: number; z: number; top: number } | null {
  for (const f of floors.values()) {
    if (f.noLanding) continue
    const s = Math.sin(f.heading)
    const c = Math.cos(f.heading)
    const dx = x - f.x
    const dz = z - f.z
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    if (Math.abs(lx) > f.halfWidth + margin || Math.abs(lz) > f.halfLength + margin) continue
    const cx = Math.max(-(f.halfWidth - inset), Math.min(f.halfWidth - inset, lx))
    const cz = Math.max(-(f.halfLength - inset), Math.min(f.halfLength - inset, lz))
    // ローカル → ワールド（lx = dx·c − dz·s, lz = dx·s + dz·c の逆変換）
    return { x: f.x + cx * c + cz * s, z: f.z - cx * s + cz * c, top: f.top }
  }
  return null
}
