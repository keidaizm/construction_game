import { ROCK_SITES } from '../cargo/rocks/rockSites'
import { DELIVERY_ZONE } from '../missions/missionConfig'
import { ALL_MOUNDS } from '../cargo/dirt/dirtConfig'
import { seededRandom } from './textures'
import { biomeAt, type Biome } from './biomes'
import { BRIDGES, bridgePose, isInWater, LAKES, WATER_OBSTACLES } from './waterLayout'
import { CHEST_RADIUS, CHESTS, SIGHTS } from './discoveryLayout'

/**
 * フィールドの配置（3D の表示と地図の両方で使う）。
 * 木・大きな岩・目印の建物は、車両がぶつかると止まる（footprints の静的な障害物）。
 */
export const FIELD = {
  /** 地面の大きさ（一辺） [m] */
  groundSize: 520,
  /** 車両が走れる範囲（±） [m] */
  driveLimit: 170,
}

export interface Obstacle {
  x: number
  z: number
  /** ぶつかる半径 [m] */
  r: number
}

export interface Prop extends Obstacle {
  scale: number
  rotation: number
}

/** 家を建てる場所（Lv6）。基地の左がわ（地図で基地のすぐ左＝ワールドの +X がわ。ユーザー指定）。区画が縦に並ぶので少し広め */
export const BUILD_SITE = { x: 48, z: 9, radius: 22 }

/** タワークレーンの根元と、まわりの置き場（ミニゲームの道具を置く。腕の届く範囲より少し広く） */
const CRANE_SITE = { x: -26, z: -18, yardRadius: 22 }

/** 木や岩を置かない場所（基地・おきば・岩置き場・ダンプの通り道） */
export function isKeepClear(x: number, z: number) {
  if (Math.hypot(x - CRANE_SITE.x, z - CRANE_SITE.z) < CRANE_SITE.yardRadius) return true
  if (Math.hypot(x - BUILD_SITE.x, z - BUILD_SITE.z) < BUILD_SITE.radius) return true
  if (Math.hypot(x, z) < 22) return true
  if (Math.hypot(x - DELIVERY_ZONE.x, z - DELIVERY_ZONE.z) < DELIVERY_ZONE.radius + 7) return true
  if (x > -3 && x < 12 && z > -5 && z < 40) return true
  if (isInWater(x, z, 4) || LAKES.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 4)) return true
  // 名所と宝箱のまわり（見つけやすく、たどり着けるように）
  if (SIGHTS.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + 8)) return true
  if (CHESTS.some((c) => Math.hypot(x - c.x, z - c.z) < 7)) return true
  // 橋の前後は、木でふさがないように広くあける
  if (
    BRIDGES.some((b) => {
      const p = bridgePose(b)
      return Math.hypot(x - p.x, z - p.z) < 16
    })
  )
    return true
  if (ALL_MOUNDS.some((m) => Math.hypot(x - m.center[0], z - m.center[1]) < 10)) return true
  return ROCK_SITES.some((s) => Math.hypot(x - s.center[0], z - s.center[1]) < 12)
}

/** 木の種類（地帯で変わる） */
export type TreeKind = 'pine' | 'snowPine' | 'round' | 'cactus' | 'palm'

export interface TreeProp extends Prop {
  kind: TreeKind
  biome: Biome
  /** ブルドーザーで倒せる木（外がわの地帯の木。サボテン・ヤシ・基地のまわりの木はのぞく） */
  fellable: boolean
}

export interface BoulderProp extends Prop {
  biome: Biome
}

/** 地帯ごとの木の多さ（0〜1）と種類 */
const TREE_RULES: Record<Biome, { density: number; kinds: readonly TreeKind[] }> = {
  base: { density: 0.25, kinds: ['pine'] },
  snow: { density: 0.55, kinds: ['snowPine'] },
  forest: { density: 0.7, kinds: ['round', 'round', 'pine'] },
  desert: { density: 0.22, kinds: ['cactus'] },
  rocky: { density: 0.15, kinds: ['pine'] },
}
/** 地帯ごとの大きな岩の多さ（0〜1） */
const BOULDER_DENSITY: Record<Biome, number> = { base: 0.3, snow: 0.3, forest: 0.15, desert: 0.3, rocky: 1 }

