import * as THREE from 'three'

/**
 * 地帯（バイオーム）。基地のまわりはいつもの土、離れると方角ごとに景色が変わる（ユーザー要望「砂漠だけだと単調」）。
 * 方角は地図と同じ：北 = スタートの前（+Z）、西 = +X（車両ローカルの +X が左のため、地図では左）。
 *   北：雪原 / 東：草原と森 / 南：砂漠 / 西：岩山
 */
export type Biome = 'base' | 'snow' | 'forest' | 'desert' | 'rocky'
export type OuterBiome = Exclude<Biome, 'base'>

export const BIOME_INFO: Record<Biome, { name: string; ground: string; map: string }> = {
  base: { name: 'げんば', ground: '#b48d5e', map: '#d2b48a' },
  snow: { name: 'ゆきの はら', ground: '#eef3f7', map: '#f4f7fa' },
  forest: { name: 'もり', ground: '#6e9c45', map: '#9cc76e' },
  desert: { name: 'さばく', ground: '#e3c58e', map: '#f0dca8' },
  rocky: { name: 'いわやま', ground: '#8e8881', map: '#b3aca4' },
}

/** 各地帯のまん中の方角（度。0 = 北 +Z、90 = 西 +X） */
export const BIOME_ANGLE: Record<OuterBiome, number> = { snow: 0, rocky: 90, desert: 180, forest: 270 }
export const OUTER_BIOMES: readonly OuterBiome[] = ['snow', 'rocky', 'desert', 'forest']

/** この距離までは基地の土、ここから外へ向かって地帯に変わる [m] */
const BASE_RADIUS = 45
const BLEND_RADIUS = 75
/** 地帯の境目をぼかす角度の幅（境目 45° の前後） [度] */
const EDGE = 12

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** (x, z) の方角 [度]（0〜360。0 = 北 +Z、90 = 西 +X） */
export const angleOf = (x: number, z: number) => ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360

/** (x, z) での各地帯の混ざり具合（合計 1） */
export function biomeWeights(x: number, z: number): Record<Biome, number> {
  const outer = smooth(BASE_RADIUS, BLEND_RADIUS, Math.hypot(x, z))
  const a = angleOf(x, z)
  const w = { base: 1 - outer, snow: 0, forest: 0, desert: 0, rocky: 0 }
  let sum = 0
  const raw = OUTER_BIOMES.map((b) => {
    const d = Math.abs(((a - BIOME_ANGLE[b] + 540) % 360) - 180)
    const v = smooth(45 + EDGE, 45 - EDGE, d)
    sum += v
    return v
  })
  OUTER_BIOMES.forEach((b, i) => (w[b] = (outer * raw[i]) / sum))
  return w
}

/** (x, z) でいちばん強い地帯 */
export function biomeAt(x: number, z: number): Biome {
  const w = biomeWeights(x, z)
  let best: Biome = 'base'
  for (const b of Object.keys(w) as Biome[]) if (w[b] > w[best]) best = b
  return best
}

const groundColors = Object.fromEntries(Object.entries(BIOME_INFO).map(([k, v]) => [k, new THREE.Color(v.ground)])) as Record<Biome, THREE.Color>

/** (x, z) の地面の色（地帯の色を混ぜたもの。three の作業色空間＝リニア） */
export function groundColorAt(x: number, z: number, out = new THREE.Color()) {
  const w = biomeWeights(x, z)
  out.setRGB(0, 0, 0)
  for (const b of Object.keys(w) as Biome[]) {
    const c = groundColors[b]
    out.r += c.r * w[b]
    out.g += c.g * w[b]
    out.b += c.b * w[b]
  }
  return out
}

/** 地図用の色（sRGB の 16 進。地帯の色を混ぜたもの） */
export function mapColorAt(x: number, z: number) {
  const w = biomeWeights(x, z)
  const out = new THREE.Color(0, 0, 0)
  const c = new THREE.Color()
  for (const b of Object.keys(w) as Biome[]) {
    c.set(BIOME_INFO[b].map)
    out.r += c.r * w[b]
    out.g += c.g * w[b]
    out.b += c.b * w[b]
  }
  return `#${out.getHexString()}`
}
