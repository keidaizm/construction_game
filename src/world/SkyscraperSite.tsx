import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import {
  SKYSCRAPER as SKY,
  SKY_BEAMS_PER_FLOOR,
  SKY_BEAM_SIZE,
  SKY_FLOOR_STARS,
  SKY_SLOTS,
  SKY_STOCK,
  SKY_STOCK_MAX,
  skyRoofY,
} from './cityLayout'
import { officeTextures } from './cityModels'
import { useCityStore } from '../stores/cityStore'
import { useScrapStore } from '../stores/scrapStore'
import { useProgressStore } from '../stores/progressStore'
import { useToastStore } from '../stores/toastStore'
import { Crane } from '../vehicles/crane/Crane'
import type { CraneSite } from '../vehicles/crane/craneConfig'
import { Load } from '../vehicles/crane/CraneLoads'
import { craneLoads, type LoadDef } from '../vehicles/crane/craneYard'
import { setDynamicObstacle } from '../vehicles/shared/footprints'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'
import { dayNight } from './dayNightState'

/** 地面の置き場に並べる位置（i 本目）。かさならないよう Z に並べる */
const stockSpot = (i: number) => ({ x: SKY_STOCK.x, z: SKY_STOCK.z + (i - (SKY_STOCK_MAX - 1) / 2) * 0.95, yaw: 0 })
/** 使わない鉄骨を止めておく所（遠く・地面の下） */
const parkAt = (i: number) => ({ x: 420 + i * 4, y: -60, z: 460 })

const BEAMS: readonly LoadDef[] = Array.from({ length: SKY_STOCK_MAX }, (_, i) => ({
  id: `sky-beam-${i}`,
  game: 'sky',
  shape: 'box',
  size: SKY_BEAM_SIZE,
  color: '#b04a2e',
  home: stockSpot(i),
}))

/** 屋上のクレーン（根元の高さは屋上。ビルが高くなると、せり上がる） */
export const SKY_CRANE: CraneSite = {
  id: 'sky',
  x: SKY.x,
  z: SKY.z,
  base: { y: skyRoofY(SKY.startFloors) },
  // ロープが長いので、フックは速く上げ下げする
  ropeSpeed: 9,
  followHook: true,
  // 屋上の枠の近くではなしたら、近い方の枠にそろえる
  snap: (x, z) => {
    if (Math.abs(x - SKY.x) > SKY.width / 2 + 0.5 || Math.abs(z - SKY.z) > SKY.depth / 2 + 0.5) return null
    const slot = SKY_SLOTS.reduce((a, b) => (Math.abs(z - SKY.z - a) < Math.abs(z - SKY.z - b) ? a : b))
    return { x: SKY.x, z: SKY.z + slot, yaw: 0 }
  },
}

/** せり上がる速さ [m/s] */
const CLIMB_SPEED = 1.6
/** 鉄骨を数える・置き場をととのえる間隔 [s] */
const CHECK = 0.3
/** 屋上で止まってから数えるまで [s] */
const SETTLE = 0.6

const slabMaterial = new THREE.MeshStandardMaterial({ color: '#8d8b86', roughness: 0.9 })
const padMaterial = new THREE.MeshStandardMaterial({ color: '#ffd400', roughness: 0.8 })
const frameMaterial = new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.9, depthWrite: false })
const unitBox = new THREE.BoxGeometry(1, 1, 1)

/**
 * 高くしていけるビル（Lv10）。
 * - ビル：階の数 skyFloors（保存）。見た目は 1 つの箱をのばし、窓の模様を階の数だけくり返す。当たり判定は上面が屋上の高い箱
 * - 屋上のクレーン（Crane site = SKY_CRANE）：ビルが高くなると、ゆっくりせり上がる
 * - 地面の置き場：持っている てっこつの数（4 本まで）だけ鉄骨が出る
 * - 屋上の黄色い枠に鉄骨を置いて止まると数える（てっこつを 1 本使う）。2 本で 1 階高くなる（星 +1）
 */
