import { create } from 'zustand'
import { BUILDING, DEMOLITION_SITE as SITE, FLOOR_HP, PIECES_PER_FLOOR } from './demolitionLayout'
import { scrapRegistry } from '../cargo/scrap/scrapRegistry'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'

/**
 * 古いビル（Lv7）の状態。ブレーカーで叩いている間、いちばん上の階の固さが減り、0 でその階がこわれる
 * （がれきが出て、ビルが 1 階ぶん低くなる）。全部こわれたら、しばらくして元に戻る（DemolitionSite）。
 * 毎フレーム読むので React の state にしない（地図・札用に、残りの階の数だけ zustand で持つ）。
 */
export const building = {
  /** 残っている階の数（0 = 全部こわれた） */
  floors: BUILDING.floors,
  /** いちばん上の階の残りの固さ [s] */
  hp: FLOOR_HP,
  /** 叩かれてから少しの間ゆれる（見た目） */
  shake: 0,
  /** 全部こわれた時刻（scrapRegistry.now） */
  brokenAt: 0,
  /** 見た目・当たり判定を書きかえる必要があるか */
  dirty: true,
}

/** ビルが出ているか（Lv7 から。DemolitionSite があるときだけ true） */
export const buildingActive = { value: false }

export const useBuildingStore = create<{ floors: number; setFloors: (n: number) => void }>((set) => ({
  floors: BUILDING.floors,
  setFloors: (floors) => set({ floors }),
}))

/** いまのビルの屋上の高さ [m] */
export const buildingTop = () => building.floors * BUILDING.floorHeight

/** のみの先がこれより近ければ「当たっている」（先は屋上・壁の手前で止まるので、少し広めに） */
const CONTACT = 0.7

/** のみの先がビルに当たっているか */
export function touchingBuilding(x: number, y: number, z: number) {
  if (building.floors <= 0) return false
  return (
    Math.abs(x - SITE.x) < BUILDING.width / 2 + CONTACT &&
    Math.abs(z - SITE.z) < BUILDING.depth / 2 + CONTACT &&
    y < buildingTop() + CONTACT
  )
}

/** ビルを元に戻す */
export function rebuildBuilding() {
  building.floors = BUILDING.floors
  building.hp = FLOOR_HP
  building.shake = 0
  building.dirty = true
  useBuildingStore.getState().setFloors(building.floors)
}

/**
 * ブレーカーで dt 秒叩いた。いちばん上の階がこわれたら、がれきを出す。
 * がれきはショベルのいる側の、ビルのすぐ外の地面に出す（ショベルの前に来るように。
 * のみの先はビルの中まで入るので、先の位置ではなくショベルの位置で決める）
 */
export function hitBuilding(dt: number, fromX: number, fromZ: number) {
  if (building.floors <= 0) return
  building.hp -= dt
  building.shake = 1
  building.dirty = true
  if (building.hp > 0) return

  building.floors--
  building.hp = FLOOR_HP
  if (building.floors === 0) building.brokenAt = scrapRegistry.now
  useBuildingStore.getState().setFloors(building.floors)
  audio.play('crack')
  const top = buildingTop()
  for (let k = 0; k < 8; k++)
    digEffects.dust(SITE.x + (Math.random() - 0.5) * BUILDING.width, top + Math.random() * BUILDING.floorHeight, SITE.z + (Math.random() - 0.5) * BUILDING.depth)

  // ショベルのいる側の面
  const dx = fromX - SITE.x
  const dz = fromZ - SITE.z
  const alongX = Math.abs(dx) / (BUILDING.width / 2) > Math.abs(dz) / (BUILDING.depth / 2)
  for (let k = 0; k < PIECES_PER_FLOOR; k++) {
    const side = (k - (PIECES_PER_FLOOR - 1) / 2) * 1.4 + (Math.random() - 0.5) * 0.4
    const x = alongX ? SITE.x + Math.sign(dx) * (BUILDING.width / 2 + 1.1) : SITE.x + side
    const z = alongX ? SITE.z + side : SITE.z + Math.sign(dz || 1) * (BUILDING.depth / 2 + 1.1)
    // 長い向きはビルの面にそわせる（ショベルの方から見て横向き＝すくいやすい）
    scrapRegistry.spawn?.(x, 0.6 + k * 0.4, z, alongX ? 0 : Math.PI / 2)
  }
}
