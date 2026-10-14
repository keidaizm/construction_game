/**
 * Lv7 の「ビルをこわして、てっこつを集める」場所（ユーザー提案）。
 * - 古いビル：基地の南（地図の下）。ブレーカーで叩くと上の階から 1 つずつこわれ、がれき（コンクリートつきの鉄骨）が出る
 * - リサイクル場（緑の場所）：基地のそば。ふるいにかけた鉄骨を置くと、てっこつが手に入る
 * 3D（DemolitionSite）と地図の両方で使う。ここでは fieldLayout を読まない（fieldLayout がこちらを読むため）
 */
export const DEMOLITION_SITE = { x: 12, z: -66 }

/** ビルの大きさ：幅（ワールド X）・奥行き（Z）・1 階の高さ・階の数 */
export const BUILDING = { width: 7, depth: 6, floorHeight: 2.6, floors: 3 }

/** 1 つの階をこわすのに叩く時間 [s] */
export const FLOOR_HP = 3
/** 1 つの階がこわれると出るがれきの数 */
export const PIECES_PER_FLOOR = 2
/** 全部こわしてから、ビルが元に戻るまで [s]（ユーザー判断：一定時間で復活） */
export const REBUILD_DELAY = 30

/** リサイクル場（緑の場所）。ここで止まった鉄骨を、てっこつとして集める */
export const RECYCLE_YARD = { x: 18, z: -28, radius: 5 }

/** てっこつ集めのお題をクリアしたときにもらえる星 */
export const STEEL_STARS = 2

/** ビル・リサイクル場のまわりで、木・岩・丘を置かない範囲 */
export function nearDemolition(x: number, z: number, margin = 0) {
  return Math.hypot(x - DEMOLITION_SITE.x, z - DEMOLITION_SITE.z) < 16 + margin || Math.hypot(x - RECYCLE_YARD.x, z - RECYCLE_YARD.z) < RECYCLE_YARD.radius + 7 + margin
}