export function SkyscraperSite({ anchorRef }: { anchorRef: RefObject<THREE.Object3D | null> }) {
  const { rapier } = useRapier()
  const floors = useCityStore((s) => s.skyFloors)
  const placed = useCityStore((s) => s.skyBeams)
  const body = useRef<RapierRigidBody>(null)
  const building = useRef<THREE.Mesh>(null)
  const roof = useRef<THREE.Group>(null)
  /** いま見えている高さ（屋上の高さに向かって、ゆっくりのびる） */
  const height = useRef(skyRoofY(floors))

  const textures = useMemo(() => {
    const t = officeTextures()
    t.map.wrapT = THREE.RepeatWrapping
    t.emissiveMap.wrapT = THREE.RepeatWrapping
    return t
  }, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: textures.map, emissiveMap: textures.emissiveMap, emissive: '#ffd27a', emissiveIntensity: 0, color: '#dfe9f5', roughness: 0.5 }),
    [textures],
  )
  useEffect(
    () => () => {
      material.dispose()
      textures.map.dispose()
      textures.emissiveMap.dispose()
    },
    [material, textures],
  )

  // ぶつかる所（車両）
  useEffect(() => {
    setDynamicObstacle('skyscraper', { x: SKY.x, z: SKY.z, r: SKY.width / 2 + 1.2 })
    return () => setDynamicObstacle('skyscraper', null)
  }, [])

  /** 屋上に置いて数えた鉄骨（つぎの階ができるまで屋上にのっている） */
  const counted = useRef(new Set<string>())
  const restSince = useRef(new Map<string, number>())
  const clock = useRef(0)
  const timer = useRef(0)

  const park = (id: string) => {
    const load = craneLoads.list.find((l) => l.id === id)
    if (!load) return
    const i = Number(id.slice('sky-beam-'.length))
    load.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
    load.body.setTranslation(parkAt(i), true)
    load.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    load.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }
  const isParked = (load: (typeof craneLoads.list)[number]) => load.body.translation().y < -30

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    clock.current += dt
    const city = useCityStore.getState()
    // --- のびる・せり上がる ---
    const target = skyRoofY(city.skyFloors)
    height.current = Math.min(target, height.current + CLIMB_SPEED * dt)
    if (height.current < target - 3) height.current = target - 3 // 何階もいっぺんに増えたとき（保存から）は待たせない
    const h = height.current
    SKY_CRANE.base.y = h
    const b = building.current
    if (b) {
      b.scale.set(SKY.width, h - 0.3, SKY.depth)
      b.position.y = 0.3 + (h - 0.3) / 2
      textures.map.repeat.set(2, (h - 0.3) / SKY.floorHeight)
      textures.emissiveMap.repeat.copy(textures.map.repeat)
    }
    if (roof.current) roof.current.position.y = h
    body.current?.setNextKinematicTranslation({ x: SKY.x, y: h - 100, z: SKY.z })
    material.emissiveIntensity = Math.max(0, dayNight.darkness - 0.2) * 0.9

    timer.current += dt
    if (timer.current < CHECK) return
    timer.current = 0
    const beams = craneLoads.list.filter((l) => l.game === 'sky')
    const steel = useScrapStore.getState().steel

    // --- 屋上の枠で止まった鉄骨を数える ---
    if (h >= target - 0.01 && city.skyFloors < SKY.maxFloors) {
      for (const load of beams) {
        if (counted.current.has(load.id) || load.body.isKinematic()) continue
        const p = load.body.translation()
        const v = load.body.linvel()
        const onRoof = Math.abs(p.x - SKY.x) < SKY.width / 2 && Math.abs(p.z - SKY.z) < SKY.depth / 2 && p.y > h - 0.2 && p.y < h + 1.5
        if (!onRoof || Math.hypot(v.x, v.y, v.z) > 0.3) {
          restSince.current.delete(load.id)
          continue
        }
        const since = restSince.current.get(load.id)
        if (since === undefined) {
          restSince.current.set(load.id, clock.current)
          continue
        }
        if (clock.current - since < SETTLE) continue
        if (!useScrapStore.getState().spendSteel(1)) continue
        counted.current.add(load.id)
        city.addSkyBeam()
        audio.play('clang')
        digEffects.dust(p.x, p.y, p.z)
      }
      // そろったら 1 階高くなる（屋上の鉄骨は新しい階になる）
      if (useCityStore.getState().skyBeams >= SKY_BEAMS_PER_FLOOR) {
        for (const id of counted.current) park(id)
        counted.current.clear()
        useCityStore.getState().buildSkyFloor()
        for (let k = 0; k < 8; k++) digEffects.dust(SKY.x + (Math.random() - 0.5) * SKY.width, h + Math.random(), SKY.z + (Math.random() - 0.5) * SKY.depth)
        useProgressStore.getState().addStars(SKY_FLOOR_STARS)
        audio.play('missionClear')
        const n = useCityStore.getState().skyFloors
        useToastStore.getState().show({ title: `${n}かいだてに なった！ ほし +${SKY_FLOOR_STARS}`, icon: 'star', color: '#ffc933', stars: 0, isNew: true })
      }
    }

    // --- 地面の置き場：持っている てっこつの数まで鉄骨を出す（多すぎたら置き場のものからしまう） ---
    const out = beams.filter((l) => !isParked(l) && !counted.current.has(l.id))
    if (out.length > steel) {
      const extra = out.filter((l) => !l.body.isKinematic()).sort((a, b) => {
        const pa = a.body.translation()
        const pb = b.body.translation()
        return Math.hypot(pa.x - SKY_STOCK.x, pa.z - SKY_STOCK.z) - Math.hypot(pb.x - SKY_STOCK.x, pb.z - SKY_STOCK.z)
      })
      for (const l of extra.slice(0, out.length - steel)) park(l.id)
    } else if (out.length < steel) {
      const free = beams.find(isParked)
      if (free) {
        const i = Number(free.id.slice('sky-beam-'.length))
        const spot = stockSpot(i)
        free.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
        free.body.setTranslation({ x: spot.x, y: SKY_BEAM_SIZE[1] / 2 + 0.6, z: spot.z }, true)
        free.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
        free.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        free.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
  })

  const done = floors >= SKY.maxFloors
  return (
    <>
      {/* ビル（箱を 1 つのばす） */}
      <mesh position={[SKY.x, 0.15, SKY.z]} scale={[SKY.width + 1.2, 0.3, SKY.depth + 1.2]} geometry={unitBox} material={slabMaterial} receiveShadow />
      <mesh ref={building} position={[SKY.x, 0, SKY.z]} geometry={unitBox} material={material} castShadow receiveShadow frustumCulled={false} />
      {/* 屋上：鉄骨を置く黄色い枠（2 か所） */}
      <group ref={roof} position={[SKY.x, 0, SKY.z]}>
        {!done &&
          SKY_SLOTS.map((dz, i) => (
            <group key={dz} position={[0, 0.03, dz]}>
              {[
                [0, -0.5, 3.4, 0.12],
                [0, 0.5, 3.4, 0.12],
                [-1.65, 0, 0.12, 1],
                [1.65, 0, 0.12, 1],
              ].map(([x, z, w, d], k) => (
                <mesh key={k} position={[x, 0, z]} scale={[w, 0.04, d]} geometry={unitBox} material={frameMaterial} visible={i >= placed} />
              ))}
            </group>
          ))}
      </group>
      {/* 当たり判定：上の面が屋上（とても高い箱を、屋上の高さに合わせて動かす） */}
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[SKY.x, skyRoofY(floors) - 100, SKY.z]}>
        <CuboidCollider args={[SKY.width / 2, 100, SKY.depth / 2]} friction={0.9} />
      </RigidBody>
      {/* 地面の鉄骨の置き場 */}
      <mesh position={[SKY_STOCK.x, 0.03, SKY_STOCK.z]} scale={[3.8, 0.06, 4.6]} geometry={unitBox} material={padMaterial} receiveShadow />
      {BEAMS.map((def) => (
        <Load key={def.id} def={def} index={0} />
      ))}
      <Crane anchorRef={anchorRef} site={SKY_CRANE} />
    </>
  )
}
