import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rockRegistry } from '../cargo/rocks/rockRegistry'
import { JUDGE_DELAY_MS, useMissionStore, type ZoneRock } from '../stores/missionStore'
import { DELIVERY_ZONE as Z, insideZone } from './missionConfig'
import { excavatorSensors } from '../vehicles/excavator/excavatorSensors'
import { audio } from '../audio/AudioManager'

/** ショベルがおきばの近くで岩をバケットに持っている（取り除いている最中。置き終わるまで数を確定しない） */
function excavatorCarryingNearZone() {
  const tip = excavatorSensors.bucketTip
  return excavatorSensors.heldCount > 0 && Math.hypot(tip.x - Z.x, tip.z - Z.z) < Z.radius + 4
}

const ZONE_COLOR = '#2fbf5b'
/** これより速い岩があるうちは判定しない [m/s] */
const REST_SPEED = 0.6
const CHECK_INTERVAL = 0.2
const POP_TIME = 0.4

/**
 * 「とりのぞこう」のはじめの石を、おきばに並べる（ふつうの石から優先して使う）。
 * 岩が元の場所に戻った（リセット）あとに呼ぶ。
 */
function setupRemoveMission(count: number): number[] {
  const order = ['gray', 'black', 'red', 'white']
  const rocks = rockRegistry.rocks
    .filter((r) => r.state === 'free' && !r.pooled)
    .sort((a, b) => order.indexOf(a.color) - order.indexOf(b.color))
    .slice(0, count)
  rocks.forEach((r, i) => {
    // おきばの中に、うずまき状に並べる
    const a = i * 2.4
    const d = 0.9 + Math.sqrt(i) * 0.9
    r.body.setTranslation({ x: Z.x + Math.cos(a) * d, y: 0.6, z: Z.z + Math.sin(a) * d }, true)
    r.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    r.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    r.batchId = 0
  })
  return rocks.map((r) => r.id)
}

function rocksStillMovingNearZone() {
  for (const rock of rockRegistry.rocks) {
    if (rock.state !== 'free') continue
    const p = rock.body.translation()
    if (Math.hypot(p.x - Z.x, p.z - Z.z) > Z.radius + 4) continue
    const v = rock.body.linvel()
    if (p.y > 1.0 || Math.hypot(v.x, v.y, v.z) > REST_SPEED) return true
  }
  return false
}

/**
 * おきば（岩を運ぶ場所）。地面の緑の円・旗・浮かぶ緑の ▼。
 * いま円の中にある岩を毎回数え直してミッションに知らせる（転がり出たら減る）。
 * 中身が落ち着いたら判定させる。
 */
export function DeliveryZone() {
  const marker = useRef<THREE.Mesh>(null)
  const timer = useRef(0)
  const pops = useRef<{ mesh: THREE.Object3D; age: number }[]>([])
  /** 前回数えたときに円の中にいた岩（新しく入った岩だけ「ぽよん」とさせる） */
  const insideIds = useRef(new Set<number>())

  const markerMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ZONE_COLOR, transparent: true, opacity: 0.95, depthTest: false }),
    [],
  )
  // 逆さの三角すい（黄色い「とれる」▼と同じ形・大きめ）
  const markerGeometry = useMemo(() => new THREE.ConeGeometry(0.7, 1.1, 3).rotateX(Math.PI), [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (marker.current) {
      marker.current.position.y = 6 + Math.sin(t * 3) * 0.3
      marker.current.rotation.y = t * 1.2
    }

    // 届いた岩が「ぽよん」と膨らむ
    pops.current = pops.current.filter((p) => {
      p.age += dt
      const k = Math.min(1, p.age / POP_TIME)
      p.mesh.scale.setScalar(1 + Math.sin(Math.PI * k) * 0.35)
      return k < 1
    })

    timer.current += dt
    if (timer.current < CHECK_INTERVAL) return
    timer.current = 0

    // 「とりのぞこう」のはじめの石を並べる
    const setup = useMissionStore.getState()
    if (setup.needsSetup && rockRegistry.rocks.length > 0) {
      const placed = setupRemoveMission(setup.startCount)
      useMissionStore.setState({ needsSetup: false })
      insideIds.current = new Set(placed) // 並べた石は「ぽよん」させない
      return
    }

    // いま円の中にある岩を数え直す（バケットや荷台の中の岩は数えない）
    const inside: ZoneRock[] = []
    const now = new Set<number>()
    for (const rock of rockRegistry.rocks) {
      if (rock.state !== 'free' || rock.color === 'gold' || !insideZone(rock.body.translation())) continue
      inside.push({ batchId: rock.batchId, color: rock.color })
      now.add(rock.id)
      if (!insideIds.current.has(rock.id)) {
        pops.current.push({ mesh: rock.mesh, age: 0 })
        audio.play('count')
      }
    }
    insideIds.current = now
    useMissionStore.getState().setZoneContents(inside)
    const mission = useMissionStore.getState() // 更新後の状態で判定する

    // 中身がしばらく変わらず、近くで転がっている岩も、ショベルが持ち上げている岩もなくなったら判定
    if (
      mission.pendingSince > 0 &&
      performance.now() - mission.pendingSince > JUDGE_DELAY_MS &&
      !rocksStillMovingNearZone() &&
      !excavatorCarryingNearZone()
    ) {
      mission.judge()
    }
  })

  return (
    <group position={[Z.x, 0, Z.z]}>
      <mesh position-y={0.015} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[Z.radius, 40]} />
        <meshStandardMaterial color={ZONE_COLOR} transparent opacity={0.45} roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh position-y={0.02} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[Z.radius - 0.3, Z.radius, 48]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {/* 旗（円の奥の端） */}
      <group position={[0, 0, Z.radius + 0.4]}>
        <mesh position-y={2.5} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 5, 8]} />
          <meshStandardMaterial color="#dddddd" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.7, 4.5, 0]} castShadow>
          <boxGeometry args={[1.4, 0.9, 0.04]} />
          <meshStandardMaterial color={ZONE_COLOR} roughness={0.7} />
        </mesh>
      </group>
      <mesh ref={marker} geometry={markerGeometry} material={markerMaterial} renderOrder={10} />
    </group>
  )
}
