import { useGameStore, type ExcavatorTool, type TimeOfDay } from './gameStore'
import { useCraneStore } from './craneStore'
import type { CraneSiteId } from '../vehicles/crane/craneConfig'
import { useMissionStore, type Load, type StarResult, type MissionStatus, type ColorCounts } from './missionStore'
import type { MissionKind, MissionPart } from '../missions/levels'
import type { VehicleId } from '../vehicles/types'
import { rockRegistry, type RockState } from '../cargo/rocks/rockRegistry'
import { logRegistry } from '../cargo/logs/logRegistry'
import { boulderDirty, boulderStates, useBoulderStore } from '../world/boulders'
import { forest, forestDirty, useForestStore, type ForestTreeState } from '../world/forest'
import { dayNight } from '../world/dayNightState'
import { requestTeleport, vehicleStates } from '../vehicles/shared/devTeleport'

/**
 * 遊んでいる途中の様子のセーブ（ユーザー要望：何日かにわたって遊ぶ）。開き直すと、さっきの続きから遊べる。
 * 星・地図・図鑑・家などは、それぞれの store が前から保存している。ここで保存するのは、そのほかの「いまの様子」：
 * ミッションの進み具合・車両の場所と姿勢・動かした石と木材・割った岩・倒した木・時間帯・乗っている車両など。
 * 2 秒ごとと、ほかのアプリに切りかえたときに保存する。「はじめから」を押すと、その様子が次に保存される。
 */
const KEY = 'kenki-asobi-session'
/** 3：Lv7 のビル・Lv8・9 の工事現場のまわりの木・岩を取りのぞいて番号がずれたので、前のセーブは読まない */
const VERSION = 3

interface Vec {
  x: number
  y: number
  z: number
}
interface Quat extends Vec {
  w: number
}

interface SessionSave {
  v: number
  game: {
    activeVehicle: VehicleId
    previousVehicle: VehicleId
    excavatorTool: ExcavatorTool
    timeOfDay: TimeOfDay
    headlights: boolean
    /** クレーンに乗っていたら、どのクレーンか（なければ基地） */
    craneSite?: CraneSiteId
  }
  mission: {
    kind: MissionKind
    parts: MissionPart[]
    target: number
    startCount: number
    needsSetup: boolean
    loads: Load[]
    colorCounts: ColorCounts
    delivered: number
    status: MissionStatus
    wasOver: boolean
    stars: StarResult | null
    levelUp: number | null
  }
  lastBatchId: number
  vehicles: Partial<Record<VehicleId, { x: number; z: number; heading: number; joints: Record<string, number> }>>
  /** 元の場所から動いた石・控えから出た石 */
  rocks: Array<{ id: number; state: RockState; p: Vec; q: Quat; batchId: number }>
  logs: Array<{ id: string; p: Vec; q: Quat; age: number }>
  boulders: Array<{ i: number; hp: number; broken: boolean }>
  trees: Array<{ id: number; x: number; z: number; rotation: number; state: ForestTreeState; t: number }>
}

/** 車両ごとの、保存する関節（コントローラの状態の名前） */
const JOINTS: Partial<Record<VehicleId, string[]>> = {
  excavator: ['swing', 'boom', 'arm', 'bucket'],
  dumpTruck: ['bed'],
  bulldozer: ['lift'],
}