/** フィールドに散らばらせる（基地・岩置き場などは避け、地帯ごとの多さで間引く） */
function scatter<T extends Prop>(
  candidates: number,
  seed: number,
  minR: number,
  maxR: number,
  radius: (scale: number) => number,
  accept: (x: number, z: number, rand: () => number, base: Prop) => T | null,
): T[] {
  const rand = seededRandom(seed)
  const props: T[] = []
  for (let i = 0; i < candidates; i++) {
    const a = rand() * Math.PI * 2
    const d = minR + Math.sqrt(rand()) * (maxR - minR)
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    const scale = 0.8 + rand() * 0.8
    const r = radius(scale)
    const rotation = rand() * Math.PI * 2
    if (isKeepClear(x, z)) continue
    // 木と木の間はダンプが通れるくらいあける
    if (props.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 5.5)) continue
    const prop = accept(x, z, rand, { x, z, r, scale, rotation })
    if (prop) props.push(prop)
  }
  return props
}

/** 地帯ごとに散らばる木 */
const BIOME_TREES: readonly TreeProp[] = scatter(320, 21, 25, FIELD.driveLimit - 5, (s) => 0.9 * s, (x, z, rand, base) => {
  const biome = biomeAt(x, z)
  const rule = TREE_RULES[biome]
  if (rand() > rule.density) return null
  const kind = rule.kinds[Math.floor(rand() * rule.kinds.length)]
  return { ...base, kind, biome, fellable: biome !== 'base' && kind !== 'cactus' }
})
/** 砂漠のオアシスのまわりのヤシの木 */
const PALMS: readonly TreeProp[] = (() => {
  const oasis = LAKES[1]
  return [0.3, 1.5, 2.6, 3.7, 4.9].map((a, i) => ({
    x: oasis.x + Math.sin(a) * (oasis.r + 3),
    z: oasis.z + Math.cos(a) * (oasis.r + 3),
    r: 0.8,
    scale: 0.9 + (i % 3) * 0.15,
    rotation: a,
    kind: 'palm' as const,
    biome: 'desert' as const,
    fellable: false,
  }))
})()

/** 木（幹の半径より少し大きめにぶつかる）。地帯で種類と多さが変わる */
export const TREES: readonly TreeProp[] = [...BIOME_TREES, ...PALMS]
/** 倒れない木（いつもそこにある）と、倒せる木（world/forest.ts が場所と状態を持つ） */
export const STATIC_TREES: readonly TreeProp[] = TREES.filter((t) => !t.fellable)
export const FELLABLE_TREES: readonly TreeProp[] = TREES.filter((t) => t.fellable)

/** 大きな岩（飾り。すくえない）。岩山に多い */
export const BOULDERS: readonly BoulderProp[] = scatter(110, 57, 28, FIELD.driveLimit - 5, (s) => 1.6 * s, (x, z, rand, base) => {
  const biome = biomeAt(x, z)
  if (rand() > BOULDER_DENSITY[biome]) return null
  return { ...base, biome }
})

/** 目印（遠くからでも分かる建物） */
export const LANDMARKS = {
  crane: { x: CRANE_SITE.x, z: CRANE_SITE.z, r: 2.2 },
  hut: { x: -18, z: 16, r: 3.4 },
} as const

/** 大きな岩は割れて消えることがあるので、ここには入れない（BoulderField が動く障害物として登録する） */
export const STATIC_OBSTACLES: readonly Obstacle[] = [...STATIC_TREES, LANDMARKS.crane, LANDMARKS.hut, ...WATER_OBSTACLES, ...SIGHTS, ...CHESTS.map((c) => ({ x: c.x, z: c.z, r: CHEST_RADIUS }))]
