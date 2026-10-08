import { create } from 'zustand'
import { BOULDERS, FELLABLE_TREES, STATIC_OBSTACLES, isKeepClear, type TreeKind } from './fieldLayout'
import { BIOME_ANGLE, biomeAt, type OuterBiome } from './biomes'
import { isInWater } from './waterLayout'

/**
 * 倒せる木（外がわの地帯の木。Lv5 からブルドーザーで倒せる）。
 * 倒すと木材が出て、少しすると同じ地帯の、木の少ない場所にまた生えてくる（ユーザー提案）。
 * 状態は毎フレーム読むので React の state にしない（地図用に version だけ zustand で持つ）。
 */
export type ForestTreeState = 'standing' | 'falling' | 'gone' | 'growing'

export interface ForestTree {
  id: number
  kind: TreeKind
  biome: OuterBiome
  x: number
  z: number
  r: number
  scale: number
  rotation: number
  state: ForestTreeState
  /** いまの状態になってからの時間 [s] */
  t: number
  /** 倒れる向き（ブルドーザーの向き） */
  fallYaw: number
  /** ブルドーザーに押されている時間 [s]（ゆれる・たまると倒れる） */
  push: number
}

export const forest: { trees: ForestTree[] } = {
  trees: FELLABLE_TREES.map((t, id) => ({
    id,
    kind: t.kind,
    biome: t.biome as OuterBiome,
    x: t.x,
    z: t.z,
    r: t.r,
    scale: t.scale,
    rotation: t.rotation,
    state: 'standing',
    t: 0,
    fallYaw: 0,
    push: 0,
  })),
}

/** 外（セーブから戻すときなど）で木の状態を書きかえたら true にする（TreeField が見た目と障害物を直す） */
export const forestDirty = { value: false }

/** 地図用：木の場所が変わったら増える */
export const useForestStore = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}))

/**
 * また生える場所をさがす：同じ地帯の中で、ほかの木から離れた（木の少ない）所。
 * avoid（車両の場所など）からも離す。見つからなければ null
 */
export function findRegrowSpot(tree: ForestTree, avoid: ReadonlyArray<{ x: number; z: number }>): { x: number; z: number } | null {
  const center = (BIOME_ANGLE[tree.biome] * Math.PI) / 180
  let best: { x: number; z: number; crowd: number } | null = null
  for (let i = 0; i < 50; i++) {
    const a = center + (Math.random() - 0.5) * ((80 * Math.PI) / 180)
    const d = 65 + Math.random() * 100
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    if (biomeAt(x, z) !== tree.biome || isKeepClear(x, z) || isInWater(x, z, 4)) continue
    if (STATIC_OBSTACLES.some((o) => Math.abs(o.x - x) < 8 && Math.abs(o.z - z) < 8 && Math.hypot(o.x - x, o.z - z) < o.r + tree.r + 3)) continue
    if (BOULDERS.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + tree.r + 3)) continue
    if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 12)) continue
    let crowd = 0
    let tooClose = false
    for (const other of forest.trees) {
      if (other === tree || other.state === 'gone') continue
      const dist = Math.hypot(other.x - x, other.z - z)
      if (dist < other.r + tree.r + 5.5) tooClose = true
      if (dist < 25) crowd++
    }
    if (tooClose) continue
    if (!best || crowd < best.crowd) best = { x, z, crowd }
  }
  return best
}
