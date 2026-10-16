import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useMissionStore, remainingOf } from '../../stores/missionStore'
import { MAP_CELL, MAP_CELLS, MAP_HALF, cellCenter, cellKey, explorePercent, useExplorationStore } from '../../stores/explorationStore'
import { ROCK_SITES } from '../../cargo/rocks/rockSites'
import { ROCK_COLORS } from '../../cargo/rocks/rockTypes'
import { DELIVERY_ZONE } from '../../missions/missionConfig'
import { BOULDERS, FIELD, LANDMARKS, STATIC_TREES, type TreeKind } from '../../world/fieldLayout'
import { forest, useForestStore } from '../../world/forest'
import { mapColorAt, type OuterBiome } from '../../world/biomes'
import { HILLS } from '../../world/terrain'
import { CHESTS, SIGHTS } from '../../world/discoveryLayout'
import { useDiscoveryStore } from '../../stores/discoveryStore'
import { useBoulderStore } from '../../world/boulders'
import { useHouseStore } from '../../stores/houseStore'
import { PLOTS, PLOT_RADIUS } from '../../world/buildSiteLayout'
import { useLevel } from '../../stores/progressStore'
import { DEMOLISH_LEVEL, GRAPPLE_LEVEL } from '../../missions/levels'
import { BUILDING, DEMOLITION_SITE, RECYCLE_YARD } from '../../world/demolitionLayout'
import { useBuildingStore } from '../../world/demolition'
import { OFFICE, OFFICE_PLOTS, TOWER, TOWER_RING, TOWER_STAGES, CITY_RING_RADIUS, SKYSCRAPER, officeRing } from '../../world/cityLayout'
import { useCityStore } from '../../stores/cityStore'
import { OFFICE_LEVEL, SKYSCRAPER_LEVEL, TOWER_LEVEL } from '../../missions/levels'
import { BRIDGE_WIDTH, BRIDGES, LAKES, RIVER, RIVER_WIDTH, bridgePose } from '../../world/waterLayout'
import { ALL_MOUNDS } from '../../cargo/dirt/dirtConfig'
import { excavatorSensors } from '../../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../../vehicles/bulldozer/bulldozerSensors'
import { rockRegistry } from '../../cargo/rocks/rockRegistry'

/*
 * 地図の座標：スタートの向き（ダンプ・ショベルの前 = +Z）を「上」にする。
 * 車両ローカルと同じく +X が左なので、画面の x = -ワールド x、画面の y = -ワールド z。
 */
const sx = (x: number) => -x
const sy = (z: number) => -z

const LIMIT = FIELD.driveLimit

/** 地図の地面：マスごとの地帯の色（雪原は白、森は緑…） */
const GROUND_CELLS: ReadonlyArray<{ key: string; x: number; z: number; color: string }> = (() => {
  const cells = []
  for (let cx = 0; cx < MAP_CELLS; cx++)
    for (let cz = 0; cz < MAP_CELLS; cz++) {
      const [x, z] = cellCenter(cx, cz)
      cells.push({ key: cellKey(cx, cz), x, z, color: mapColorAt(x, z) })
    }
  return cells
})()

const TREASURE_MAP_COLOR: Record<OuterBiome, string> = { snow: '#bfe4f5', forest: '#4f7a3a', desert: '#d99a5b', rocky: '#5e5470' }

const TREE_MAP_COLOR: Record<TreeKind, string> = { pine: '#4f8a3a', snowPine: '#3d6b45', round: '#5f9f35', cactus: '#4f9a4a', palm: '#4f9e3c' }

/** まだ行っていない場所の雲の模様（灰色の雲と「？」）。マスをまたいでもつながって見える */
function FogPattern() {
  return (
    <defs>
      <pattern id="map-fog" patternUnits="userSpaceOnUse" width={90} height={90}>
        <rect width={90} height={90} fill="#9aa3ae" />
        <circle cx={18} cy={22} r={14} fill="#aab2bc" />
        <circle cx={34} cy={16} r={11} fill="#aab2bc" />
        <circle cx={64} cy={64} r={15} fill="#aab2bc" />
        <circle cx={80} cy={72} r={10} fill="#aab2bc" />
        <text x={66} y={34} fontSize={22} fontWeight="bold" textAnchor="middle" fill="#ffffff" opacity={0.7}>
          ？
        </text>
      </pattern>
    </defs>
  )
}

