import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CITY_RING_RADIUS,
  OFFICE,
  OFFICE_FLOOR_COST,
  OFFICE_PLOTS,
  OFFICE_STARS,
  TOWER,
  TOWER_RING,
  TOWER_STAGES,
  TOWER_STAGE_COST,
  TOWER_STARS,
  officeRing,
} from './cityLayout'
import { officeFloorGeometry, officeFrameGeometry, officeTextures, towerDeckGlassGeometry, towerStageGeometry } from './cityModels'
import { useCityStore } from '../stores/cityStore'
import { useScrapStore } from '../stores/scrapStore'
import { useProgressStore, useLevel } from '../stores/progressStore'
import { useToastStore } from '../stores/toastStore'
import { TOWER_LEVEL } from '../missions/levels'
import { rockRegistry } from '../cargo/rocks/rockRegistry'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'
import { dayNight } from './dayNightState'
import { setDynamicObstacle } from '../vehicles/shared/footprints'

const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.85, depthWrite: false })
const padMaterial = new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.2, depthWrite: false })
const postMaterial = new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.9 })
/** つぎにできる所（うっすら見せて、何ができるか分かるように） */
const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0.22, depthWrite: false })
const frameMaterial = new THREE.MeshStandardMaterial({ color: '#c8552c', roughness: 0.6, metalness: 0.3 })
const roofMaterial = new THREE.MeshStandardMaterial({ color: '#8d8b86', roughness: 0.9 })
const slabGeometry = new THREE.BoxGeometry(OFFICE.width + 1, 0.3, OFFICE.depth + 1)
const roofGeometry = new THREE.BoxGeometry(OFFICE.width + 0.3, 0.4, OFFICE.depth + 0.3)
const tankGeometry = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10)

/** ビルの壁の色（建てた順） */
const OFFICE_TINTS = ['#ffffff', '#cfe8d2', '#f3dfc0']

/** 石を使う間隔 [s]（ポン、ポン、と 1 こずつ） */
const USE_INTERVAL = 0.35

/** 資材置き場の看板：石の絵「2 / 4」と、鉄骨の絵「1 / 1」（足りなければ赤） */
function drawSign(canvas: HTMLCanvasElement, stones: number, needStones: number, steelHave: number, needSteel: number) {
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff8e0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#e0a000'
  ctx.lineWidth = 14
  ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14)
  // 石
  ctx.fillStyle = '#a8a39a'
  ctx.strokeStyle = '#4a4540'
  ctx.lineWidth = 4
  ctx.beginPath()
  ;[[20, 110], [32, 60], [70, 40], [110, 55], [118, 100], [90, 125], [40, 128]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#2b2b2b'
  ctx.font = '900 64px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${stones}/${needStones}`, 200, canvas.height / 2 + 4)
  // 鉄骨（I の形）
  ctx.fillStyle = '#b04a2e'
  ctx.fillRect(290, 40, 70, 14)
  ctx.fillRect(316, 54, 18, 52)
  ctx.fillRect(290, 106, 70, 14)
  const enough = steelHave >= needSteel
  ctx.fillStyle = enough ? '#2b2b2b' : '#e53935'
  ctx.fillText(enough ? `${needSteel}/${needSteel}` : `${steelHave}/${needSteel}`, 430, canvas.height / 2 + 4)
}

/** 看板（2 本の柱と、表・裏に同じ絵） */
function useSign(stones: number, needStones: number, steelHave: number, needSteel: number) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 160
    return c
  }, [])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [canvas])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture }), [texture])
  useEffect(() => {
    drawSign(canvas, stones, needStones, steelHave, needSteel)
    texture.needsUpdate = true
  }, [canvas, texture, stones, needStones, steelHave, needSteel])
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )
  return material
}

