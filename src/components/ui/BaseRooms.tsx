import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { ownsPaint, useCraftStore } from '../../stores/craftStore'
import { useHouseStore } from '../../stores/houseStore'
import { useCraneStore } from '../../stores/craneStore'
import { explorePercent, useExplorationStore } from '../../stores/explorationStore'
import { useLevel, useProgressStore } from '../../stores/progressStore'
import { useToastStore } from '../../stores/toastStore'
import { audio } from '../../audio/AudioManager'
import { ORES, oreById, type OreId } from '../../cargo/ores/oreTypes'
import { GemIcon } from './CollectionUI'
import { ENTER_RADIUS, OFFICE } from '../../base/baseLayout'
import { DECORATIONS, PAINTS, type Cost, type PaintableVehicle } from '../../base/craftRecipes'
import { excavatorSensors } from '../../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../../vehicles/bulldozer/bulldozerSensors'
import type { VehicleId } from '../../vehicles/types'
import { BulldozerSidePictogram, ExcavatorSideIcon, TruckSidePictogram } from './icons'

const SENSORS = { excavator: excavatorSensors, dumpTruck: dumpTruckSensors, bulldozer: bulldozerSensors } as const

/** 乗っている車両が事務所の近くにいるか（0.3 秒ごと） */
function useNearOffice(vehicle: VehicleId) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (vehicle === 'crane') {
      setNear(false)
      return
    }
    const check = () => {
      const s = SENSORS[vehicle]
      setNear(Math.hypot(s.x - OFFICE.x, s.z - OFFICE.z) - OFFICE.r < ENTER_RADIUS)
    }
    check()
    const id = setInterval(check, 300)
    return () => clearInterval(id)
  }, [vehicle])
  return near
}

/** 事務所の近くに来ると出る「じむしょに はいる？」（下のまん中） */
export function BaseEnterPrompt({ vehicle }: { vehicle: VehicleId }) {
  const near = useNearOffice(vehicle)
  const open = useGameStore((s) => s.setBaseRoom)
  const room = useGameStore((s) => s.baseRoom)
  if (!near || room) return null
  return (
    <button type="button" className="crane-board base-enter" onClick={() => open('office')} aria-label="じむしょに はいる">
      <span className="base-enter__icon">🏢</span>
      <span className="crane-board__text">じむしょに はいる？</span>
    </button>
  )
}