/** 地図の左上：どれだけ探検したか（バーと %） */
function ExploreBadge({ percent }: { percent: number }) {
  return (
    <div className="map__explore" aria-label={`たんけん ${percent}%`}>
      <span className="map__explore-label">たんけん</span>
      <span className="map__explore-bar">
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className="map__explore-num">{percent}%</span>
    </div>
  )
}

/** 地図上の岩の絵（小さな岩 3 つ） */
function RockCluster({ x, z, color, highlight }: { x: number; z: number; color: keyof typeof ROCK_COLORS; highlight: boolean }) {
  const c = ROCK_COLORS[color]
  return (
    <g transform={`translate(${sx(x)} ${sy(z)}) scale(1.9)`}>
      {highlight && <circle r={11} fill="none" stroke="#ffd400" strokeWidth={2.5} className="map__pulse" />}
      {[
        [-3.5, 2],
        [3.5, 2],
        [0, -3],
      ].map(([dx, dy], i) => (
        <path
          key={i}
          transform={`translate(${dx} ${dy}) scale(0.22)`}
          d="M -11 5 L -8 -5 L 0 -10 L 9 -7 L 12 3 L 6 10 L -5 11 Z"
          fill={c.icon}
          stroke={c.outline}
          strokeWidth={4}
        />
      ))}
      {/* 旗 */}
      <line x1={7} y1={2} x2={7} y2={-12} stroke="#666" strokeWidth={1} />
      <rect x={7} y={-12} width={6} height={4} fill={c.icon} stroke={c.outline} strokeWidth={0.8} />
    </g>
  )
}