/** 黄色い輪（資材置き場）と看板 */
function MaterialRing({ x, z, sign }: { x: number; z: number; sign: THREE.Material }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.04} rotation-x={-Math.PI / 2} material={padMaterial} renderOrder={2}>
        <circleGeometry args={[CITY_RING_RADIUS, 40]} />
      </mesh>
      <mesh position-y={0.05} rotation-x={-Math.PI / 2} material={ringMaterial} renderOrder={2}>
        <ringGeometry args={[CITY_RING_RADIUS - 0.35, CITY_RING_RADIUS, 40]} />
      </mesh>
      <group position={[CITY_RING_RADIUS + 0.8, 0, 0]} rotation-y={Math.PI / 2}>
        {[-1.3, 1.3].map((sx) => (
          <mesh key={sx} position={[sx, 1.1, 0]} material={postMaterial}>
            <boxGeometry args={[0.15, 2.2, 0.15]} />
          </mesh>
        ))}
        <mesh position={[0, 1.9, 0.09]} material={sign}>
          <planeGeometry args={[3, 0.94]} />
        </mesh>
        <mesh position={[0, 1.9, -0.09]} rotation-y={Math.PI} material={sign}>
          <planeGeometry args={[3, 0.94]} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * 輪の中で止まった石を 1 こ使う（元の置き場に戻す）。使えたら true。
 * 金色の石・控えの石（土の山から出たもの）も使える（控えは控えに戻る）が、金色はのぞく
 */
function takeStoneIn(x: number, z: number) {
  const rock = rockRegistry.rocks.find((r) => {
    if (r.state !== 'free' || r.color === 'gold') return false
    const p = r.body.translation()
    const v = r.body.linvel()
    return Math.hypot(p.x - x, p.z - z) < CITY_RING_RADIUS && Math.hypot(v.x, v.y, v.z) < 0.8
  })
  if (!rock) return false
  const p = rock.body.translation()
  digEffects.dust(p.x, p.y, p.z)
  rockRegistry.despawn?.(rock)
  audio.play('count')
  return true
}

/** できあがった（できた）ときの土ぼこり */
function puff(x: number, y: number, z: number, spread: number) {
  for (let k = 0; k < 6; k++) digEffects.dust(x + (Math.random() - 0.5) * spread, y + Math.random() * 2, z + (Math.random() - 0.5) * spread)
}

/**
 * ビル（Lv8）：輪に石を 4 こ置くと、持っている てっこつ 1 本を使って 1 階建つ。4 階で完成（星 +3）、となりの区画へ。全部で 3 つ。
 * 夜は窓が光る（光源は増やさず、窓の明るさだけ変える）
 */
