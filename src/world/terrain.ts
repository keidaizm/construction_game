import { seededRandom } from './textures'
import { biomeAt, type Biome } from './biomes'
import { DELIVERY_ZONE } from '../missions/missionConfig'
import { ROCK_SITES } from '../cargo/rocks/rockSites'
import { ALL_MOUNDS } from '../cargo/dirt/dirtConfig'
import { BRIDGES, LAKES, bridgePose, isInWater } from './waterLayout'
import { CHESTS, SIGHTS } from './discoveryLayout'
import { BUILD_SITE, FIELD, LANDMARKS } from './fieldLayout'

/**
 * 坂や丘（ユーザー要望「景色に変化を」）。なだらかな丸い丘をいくつか置き、車両は丘にそって傾いて走る。
 * 遊びに使う場所（基地・おきば・石の置き場・土の山・水・名所・宝箱）は平らなまま（丘はそこから離して置く）。
 * 見た目の地面（Ground）と石の当たり判定（HillColliders）は、同じ heightAt から作る。
 */
export interface Hill {
  x: number
  z: number
  /** 丘のすその半径 [m] */
  r: number
  /** 高さ [m] */
  h: number
}

/** 地帯ごとの丘の多さと高さ（岩山は高く、草原・森はなだらか） */
const HILL_RULES: Record<Biome, { chance: number; minH: number; maxH: number }> = {
  base: { chance: 0, minH: 0, maxH: 0 },
  snow: { chance: 0.8, minH: 1.8, maxH: 3.2 },
  forest: { chance: 0.7, minH: 1.4, maxH: 2.6 },
  desert: { chance: 0.9, minH: 1.6, maxH: 3 },
  rocky: { chance: 1, minH: 2.6, maxH: 4.5 },
}

/** 平らでないといけない場所か（丘を置かない） */
function needsFlat(x: number, z: number) {
  if (Math.hypot(x, z) < 45) return true
  if (Math.hypot(x - LANDMARKS.crane.x, z - LANDMARKS.crane.z) < 24) return true
  if (Math.hypot(x - BUILD_SITE.x, z - BUILD_SITE.z) < BUILD_SITE.radius + 4) return true
  if (Math.hypot(x - DELIVERY_ZONE.x, z - DELIVERY_ZONE.z) < DELIVERY_ZONE.radius + 12) return true
  if (ROCK_SITES.some((s) => Math.hypot(x - s.center[0], z - s.center[1]) < 20)) return true
  if (ALL_MOUNDS.some((m) => Math.hypot(x - m.center[0], z - m.center[1]) < 14)) return true
  if (isInWater(x, z, 8) || LAKES.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 8)) return true
  if (BRIDGES.some((b) => {
    const p = bridgePose(b)
    return Math.hypot(x - p.x, z - p.z) < 20
  }))
    return true
  if (SIGHTS.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + 8)) return true
  return CHESTS.some((c) => Math.hypot(x - c.x, z - c.z) < 8)
}

/** 丘の範囲（すそ＋少し）がどこも平らでなくてよい場所か */
function hillFits(x: number, z: number, r: number) {
  for (let dx = -r; dx <= r; dx += 4)
    for (let dz = -r; dz <= r; dz += 4) if (dx * dx + dz * dz <= r * r && needsFlat(x + dx, z + dz)) return false
  return Math.abs(x) + r < FIELD.driveLimit + 20 && Math.abs(z) + r < FIELD.driveLimit + 20
}

export const HILLS: readonly Hill[] = (() => {
  const rand = seededRandom(91)
  const hills: Hill[] = []
  for (let i = 0; i < 400 && hills.length < 22; i++) {
    const a = rand() * Math.PI * 2
    const d = 60 + rand() * 110
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    const r = 14 + rand() * 12
    const rule = HILL_RULES[biomeAt(x, z)]
    if (rand() > rule.chance) continue
    if (hills.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + r + 6)) continue
    if (!hillFits(x, z, r + 2)) continue
    hills.push({ x, z, r, h: rule.minH + rand() * (rule.maxH - rule.minH) })
  }
  return hills
})()

/** (x, z) の地面の高さ [m]（丘の外は 0） */
export function heightAt(x: number, z: number) {
  for (const hill of HILLS) {
    const dx = x - hill.x
    const dz = z - hill.z
    if (Math.abs(dx) > hill.r || Math.abs(dz) > hill.r) continue
    const d = Math.hypot(dx, dz)
    if (d < hill.r) return hill.h * 0.5 * (1 + Math.cos((Math.PI * d) / hill.r))
  }
  return 0
}