/** 地図上の車両（上から見た形。向きも分かるように） */
function VehicleMarker({ x, z, heading, kind, active }: { x: number; z: number; heading: number; kind: 'excavator' | 'truck' | 'bulldozer'; active: boolean }) {
  const deg = (-heading * 180) / Math.PI // 左に曲がる（heading 増）＝ 画面では反時計回り
  return (
    <g transform={`translate(${sx(x)} ${sy(z)}) rotate(${deg}) scale(2)`}>
      {active && <circle r={9} fill="rgba(47,128,237,0.25)" stroke="#2f80ed" strokeWidth={1.5} className="map__pulse" />}
      {kind === 'bulldozer' ? (
        <>
          <rect x={-3} y={-2.5} width={1.8} height={7} rx={0.8} fill="#2b2b2b" />
          <rect x={1.2} y={-2.5} width={1.8} height={7} rx={0.8} fill="#2b2b2b" />
          <rect x={-2.2} y={-2} width={4.4} height={6} rx={0.6} fill="#f2b705" stroke="#2b2b2b" strokeWidth={0.8} />
          <rect x={-4.2} y={-5.5} width={8.4} height={2} rx={0.5} fill="#f2b705" stroke="#2b2b2b" strokeWidth={0.8} />
        </>
      ) : kind === 'truck' ? (
        <>
          <rect x={-2.6} y={-1} width={5.2} height={7.5} rx={0.8} fill="#f2b705" stroke="#2b2b2b" strokeWidth={0.8} />
          <rect x={-2.6} y={-5.5} width={5.2} height={4} rx={0.8} fill="#f1f0ea" stroke="#2b2b2b" strokeWidth={0.8} />
        </>
      ) : (
        <>
          <rect x={-3} y={-3} width={1.8} height={7} rx={0.8} fill="#2b2b2b" />
          <rect x={1.2} y={-3} width={1.8} height={7} rx={0.8} fill="#2b2b2b" />
          <rect x={-2.4} y={-2} width={4.8} height={4.8} rx={0.6} fill="#f2b705" stroke="#2b2b2b" strokeWidth={0.8} />
          <line x1={0} y1={-2} x2={0} y2={-8} stroke="#f2b705" strokeWidth={1.6} strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

/** 左上の地図ボタン */
export function MapButton() {
  const toggle = useGameStore((s) => s.toggleMap)
  return (
    <button type="button" className="round-button" aria-label="ちず" onClick={toggle}>
      <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
        <path d="M 8 16 L 22 10 L 42 16 L 56 10 L 56 48 L 42 54 L 22 48 L 8 54 Z" fill="#fdf3d0" stroke="#2b2b2b" strokeWidth={3} strokeLinejoin="round" />
        <path d="M 22 10 L 22 48 M 42 16 L 42 54" stroke="#2b2b2b" strokeWidth={2.5} />
        <circle cx={32} cy={32} r={4} fill="#e53935" />
        <path d="M 12 40 Q 20 30 30 36 T 52 26" fill="none" stroke="#2fbf5b" strokeWidth={3} strokeDasharray="4 3" />
      </svg>
    </button>
  )
}

/**
 * 画面いっぱいの地図。行ったことのある場所だけ見え、まだの場所は灰色の雲と「？」でかくれている（行くと晴れる）。
 * 走れる範囲の外は山の色、左上に探検した割合。
 * いま集める色の岩置き場は黄色い輪で光る。どこをタップしても閉じる。
 */
export function MapOverlay() {
  const open = useGameStore((s) => s.mapOpen)
  const close = useGameStore((s) => s.toggleMap)
  const active = useGameStore((s) => s.activeVehicle)
  const cells = useExplorationStore((s) => s.cells)
  const openedChests = useDiscoveryStore((s) => s.openedChests)
  const brokenBoulders = useBoulderStore((s) => s.broken)
  const houses = useHouseStore((s) => s.built)
  const levelNow = useLevel().level
  const buildingFloors = useBuildingStore((s) => s.floors)
  const city = useCityStore()
  // 木が倒れたり生えたりしたら描きなおす
  useForestStore((s) => s.version)
  const { parts, colorCounts } = useMissionStore()
  // 開いている間は車両の位置を少しずつ更新する
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setTick((t) => t + 1), 400)
    return () => clearInterval(id)
  }, [open])
  if (!open) return null

  const explored = new Set(cells)
  const seen = (x: number, z: number) => {
    const cx = Math.floor((x + MAP_HALF) / MAP_CELL)
    const cz = Math.floor((z + MAP_HALF) / MAP_CELL)
    return explored.has(cellKey(cx, cz))
  }
  const fog: [number, number][] = []
  for (let cx = 0; cx < MAP_CELLS; cx++) for (let cz = 0; cz < MAP_CELLS; cz++) if (!explored.has(cellKey(cx, cz))) fog.push([cx, cz])
  const needed = (color: keyof typeof ROCK_COLORS) => remainingOf(parts, colorCounts, color) > 0

  return (
    <div className="map" onClick={close} role="dialog" aria-label="ちず">
      <svg className="map__svg" viewBox={`${-MAP_HALF} ${-MAP_HALF} ${MAP_HALF * 2} ${MAP_HALF * 2}`}>
        <FogPattern />
        {GROUND_CELLS.map((c) => (
          <rect key={c.key} x={sx(c.x) - MAP_CELL / 2 - 0.3} y={sy(c.z) - MAP_CELL / 2 - 0.3} width={MAP_CELL + 0.6} height={MAP_CELL + 0.6} fill={c.color} />
        ))}
        {/* 丘（等高線のように、丸を重ねて少し暗く） */}
        {HILLS.map((h, i) => (
          <g key={`hill${i}`}>
            <circle cx={sx(h.x)} cy={sy(h.z)} r={h.r} fill="rgba(60,40,20,0.10)" />
            <circle cx={sx(h.x)} cy={sy(h.z)} r={h.r * 0.55} fill="rgba(60,40,20,0.10)" />
          </g>
        ))}
        {/* 川・池・橋（まだ行っていない所は上から雲でかくれる） */}
        <polyline points={RIVER.map(([x, z]) => `${sx(x)},${sy(z)}`).join(' ')} fill="none" stroke="#4fa3dc" strokeWidth={RIVER_WIDTH} strokeLinejoin="round" />
        {LAKES.map((l, i) => (
          <circle key={`lake${i}`} cx={sx(l.x)} cy={sy(l.z)} r={l.r} fill={l.frozen ? '#cdeaf7' : '#4fa3dc'} stroke={l.frozen ? '#9cc9de' : '#2f7fb5'} strokeWidth={1} />
        ))}
        {BRIDGES.map((b, i) => {
          const p = bridgePose(b)
          return (
            <rect
              key={`bridge${i}`}
              x={-(RIVER_WIDTH + 5) / 2}
              y={-BRIDGE_WIDTH / 2}
              width={RIVER_WIDTH + 5}
              height={BRIDGE_WIDTH}
              fill="#9a6a3c"
              stroke="#5a3a1e"
              strokeWidth={1}
              transform={`translate(${sx(p.x)} ${sy(p.z)}) rotate(${(p.flow * 180) / Math.PI})`}
            />
          )
        })}
        {[...STATIC_TREES, ...forest.trees.filter((t) => t.state === 'standing' || t.state === 'growing')].filter((t) => seen(t.x, t.z)).map((t, i) => (
          <circle key={`t${i}`} cx={sx(t.x)} cy={sy(t.z)} r={2.4 * t.scale} fill={TREE_MAP_COLOR[t.kind]} />
        ))}
        {BOULDERS.map((b, i) => [b, i] as const).filter(([b, i]) => seen(b.x, b.z) && !brokenBoulders.includes(i)).map(([b, i]) => (
          <circle key={`b${i}`} cx={sx(b.x)} cy={sy(b.z)} r={1.8 * b.scale} fill="#8a7f73" />
        ))}
        {/* おきば（いつも見える） */}
        <circle cx={sx(DELIVERY_ZONE.x)} cy={sy(DELIVERY_ZONE.z)} r={DELIVERY_ZONE.radius} fill="rgba(47,191,91,0.55)" stroke="#fff" strokeWidth={1.2} />
        <line x1={sx(DELIVERY_ZONE.x)} y1={sy(DELIVERY_ZONE.z)} x2={sx(DELIVERY_ZONE.x)} y2={sy(DELIVERY_ZONE.z) - 14} stroke="#555" strokeWidth={1} />
        <rect x={sx(DELIVERY_ZONE.x)} y={sy(DELIVERY_ZONE.z) - 14} width={8} height={5} fill="#2fbf5b" />
        {seen(LANDMARKS.crane.x, LANDMARKS.crane.z) && (
          <g transform={`translate(${sx(LANDMARKS.crane.x)} ${sy(LANDMARKS.crane.z)})`}>
            <line x1={0} y1={4} x2={0} y2={-12} stroke="#f2b705" strokeWidth={2} />
            <line x1={-4} y1={-12} x2={12} y2={-12} stroke="#f2b705" strokeWidth={2} />
          </g>
        )}
        {seen(LANDMARKS.hut.x, LANDMARKS.hut.z) && (
          <rect x={sx(LANDMARKS.hut.x) - 4} y={sy(LANDMARKS.hut.z) - 2.5} width={8} height={5} fill="#e8e4da" stroke="#3a6ea5" strokeWidth={1.2} />
        )}
        {/* 土の山（掘ると鉱石が出る） */}
        {ALL_MOUNDS.filter((m) => seen(m.center[0], m.center[1])).map((m) =>
          m.treasure ? (
            // 宝の山：大きめで、宝石がきらきら
            <g key={m.id} transform={`translate(${sx(m.center[0])} ${sy(m.center[1])}) scale(1.4)`}>
              <circle r={11} fill="none" stroke="#ffd400" strokeWidth={1.5} strokeDasharray="3 2" className="map__pulse" />
              <path d="M -9 5 L -3 -6 L 3 -2 L 7 -8 L 11 5 Z" fill={TREASURE_MAP_COLOR[m.treasure]} stroke="#3a2a1a" strokeWidth={1} />
              <path d="M -4 1 L -2 -3 L 0 1 L -2 4 Z M 4 -1 L 6 -4 L 8 -1 L 6 2 Z" fill="#ffe14d" stroke="#2b2b2b" strokeWidth={0.5} />
            </g>
          ) : (
            <g key={m.id} transform={`translate(${sx(m.center[0])} ${sy(m.center[1])})`}>
              <path d="M -9 5 L -3 -6 L 3 -2 L 7 -8 L 11 5 Z" fill="#8b5a2b" stroke="#4a2e14" strokeWidth={1} />
              <path d="M 4 -1 L 6 -4 L 8 -1 L 6 2 Z" fill="#7ff3ff" stroke="#2b2b2b" strokeWidth={0.5} />
            </g>
          ),
        )}
        {/* 家を建てる場所（建てた家と、いまの区画） */}
        {PLOTS.slice(0, houses).map((p, i) => (
          <text key={`house${i}`} x={sx(p.x)} y={sy(p.z) + 7} fontSize={18} textAnchor="middle">
            🏠
          </text>
        ))}
        {houses < PLOTS.length && levelNow >= GRAPPLE_LEVEL && (
          <circle cx={sx(PLOTS[houses].x)} cy={sy(PLOTS[houses].z)} r={PLOT_RADIUS} fill="rgba(255,212,0,0.35)" stroke="#e0b800" strokeWidth={1.5} strokeDasharray="3 2" />
        )}
        {/* Lv7：古いビル（こわれていたら跡地）と、リサイクル場（緑の場所、いつも見える） */}
        {levelNow >= DEMOLISH_LEVEL && (
          <>
            <rect
              x={sx(DEMOLITION_SITE.x) - BUILDING.width / 2}
              y={sy(DEMOLITION_SITE.z) - BUILDING.depth / 2}
              width={BUILDING.width}
              height={BUILDING.depth}
              fill={buildingFloors > 0 ? '#9a9488' : 'rgba(120,110,100,0.35)'}
              stroke="#3a3430"
              strokeWidth={1.2}
            />
            {buildingFloors > 0 && (
              <text x={sx(DEMOLITION_SITE.x)} y={sy(DEMOLITION_SITE.z) - 6} fontSize={16} textAnchor="middle" className="map__pulse">
                🏢
              </text>
            )}
            <circle cx={sx(RECYCLE_YARD.x)} cy={sy(RECYCLE_YARD.z)} r={RECYCLE_YARD.radius} fill="rgba(47,191,91,0.55)" stroke="#fff" strokeWidth={1.2} />
            <path
              d={`M ${sx(RECYCLE_YARD.x) - 3} ${sy(RECYCLE_YARD.z) - 3} h 6 M ${sx(RECYCLE_YARD.x)} ${sy(RECYCLE_YARD.z) - 3} v 6 M ${sx(RECYCLE_YARD.x) - 3} ${sy(RECYCLE_YARD.z) + 3} h 6`}
              stroke="#b04a2e"
              strokeWidth={1.8}
            />
          </>
        )}
        {/* Lv8・9：工事現場（建てたビル・タワーと、いまの資材置き場） */}
        {levelNow >= OFFICE_LEVEL && (
          <>
            {OFFICE_PLOTS.map((p, i) =>
              i < city.offices || (i === city.offices && city.officeFloors > 0) ? (
                <rect key={`office${i}`} x={sx(p.x) - OFFICE.width / 2} y={sy(p.z) - OFFICE.depth / 2} width={OFFICE.width} height={OFFICE.depth} fill={i < city.offices ? '#5f8db3' : 'rgba(95,141,179,0.45)'} stroke="#2b4a66" strokeWidth={1} />
              ) : null,
            )}
            {city.offices < OFFICE_PLOTS.length && (
              <circle cx={sx(officeRing(city.offices).x)} cy={sy(officeRing(city.offices).z)} r={CITY_RING_RADIUS} fill="rgba(255,212,0,0.35)" stroke="#e0b800" strokeWidth={1.5} strokeDasharray="3 2" />
            )}
            {levelNow >= SKYSCRAPER_LEVEL && (
              <>
                <rect x={sx(SKYSCRAPER.x) - SKYSCRAPER.width / 2} y={sy(SKYSCRAPER.z) - SKYSCRAPER.depth / 2} width={SKYSCRAPER.width} height={SKYSCRAPER.depth} fill="#8fb3d9" stroke="#2b4a66" strokeWidth={1} />
                <text x={sx(SKYSCRAPER.x)} y={sy(SKYSCRAPER.z) + 5} fontSize={12} fontWeight="bold" textAnchor="middle" fill="#1f3550">
                  {city.skyFloors}
                </text>
              </>
            )}
            {levelNow >= TOWER_LEVEL && (
              <>
                <text x={sx(TOWER.x)} y={sy(TOWER.z) + 8} fontSize={22} textAnchor="middle" opacity={city.towerStage >= TOWER_STAGES.length ? 1 : 0.45}>
                  🗼
                </text>
                {city.towerStage < TOWER_STAGES.length && (
                  <circle cx={sx(TOWER_RING.x)} cy={sy(TOWER_RING.z)} r={CITY_RING_RADIUS} fill="rgba(255,212,0,0.35)" stroke="#e0b800" strokeWidth={1.5} strokeDasharray="3 2" />
                )}
              </>
            )}
          </>
        )}
        {/* 名所と宝箱（行ったことのある場所なら） */}
        {SIGHTS.filter((s) => seen(s.x, s.z)).map((s) =>
          s.emoji ? (
            <text key={s.id} x={sx(s.x)} y={sy(s.z) + 8} fontSize={22} textAnchor="middle">
              {s.emoji}
            </text>
          ) : (
            // かざぐるまの塔（合う絵文字がない）
            <g key={s.id} transform={`translate(${sx(s.x)} ${sy(s.z)})`}>
              <path d="M -4 8 L -2 -4 L 2 -4 L 4 8 Z" fill="#e9e2d4" stroke="#2b2b2b" strokeWidth={0.8} />
              <path d="M -9 -13 L 9 5 M 9 -13 L -9 5" stroke="#f4efe4" strokeWidth={3} />
              <path d="M -9 -13 L 9 5 M 9 -13 L -9 5" stroke="#2b2b2b" strokeWidth={0.6} />
            </g>
          ),
        )}
        {CHESTS.filter((c) => seen(c.x, c.z)).map((c) => (
          <text key={c.id} x={sx(c.x)} y={sy(c.z) + 6} fontSize={15} textAnchor="middle" opacity={openedChests.includes(c.id) ? 0.35 : 1} className={openedChests.includes(c.id) ? undefined : 'map__pulse'}>
            🎁
          </text>
        ))}
        {ROCK_SITES.filter((s) => seen(s.center[0], s.center[1])).map((s) => (
          <RockCluster key={s.id} x={s.center[0]} z={s.center[1]} color={s.color} highlight={needed(s.color)} />
        ))}
        {/* 金色の石（行ったことのある場所なら星で出す） */}
        {rockRegistry.rocks
          .filter((r) => r.color === 'gold' && r.state === 'free')
          .map((r) => r.body.translation())
          .filter((p) => seen(p.x, p.z))
          .map((p, i) => (
            <text key={'gold' + i} x={sx(p.x)} y={sy(p.z) + 5} fontSize={16} textAnchor="middle" fill="#ffc400" stroke="#a07000" strokeWidth={0.8} className="map__pulse">
              ★
            </text>
          ))}
        {/* まだ行っていない場所は雲でかくす */}
        {fog.map(([cx, cz]) => {
          const [x, z] = cellCenter(cx, cz)
          return (
            <rect
              key={cellKey(cx, cz)}
              x={sx(x) - MAP_CELL / 2 - 0.3}
              y={sy(z) - MAP_CELL / 2 - 0.3}
              width={MAP_CELL + 0.6}
              height={MAP_CELL + 0.6}
              fill="url(#map-fog)"
            />
          )
        })}
        {/* 走れる範囲の外（まわりの山）と、その境目 */}
        <path
          d={`M ${-MAP_HALF} ${-MAP_HALF} H ${MAP_HALF} V ${MAP_HALF} H ${-MAP_HALF} Z M ${-LIMIT} ${-LIMIT} V ${LIMIT} H ${LIMIT} V ${-LIMIT} Z`}
          fill="#7d6450"
          fillRule="evenodd"
        />
        <rect x={-LIMIT} y={-LIMIT} width={LIMIT * 2} height={LIMIT * 2} fill="none" stroke="#5a4535" strokeWidth={2} />
        <VehicleMarker x={excavatorSensors.x} z={excavatorSensors.z} heading={excavatorSensors.heading} kind="excavator" active={active === 'excavator'} />
        <VehicleMarker x={dumpTruckSensors.x} z={dumpTruckSensors.z} heading={dumpTruckSensors.heading} kind="truck" active={active === 'dumpTruck'} />
        <VehicleMarker x={bulldozerSensors.x} z={bulldozerSensors.z} heading={bulldozerSensors.heading} kind="bulldozer" active={active === 'bulldozer'} />
      </svg>
      <ExploreBadge percent={explorePercent(cells)} />
      <div className="map__close" aria-hidden>
        ✕
      </div>
    </div>
  )
}