function OfficeSite() {
  const offices = useCityStore((s) => s.offices)
  const floors = useCityStore((s) => s.officeFloors)
  const stones = useCityStore((s) => s.officeStones)
  const steel = useScrapStore((s) => s.steel)
  const textures = useMemo(officeTextures, [])
  const materials = useMemo(
    () =>
      OFFICE_TINTS.map(
        (tint) => new THREE.MeshStandardMaterial({ map: textures.map, emissiveMap: textures.emissiveMap, emissive: '#ffd27a', emissiveIntensity: 0, color: tint, roughness: 0.6 }),
      ),
    [textures],
  )
  useEffect(
    () => () => {
      materials.forEach((m) => m.dispose())
      textures.map.dispose()
      textures.emissiveMap.dispose()
    },
    [materials, textures],
  )
  const active = offices < OFFICE_PLOTS.length ? offices : -1
  const sign = useSign(stones, OFFICE_FLOOR_COST.stones, steel, OFFICE_FLOOR_COST.steel)

  // 建っている（建てはじめた）ビルには、車両がぶつかる
  useEffect(() => {
    OFFICE_PLOTS.forEach((p, i) => {
      const standing = i < offices || (i === active && floors > 0)
      setDynamicObstacle(`office-${i}`, standing ? { x: p.x, z: p.z, r: OFFICE.width / 2 + 1 } : null)
    })
  }, [offices, floors, active])
  useEffect(() => () => OFFICE_PLOTS.forEach((_, i) => setDynamicObstacle(`office-${i}`, null)), [])

  const timer = useRef(0)
  useFrame((_, dt) => {
    // 夜は窓が光る
    const glow = Math.max(0, dayNight.darkness - 0.2) * 0.9
    for (const m of materials) m.emissiveIntensity = glow
    timer.current += dt
    if (timer.current < USE_INTERVAL) return
    timer.current = 0
    const city = useCityStore.getState()
    if (city.offices >= OFFICE_PLOTS.length) return
    const ring = officeRing(city.offices)
    if (city.officeStones < OFFICE_FLOOR_COST.stones) {
      if (takeStoneIn(ring.x, ring.z)) city.addOfficeStone()
      return
    }
    // 石がそろった：てっこつがあれば 1 階建つ（なければ看板の数が赤くなる）
    if (!useScrapStore.getState().spendSteel(OFFICE_FLOOR_COST.steel)) return
    const plot = OFFICE_PLOTS[city.offices]
    puff(plot.x, (city.officeFloors + 0.5) * OFFICE.floorHeight, plot.z, OFFICE.width)
    audio.play('clang')
    if (city.buildOfficeFloor(OFFICE.floors)) {
      useProgressStore.getState().addStars(OFFICE_STARS)
      audio.play('missionClear')
      useToastStore.getState().show({ title: `ビルが できた！ ほし +${OFFICE_STARS}`, icon: 'star', color: '#ffc933', stars: 0, isNew: true })
    }
  })

  return (
    <>
      {OFFICE_PLOTS.map((p, i) => {
        const done = i < offices ? OFFICE.floors : i === active ? floors : 0
        if (i > offices) return null
        const mat = materials[i % materials.length]
        return (
          <group key={i} position={[p.x, 0, p.z]}>
            <mesh position-y={0.15} geometry={slabGeometry} material={roofMaterial} receiveShadow />
            {Array.from({ length: done }, (_, k) => (
              <mesh key={k} position-y={0.3 + k * OFFICE.floorHeight + OFFICE.floorHeight / 2} geometry={officeFloorGeometry} material={mat} castShadow receiveShadow />
            ))}
            {i < offices ? (
              <>
                <mesh position-y={0.3 + OFFICE.floors * OFFICE.floorHeight + 0.2} geometry={roofGeometry} material={roofMaterial} castShadow />
                <mesh position={[1.8, 0.3 + OFFICE.floors * OFFICE.floorHeight + 1.2, -1.5]} geometry={tankGeometry} material={roofMaterial} castShadow />
              </>
            ) : (
              <>
                {/* いま建てている階：鉄骨の骨組み（つぎにできる所） */}
                <mesh position-y={0.3 + done * OFFICE.floorHeight} geometry={officeFrameGeometry} material={stones > 0 ? frameMaterial : ghostMaterial} castShadow={stones > 0} />
                {/* その上はうっすら（できあがりの高さが分かるように） */}
                {done + 1 < OFFICE.floors && (
                  <mesh
                    position-y={0.3 + (done + 1) * OFFICE.floorHeight + ((OFFICE.floors - done - 1) * OFFICE.floorHeight) / 2}
                    scale={[1, OFFICE.floors - done - 1, 1]}
                    geometry={officeFloorGeometry}
                    material={ghostMaterial}
                  />
                )}
              </>
            )}
          </group>
        )
      })}
      {active >= 0 && <MaterialRing x={officeRing(active).x} z={officeRing(active).z} sign={sign} />}
    </>
  )
}

/**
 * タワー（Lv9）：東京タワーのような赤と白の鉄骨の塔。輪に石を 3 こ置くと、てっこつ 2 本を使って 1 段建つ。
 * 6 段（足 → 胴 → 大展望台 → 胴 → 特別展望台 → アンテナ）で完成（星 +5）。夜はライトアップ（色の明るさだけ変える）
 */