/** 部屋の画面の枠（タイトル・とじるボタン）。まわりを押しても閉じる */
function Room({ title, emoji, children, back = true }: { title: string; emoji: string; children: ReactNode; back?: boolean }) {
  const close = () => useGameStore.getState().setBaseRoom(null)
  const stop = (e: MouseEvent) => e.stopPropagation()
  return (
    <div className="map" onClick={close} role="dialog" aria-label={title}>
      <div className="room" onClick={stop}>
        <div className="room__title">
          {back && (
            <button type="button" className="room__back" onClick={() => useGameStore.getState().setBaseRoom('office')} aria-label="メニューに もどる">
              ◀
            </button>
          )}
          <span>{emoji}</span> {title}
          <button type="button" className="room__close" onClick={close} aria-label="でる">
            でる ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

type BaseRoomId = 'garage' | 'workshop' | 'showcase'

/** じむしょ：こうぼう・しゃこ・てんじだな のメニューと、いままでの記録 */
function Office() {
  const stars = useProgressStore((s) => s.stars)
  const level = useLevel()
  const counts = useCollectionStore((s) => s.counts)
  const houses = useHouseStore((s) => s.built)
  const tower = useCraneStore((s) => s.towerBest)
  const cells = useExplorationStore((s) => s.cells)
  const decorations = useCraftStore((s) => s.decorations)
  const records: Array<[string, string, string]> = [
    ['⭐', 'ほし', `${stars}こ（Lv${level.level}）`],
    ['💎', 'こうせき', `${Object.keys(counts).length}しゅるい`],
    ['🗺️', 'たんけん', `${explorePercent(cells)}%`],
    ['🏠', 'いえ', `${houses}けん`],
    ['🧱', 'つみき タワー', `${tower.toFixed(1)}m`],
    ['🏆', 'かざり', `${decorations.length} / ${DECORATIONS.length}`],
  ]
  const go = useGameStore.getState().setBaseRoom
  const menu: Array<[BaseRoomId, string, string]> = [
    ['workshop', '🔨', 'こうぼう'],
    ['garage', '🎨', 'しゃこ'],
    ['showcase', '💎', 'てんじだな'],
  ]
  return (
    <Room title="じむしょ" emoji="🏢" back={false}>
      <div className="office__menu">
        {menu.map(([id, icon, name]) => (
          <button key={id} type="button" className="office__menu-item" onClick={() => go(id)}>
            <span className="office__menu-icon">{icon}</span>
            {name}
          </button>
        ))}
      </div>
      <div className="office__records">
        {records.map(([icon, name, value]) => (
          <div key={name} className="office__record">
            <span className="office__icon">{icon}</span>
            <span className="office__name">{name}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </Room>
  )
}

const VEHICLE_ICONS: Record<PaintableVehicle, (color: string) => ReactNode> = {
  excavator: () => <ExcavatorSideIcon />,
  dumpTruck: (c) => <TruckSidePictogram bedAngle={0} color={c} />,
  bulldozer: (c) => <BulldozerSidePictogram lift={0.3} color={c} />,
}
const VEHICLE_NAMES: Record<PaintableVehicle, string> = { excavator: 'ショベル', dumpTruck: 'ダンプ', bulldozer: 'ブルドーザー' }

/** しゃこ：車両をえらんで、持っているペンキで色をかえる */
function Garage() {
  const [vehicle, setVehicle] = useState<PaintableVehicle>('excavator')
  const owned = useCraftStore((s) => s.paints)
  const colors = useCraftStore((s) => s.vehicleColors)
  const setColor = useCraftStore((s) => s.setColor)
  return (
    <Room title="しゃこ" emoji="🎨">
      <div className="garage__vehicles">
        {(Object.keys(VEHICLE_NAMES) as PaintableVehicle[]).map((v) => (
          <button key={v} type="button" className={`garage__vehicle${v === vehicle ? ' is-on' : ''}`} onClick={() => setVehicle(v)}>
            <span className="garage__pict">{VEHICLE_ICONS[v](PAINTS.find((p) => p.id === colors[v])?.color ?? '#f2b705')}</span>
            {VEHICLE_NAMES[v]}
          </button>
        ))}
      </div>
      <div className="garage__paints">
        {PAINTS.map((p) => {
          const have = ownsPaint(owned, p.id)
          return (
            <button
              key={p.id}
              type="button"
              className={`garage__paint${colors[vehicle] === p.id ? ' is-on' : ''}${have ? '' : ' is-locked'}`}
              disabled={!have}
              onClick={() => {
                setColor(vehicle, p.id)
                audio.play('count')
              }}
            >
              <span className="garage__swatch" style={{ background: p.color, boxShadow: p.metalness > 0.3 ? 'inset 0 0 0 4px rgba(255,255,255,0.6)' : undefined }}>
                {have ? '' : '🔒'}
              </span>
              {p.name}
            </button>
          )
        })}
      </div>
      <div className="room__hint">🔒の いろは、こうぼうで ペンキを つくると ぬれるよ</div>
    </Room>
  )
}

/** 材料の表示（鉱石の色の丸・名前・持っている数 / いる数） */
function CostList({ cost }: { cost: Cost }) {
  const held = useCollectionStore((s) => s.held)
  return (
    <span className="craft__cost">
      {(Object.entries(cost) as Array<[OreId, number]>).map(([ore, n]) => {
        const o = oreById(ore)
        const have = held[ore] ?? 0
        return (
          <span key={ore} className={`craft__ore${have >= n ? ' is-enough' : ''}`}>
            <span className="craft__dot" style={{ background: o.color }} />
            {o.name} <b>{have}</b>/{n}
          </span>
        )
      })}
    </span>
  )
}

const canAfford = (held: Partial<Record<OreId, number>>, cost: Cost) => (Object.entries(cost) as Array<[OreId, number]>).every(([o, n]) => (held[o] ?? 0) >= n)

/** こうぼう：持っている鉱石で、ペンキ・かざりをつくる */
function Workshop() {
  const [tab, setTab] = useState<'paint' | 'decor'>('paint')
  const held = useCollectionStore((s) => s.held)
  const paints = useCraftStore((s) => s.paints)
  const decorations = useCraftStore((s) => s.decorations)
  const craft = useCraftStore((s) => s.craft)
  const make = (kind: 'paint' | 'decor', id: string, name: string, cost: Cost) => {
    if (!craft(kind, id, cost)) return
    audio.play('findNew')
    useToastStore.getState().show({ title: `${name}が できた！`, icon: 'star', color: '#ffc933', stars: 0, isNew: true })
  }
  const items =
    tab === 'paint'
      ? PAINTS.filter((p) => p.cost).map((p) => ({ id: p.id, name: p.name, cost: p.cost!, done: paints.includes(p.id), swatch: p.color, emoji: '' }))
      : DECORATIONS.map((d) => ({ id: d.id, name: d.name, cost: d.cost, done: decorations.includes(d.id), swatch: '', emoji: d.emoji }))
  return (
    <Room title="こうぼう" emoji="🔨">
      <div className="zukan__tabs">
        <button type="button" className={`zukan__tab${tab === 'paint' ? ' is-active' : ''}`} onClick={() => setTab('paint')}>
          🎨 ペンキ <small>{paints.length} / {PAINTS.filter((p) => p.cost).length}</small>
        </button>
        <button type="button" className={`zukan__tab${tab === 'decor' ? ' is-active' : ''}`} onClick={() => setTab('decor')}>
          🏆 かざり <small>{decorations.length} / {DECORATIONS.length}</small>
        </button>
      </div>
      <div className="craft__list">
        {items.map((it) => {
          const ok = canAfford(held, it.cost)
          return (
            <div key={it.id} className={`craft__row${it.done ? ' is-done' : ''}`}>
              <span className="craft__icon">{it.swatch ? <span className="garage__swatch" style={{ background: it.swatch }} /> : it.emoji}</span>
              <span className="craft__name">{it.name}</span>
              <CostList cost={it.cost} />
              {it.done ? (
                <span className="craft__done">もってる ✓</span>
              ) : (
                <button type="button" className="craft__make" disabled={!ok} onClick={() => make(tab, it.id, it.name, it.cost)}>
                  つくる
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="room__hint">{tab === 'paint' ? 'つくった ペンキは、しゃこで くるまに ぬれるよ' : 'つくった かざりは、じむしょの てんじだなで みられるよ'}</div>
    </Room>
  )
}

/** てんじだな：見つけた鉱石（宝石）と、つくったかざり */
function Showcase() {
  const counts = useCollectionStore((s) => s.counts)
  const held = useCollectionStore((s) => s.held)
  const decorations = useCraftStore((s) => s.decorations)
  const found = ORES.filter((o) => (counts[o.id] ?? 0) > 0)
  const owned = DECORATIONS.filter((d) => decorations.includes(d.id))
  return (
    <Room title="てんじだな" emoji="💎">
      <div className="showcase__label">
        🏆 かざり <b>{owned.length}</b> / {DECORATIONS.length}
      </div>
      <div className="showcase__shelf">
        {owned.length === 0 ? (
          <div className="showcase__empty">かざりは まだ ないよ。こうぼうで つくろう！</div>
        ) : (
          owned.map((d) => (
            <div key={d.id} className="showcase__decor">
              <span className="showcase__decor-icon">{d.emoji}</span>
              {d.name}
            </div>
          ))
        )}
      </div>
      <div className="showcase__label">
        💎 こうせき <b>{found.length}</b> / {ORES.length} しゅるい
      </div>
      <div className="showcase__gems">
        {found.map((o) => (
          <div key={o.id} className="showcase__gem">
            <GemIcon ore={o} />
            <span>{o.name}</span>
            <small>もってる {held[o.id] ?? 0}</small>
          </div>
        ))}
      </div>
      {found.length === 0 && <div className="room__hint">こうせきを みつけると ここに ならぶよ</div>}
    </Room>
  )
}

/** 基地の事務所の中の画面 */
export function BaseRoomOverlay() {
  const room = useGameStore((s) => s.baseRoom)
  if (room === 'office') return <Office />
  if (room === 'garage') return <Garage />
  if (room === 'workshop') return <Workshop />
  if (room === 'showcase') return <Showcase />
  return null
}
