/**
 * Lv8・Lv9 の工事現場（ユーザー提案「集めた鉄骨と石材で塔（東京タワーみたいなもの）やビルを建てる」）。
 * 基地の東がわ（ワールドの -X ＝地図で基地の右）。ビルの区画が 3 つ縦に並び、その奥にタワー。
 * それぞれの前に黄色い輪（資材置き場）があり、石を置くと 1 こずつ使われる。てっこつは持っている分から使う。
 * 3D（CitySite）と地図の両方で使う。ここでは fieldLayout を読まない（fieldLayout がこちらを読むため）
 */
export const CITY = { x: -54, z: 28 }

/** ビル（Lv8）：区画（ビルの中心）。基地に近い順ではなく、地図の上から順に建てる */
export const OFFICE_PLOTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: -44, z: 42 },
  { x: -44, z: 28 },
  { x: -44, z: 14 },
]
/** ビルの大きさ：幅（X）・奥行き（Z）・1 階の高さ・階の数 */
export const OFFICE = { width: 8, depth: 8, floorHeight: 3.2, floors: 4 }
/** 1 階に使う石・てっこつ */
export const OFFICE_FLOOR_COST = { stones: 4, steel: 1 }
/** ビルができたときにもらえる星 */
export const OFFICE_STARS = 3
/** ビルの資材置き場（基地がわ＝ +X に 11m） */
export const officeRing = (i: number) => ({ x: OFFICE_PLOTS[i].x + 11, z: OFFICE_PLOTS[i].z })

/** タワー（Lv9）：東京タワーのような、赤と白の鉄骨の塔 */
export const TOWER = { x: -70, z: 30 }
/** タワーの資材置き場（南がわ） */
export const TOWER_RING = { x: TOWER.x, z: TOWER.z - 15 }
/** 1 段に使う石・てっこつ */
export const TOWER_STAGE_COST = { stones: 3, steel: 2 }
/** タワーができたときにもらえる星 */
export const TOWER_STARS = 5

/**
 * タワーの段（下から）。frame = 鉄骨の骨組み（下の半幅 → 上の半幅）、deck = 展望台（箱）
 * 色は赤と白をかわりばんこ（東京タワーのように）
 */
export const TOWER_STAGES: ReadonlyArray<{ kind: 'frame' | 'deck'; y0: number; y1: number; half0: number; half1: number; white: boolean }> = [
  { kind: 'frame', y0: 0, y1: 9, half0: 6, half1: 3.3, white: false },
  { kind: 'frame', y0: 9, y1: 15, half0: 3.3, half1: 2.4, white: true },
  { kind: 'deck', y0: 15, y1: 17.5, half0: 3.1, half1: 3.1, white: true },
  { kind: 'frame', y0: 17.5, y1: 25, half0: 2.2, half1: 1.3, white: false },
  { kind: 'deck', y0: 25, y1: 26.6, half0: 1.6, half1: 1.6, white: true },
  { kind: 'frame', y0: 26.6, y1: 36, half0: 0.9, half1: 0.12, white: false },
]

/** 資材置き場の輪の半径 [m] */
export const CITY_RING_RADIUS = 4.5

/** 工事現場のまわりで、木・岩・丘を置かない範囲 */
export function nearCity(x: number, z: number, margin = 0) {
  return Math.hypot(x - CITY.x, z - CITY.z) < 32 + margin
}

/**
 * 高くしていけるビル（Lv10）：屋上にタワークレーンがあり、地面の置き場の鉄骨をつり上げて屋上の黄色い枠に置くと、
 * 1 階高くなってクレーンもせり上がる（実際の高層ビルのクライミングクレーン工法をまねた。ユーザー提案）。
 * 工事現場の北のすみ（nearCity の中なので、木・岩・丘はもうない）
 */
export const SKYSCRAPER = { x: -66, z: 50, width: 9, depth: 9, floorHeight: 3.2, startFloors: 2, maxFloors: 30 }
/** 1 階に使う鉄骨の本数（ユーザー判断：2〜3 本） */
export const SKY_BEAMS_PER_FLOOR = 2
/** 1 階高くなるともらえる星 */
export const SKY_FLOOR_STARS = 1
/** 鉄骨の置き場（地面。屋上のクレーンの腕が届く所） */
export const SKY_STOCK = { x: -55, z: 52 }
/** 地面に出しておく鉄骨の数（持っている てっこつの数まで） */
export const SKY_STOCK_MAX = 4
/** 鉄骨の大きさ（長い向きはローカル X） */
export const SKY_BEAM_SIZE = [3, 0.45, 0.6] as const
/**
 * 屋上の枠：鉄骨を置く 2 か所（ビルの中心から Z へずらす。鉄骨は X 向き）。
 * クレーンの塔は屋上のまん中にあり、トロリーは塔から 3.5m より近くへ来ないので、ふちの近くに置く
 */
export const SKY_SLOTS = [-3.7, 3.7] as const
/** この距離 [m] まで車両で近づくと「クレーンに のる？」が出る */
export const SKY_BOARD_RADIUS = 16
/** 高いビルの屋上の高さ（階の数から） */
export const skyRoofY = (floors: number) => 0.3 + floors * SKYSCRAPER.floorHeight