function TowerSite() {
  const stage = useCityStore((s) => s.towerStage)
  const stones = useCityStore((s) => s.towerStones)
  const steel = useScrapStore((s) => s.steel)
  const done = stage >= TOWER_STAGES.length
  const sign = useSign(stones, TOWER_STAGE_COST.stones, steel, TOWER_STAGE_COST.steel)
  const geometries = useMemo(() => TOWER_STAGES.map((_, i) => towerStageGeometry(i)), [])
  const glassGeometries = useMemo(() => TOWER_STAGES.map((s, i) => (s.kind === 'deck' ? towerDeckGlassGeometry(i) : null)), [])
  const mats = useMemo(
    () => ({
      red: new THREE.MeshStandardMaterial({ color: '#e8562a', emissive: '#ff7a2a', emissiveIntensity: 0, roughness: 0.55, metalness: 0.3 }),
      white: new THREE.MeshStandardMaterial({ color: '#f3f1ea', emissive: '#ffe2b0', emissiveIntensity: 0, roughness: 0.55, metalness: 0.2 }),
      glass: new THREE.MeshStandardMaterial({ color: '#4f7fa8', emissive: '#ffe9a8', emissiveIntensity: 0, roughness: 0.2, metalness: 0.3 }),
    }),
    [],
  )
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose())
      glassGeometries.forEach((g) => g?.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geometries, glassGeometries, mats],
  )

  useEffect(() => {
    setDynamicObstacle('tower', stage > 0 ? { x: TOWER.x, z: TOWER.z, r: TOWER_STAGES[0].half0 + 0.5 } : null)
  }, [stage])
  useEffect(() => () => setDynamicObstacle('tower', null), [])

  const timer = useRef(0)
  useFrame((_, dt) => {
    // 夜のライトアップ（できあがるほど明るく）
    const glow = Math.max(0, dayNight.darkness - 0.2) * (useCityStore.getState().towerStage >= TOWER_STAGES.length ? 1 : 0.5)
    mats.red.emissiveIntensity = glow * 0.9
    mats.white.emissiveIntensity = glow * 0.6
    mats.glass.emissiveIntensity = glow * 1.2
    timer.current += dt
    if (timer.current < USE_INTERVAL) return
    timer.current = 0
    const city = useCityStore.getState()
    if (city.towerStage >= TOWER_STAGES.length) return
    if (city.towerStones < TOWER_STAGE_COST.stones) {
      if (takeStoneIn(TOWER_RING.x, TOWER_RING.z)) city.addTowerStone()
      return
    }
    if (!useScrapStore.getState().spendSteel(TOWER_STAGE_COST.steel)) return
    const s = TOWER_STAGES[city.towerStage]
    puff(TOWER.x, s.y0, TOWER.z, s.half0 * 2)
    audio.play('clang')
    city.buildTowerStage()
    if (city.towerStage + 1 >= TOWER_STAGES.length) {
      useProgressStore.getState().addStars(TOWER_STARS)
      audio.play('missionClear')
      useToastStore.getState().show({ title: `タワーが できた！ ほし +${TOWER_STARS}`, icon: 'star', color: '#ffc933', stars: 0, isNew: true })
    }
  })

  return (
    <>
      <group position={[TOWER.x, 0, TOWER.z]}>
        {TOWER_STAGES.map((s, i) => {
          if (i > stage) return null
          const ghost = i === stage
          return (
            <group key={i}>
              {/* frustumCulled を切る：形が高くのびるので、最初の範囲のままだと消えることがある */}
              <mesh geometry={geometries[i]} material={ghost ? ghostMaterial : s.white ? mats.white : mats.red} castShadow={!ghost} frustumCulled={false} />
              {glassGeometries[i] && !ghost && <mesh geometry={glassGeometries[i]!} material={mats.glass} />}
            </group>
          )
        })}
      </group>
      {!done && <MaterialRing x={TOWER_RING.x} z={TOWER_RING.z} sign={sign} />}
    </>
  )
}

/** 工事現場（Lv8 からビル、Lv9 からタワー） */
export function CitySite() {
  const level = useLevel().level
  return (
    <>
      <OfficeSite />
      {level >= TOWER_LEVEL && <TowerSite />}
    </>
  )
}