function readSave(): SessionSave | null {
  try {
    // 保護者向け：URL に ?reset-progress を付けて開くと、途中の様子も消す
    if (new URLSearchParams(location.search).has('reset-progress')) localStorage.removeItem(KEY)
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SessionSave
    return s.v === VERSION ? s : null
  } catch {
    return null
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000
const vec = (p: Vec): Vec => ({ x: round(p.x), y: round(p.y), z: round(p.z) })
const quat = (q: Quat): Quat => ({ x: round(q.x), y: round(q.y), z: round(q.z), w: round(q.w) })

/** いまの様子を保存する（物理の準備ができる前は何もしない） */
export function saveSession() {
  if (rockRegistry.rocks.length === 0 || !restored) return
  const g = useGameStore.getState()
  const m = useMissionStore.getState()
  const vehicles: SessionSave['vehicles'] = {}
  for (const [id, names] of Object.entries(JOINTS) as Array<[VehicleId, string[]]>) {
    const s = vehicleStates[id] as ({ x: number; z: number; heading: number } & Record<string, { angle: number }>) | undefined
    if (!s) continue
    vehicles[id] = {
      x: round(s.x),
      z: round(s.z),
      heading: round(s.heading),
      joints: Object.fromEntries(names.filter((n) => s[n]).map((n) => [n, round(s[n].angle)])),
    }
  }
  const rocks: SessionSave['rocks'] = []
  for (const r of rockRegistry.rocks) {
    if (r.state === 'pooled') continue
    const p = r.body.translation()
    const moved = r.pooled || Math.hypot(p.x - r.home[0], p.z - r.home[2]) > 0.3 || r.state !== 'free' || r.batchId !== 0
    if (moved) rocks.push({ id: r.id, state: r.state, p: vec(p), q: quat(r.body.rotation()), batchId: r.batchId })
  }
  const data: SessionSave = {
    v: VERSION,
    game: {
      activeVehicle: g.activeVehicle,
      previousVehicle: g.previousVehicle,
      excavatorTool: g.excavatorTool,
      timeOfDay: g.timeOfDay,
      headlights: g.headlights,
      craneSite: useCraneStore.getState().site,
    },
    mission: {
      kind: m.kind,
      parts: m.parts,
      target: m.target,
      startCount: m.startCount,
      needsSetup: m.needsSetup,
      loads: m.loads,
      colorCounts: m.colorCounts,
      delivered: m.delivered,
      status: m.status,
      wasOver: m.wasOver,
      stars: m.stars,
      levelUp: m.levelUp,
    },
    lastBatchId: rockRegistry.lastBatchId,
    vehicles,
    rocks,
    logs: logRegistry.logs
      .filter((l) => l.state !== 'pooled')
      .map((l) => ({ id: l.id, p: vec(l.body.translation()), q: quat(l.body.rotation()), age: round(logRegistry.now - l.spawnedAt) })),
    boulders: boulderStates.flatMap((b, i) => (b.broken || b.hp < b.maxHp ? [{ i, hp: round(b.hp), broken: b.broken }] : [])),
    trees: forest.trees
      .filter((t) => t.state !== 'standing' || t.t !== 0)
      .map((t) => ({ id: t.id, x: round(t.x), z: round(t.z), rotation: round(t.rotation), state: t.state === 'falling' ? 'standing' : t.state, t: round(t.t) })),
  }
  // 位置が変わった木（生えなおした木）も保存する
  for (const t of forest.trees) {
    if (t.state === 'standing' && t.t === 0 && !data.trees.some((d) => d.id === t.id)) {
      data.trees.push({ id: t.id, x: round(t.x), z: round(t.z), rotation: round(t.rotation), state: 'standing', t: 0 })
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // 保存できなくても遊びは続けられる
  }
}

const pendingSave = readSave()
/** 物理の様子をもう戻したか（戻す前に保存すると、さっきの様子を消してしまうので） */
let restored = !pendingSave

// ゲームとミッションの様子は、読みこんだらすぐ戻す（画面に出る前に）
if (pendingSave) {
  const g = pendingSave.game
  useGameStore.setState({
    activeVehicle: g.activeVehicle,
    previousVehicle: g.previousVehicle,
    excavatorTool: g.excavatorTool,
    timeOfDay: g.timeOfDay,
    headlights: g.headlights,
  })
  // 屋上のクレーンに乗っていたら、屋上のクレーンにもどす
  if (g.activeVehicle === 'crane' && g.craneSite === 'sky') useCraneStore.setState({ site: 'sky', game: 'sky' })
  dayNight.darkness = { day: 0, dusk: 0.5, night: 1 }[g.timeOfDay]
  useMissionStore.setState({ ...pendingSave.mission, pendingSince: 0 })
  rockRegistry.lastBatchId = pendingSave.lastBatchId
}

/**
 * 物理の様子（車両・石・木材・岩・木）を戻す。物理の準備ができてから SessionKeeper が呼ぶ。
 * step 0：車両を元の場所へ（コントローラが次のフレームで動かす）／ step 1：石・木材を置く
 * （車両の当たり判定が先に移ってから置かないと、ダンプの荷台などに当たらない）
 */
export function restoreSession(step: 0 | 1, rapier: { RigidBodyType: { Dynamic: number } }) {
  const s = pendingSave
  if (!s) return
  if (step === 0) {
    for (const [id, v] of Object.entries(s.vehicles) as Array<[VehicleId, NonNullable<SessionSave['vehicles'][VehicleId]>]>) {
      requestTeleport(id, v.x, v.z, v.heading, v.joints)
    }
    return
  }
  // 金色の石は、ミッションのはじめに置き直されているので、いったん控えに戻す（保存した場所に戻す）
  for (const r of rockRegistry.rocks) if (r.color === 'gold' && r.state === 'free') rockRegistry.despawn?.(r)
  for (const saved of s.rocks) {
    const r = rockRegistry.rocks.find((x) => x.id === saved.id)
    if (!r) continue
    r.body.setBodyType(rapier.RigidBodyType.Dynamic as never, true)
    // 荷台・バケットにあった石は、少し上から置く（荷台・バケットの中で落ち着いて、また載る）
    const lift = saved.state === 'free' ? 0.02 : 0.15
    r.body.setTranslation({ x: saved.p.x, y: saved.p.y + lift, z: saved.p.z }, true)
    r.body.setRotation(saved.q, true)
    r.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    r.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    r.state = 'free'
    r.batchId = saved.batchId
    r.grabCooldownUntil = 0
  }
  for (const saved of s.logs) {
    const l = logRegistry.logs.find((x) => x.id === saved.id)
    if (!l) continue
    l.body.setBodyType(rapier.RigidBodyType.Dynamic as never, true)
    l.body.setTranslation({ x: saved.p.x, y: saved.p.y + 0.1, z: saved.p.z }, true)
    l.body.setRotation(saved.q, true)
    l.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    l.state = 'free'
    l.spawnedAt = logRegistry.now - saved.age
  }
  for (const b of s.boulders) {
    const st = boulderStates[b.i]
    if (!st) continue
    st.hp = b.hp
    st.broken = b.broken
  }
  boulderDirty.value = true
  useBoulderStore.getState().setBroken(boulderStates.flatMap((b, i) => (b.broken ? [i] : [])))
  for (const saved of s.trees) {
    const t = forest.trees[saved.id]
    if (!t) continue
    t.x = saved.x
    t.z = saved.z
    t.rotation = saved.rotation
    t.state = saved.state
    t.t = saved.t
    t.push = 0
  }
  forestDirty.value = true
  useForestStore.getState().bump()
  restored = true
}

/** 保存したものを読みこめたか（テスト・開発用） */
export const hasPendingSession = () => !!pendingSave
