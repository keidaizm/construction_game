import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CHESTS, CHEST_RADIUS, CHEST_TOUCH_MARGIN, SIGHTS, SIGHT_DISCOVER_RADIUS, type Sight } from './discoveryLayout'
import { refillChestsIfAllOpen, useDiscoveryStore } from '../stores/discoveryStore'
import { useCollectionStore } from '../stores/collectionStore'
import { useToastStore } from '../stores/toastStore'
import { ORES, type OreId } from '../cargo/ores/oreTypes'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'
import { footprintTouches } from '../vehicles/shared/footprints'
import { excavatorSensors } from '../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../vehicles/bulldozer/bulldozerSensors'

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra })
const snowMat = mat('#f7fbff', { roughness: 0.6 })
const blackMat = mat('#222222')
const carrotMat = mat('#ff7a1a')
const stoneMat = mat('#d8c9a6')
const towerMat = mat('#e9e2d4')
const roofMat = mat('#b5453a')
const bladeMat = mat('#f4efe4')
const sandstoneMat = mat('#dcb877')
const volcanoMat = mat('#6d5d55')
const lavaMat = mat('#ff5a1f', { emissive: '#ff3a00', emissiveIntensity: 1.2 })
const smokeMat = new THREE.MeshStandardMaterial({ color: '#9a9a9a', roughness: 1, transparent: true, opacity: 0.6, depthWrite: false })
const woodMat = mat('#9a5e2c')
const goldMat = mat('#ffc933', { metalness: 0.6, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.4 })

/** 名所の向き：基地（フィールドの中心）の方を向く */
const faceCenter = (s: Sight) => Math.atan2(-s.x, -s.z)

function Snowman({ sight }: { sight: Sight }) {
  return (
    <group position={[sight.x, 0, sight.z]} rotation-y={faceCenter(sight)}>
      <mesh position-y={1.9} material={snowMat} castShadow>
        <sphereGeometry args={[2.1, 14, 10]} />
      </mesh>
      <mesh position-y={4.8} material={snowMat} castShadow>
        <sphereGeometry args={[1.5, 14, 10]} />
      </mesh>
      <mesh position-y={6.9} material={snowMat} castShadow>
        <sphereGeometry args={[1.05, 12, 9]} />
      </mesh>
      {/* 目・ボタン・にんじんの鼻・帽子 */}
      {[0.38, -0.38].map((x) => (
        <mesh key={x} position={[x, 7.15, 0.95]} material={blackMat}>
          <sphereGeometry args={[0.13, 6, 5]} />
        </mesh>
      ))}
      {[5.3, 4.7, 4.1].map((y) => (
        <mesh key={y} position={[0, y, 1.45]} material={blackMat}>
          <sphereGeometry args={[0.15, 6, 5]} />
        </mesh>
      ))}
      <mesh position={[0, 6.9, 1.35]} rotation-x={Math.PI / 2} material={carrotMat}>
        <coneGeometry args={[0.18, 0.9, 8]} />
      </mesh>
      <mesh position-y={7.95} material={blackMat}>
        <cylinderGeometry args={[1.1, 1.1, 0.1, 14]} />
      </mesh>
      <mesh position-y={8.55} material={blackMat}>
        <cylinderGeometry args={[0.72, 0.72, 1.2, 14]} />
      </mesh>
    </group>
  )
}

function Windmill({ sight }: { sight: Sight }) {
  const blades = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += Math.min(dt, 0.05) * 0.8
  })
  return (
    <group position={[sight.x, 0, sight.z]} rotation-y={faceCenter(sight)}>
      <mesh position-y={5} material={towerMat} castShadow>
        <cylinderGeometry args={[1.5, 2.3, 10, 8]} />
      </mesh>
      <mesh position-y={11.2} material={roofMat} castShadow>
        <coneGeometry args={[2, 2.6, 8]} />
      </mesh>
      <mesh position={[0, 2, 2.05]} material={roofMat}>
        <boxGeometry args={[1.1, 1.8, 0.2]} />
      </mesh>
      <group ref={blades} position={[0, 9.6, 1.9]}>
        <mesh material={blackMat}>
          <sphereGeometry args={[0.4, 8, 6]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation-z={(i * Math.PI) / 2} position={[Math.cos((i * Math.PI) / 2) * 3.2, Math.sin((i * Math.PI) / 2) * 3.2, 0.1]} material={bladeMat} castShadow>
            <boxGeometry args={[5.6, 1.2, 0.12]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Pyramid({ sight }: { sight: Sight }) {
  return (
    <group position={[sight.x, 0, sight.z]}>
      <mesh position-y={6} rotation-y={Math.PI / 4} material={sandstoneMat} castShadow receiveShadow>
        <coneGeometry args={[11, 12, 4]} />
      </mesh>
      {/* 入口 */}
      <mesh position={[0, 1.2, 7.6]} material={stoneMat}>
        <boxGeometry args={[2, 2.4, 0.6]} />
      </mesh>
    </group>
  )
}

const PUFFS = 6

function Volcano({ sight }: { sight: Sight }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([])
  const time = useRef(0)
  useFrame((_, dt) => {
    time.current += Math.min(dt, 0.05)
    puffs.current.forEach((m, i) => {
      if (!m) return
      const t = (time.current * 0.25 + i / PUFFS) % 1
      m.position.set(Math.sin(i * 2.1) * t * 2, 12.5 + t * 9, Math.cos(i * 1.7) * t * 2)
      m.scale.setScalar(0.8 + t * 2.4)
    })
  })
  return (
    <group position={[sight.x, 0, sight.z]}>
      <mesh position-y={6} material={volcanoMat} castShadow receiveShadow>
        <cylinderGeometry args={[2.8, 11, 12, 10]} />
      </mesh>
      <mesh position-y={12.02} rotation-x={-Math.PI / 2} material={lavaMat}>
        <circleGeometry args={[2.4, 10]} />
      </mesh>
      {/* 山肌を流れる溶岩 */}
      <mesh position={[0, 8.5, 5.3]} rotation-x={0.42} material={lavaMat}>
        <boxGeometry args={[0.9, 7.5, 0.2]} />
      </mesh>
      {Array.from({ length: PUFFS }, (_, i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m)} material={smokeMat}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  )
}

const SIGHT_MODELS = { snowman: Snowman, windmill: Windmill, pyramid: Pyramid, volcano: Volcano }

// 宝箱（8 こを 4 回の描画でまとめて描く：箱・箱の金具・ふた・ふたの金具）
const W = 1.4
const D = 0.9
const BH = 0.75
const LH = 0.4
const baseWood = new THREE.BoxGeometry(W, BH, D).translate(0, BH / 2, 0)
const baseGold = mergeGeometries([
  new THREE.BoxGeometry(0.14, BH + 0.02, D + 0.04).translate(-W / 2 + 0.2, BH / 2, 0),
  new THREE.BoxGeometry(0.14, BH + 0.02, D + 0.04).translate(W / 2 - 0.2, BH / 2, 0),
  new THREE.BoxGeometry(0.3, 0.32, 0.08).translate(0, BH - 0.18, D / 2 + 0.03),
])
// ふたは後ろの上の辺（ちょうつがい）を原点にする
const lidWood = new THREE.BoxGeometry(W, LH, D).translate(0, LH / 2, D / 2)
const lidGold = mergeGeometries([
  new THREE.BoxGeometry(0.14, LH + 0.02, D + 0.04).translate(-W / 2 + 0.2, LH / 2, D / 2),
  new THREE.BoxGeometry(0.14, LH + 0.02, D + 0.04).translate(W / 2 - 0.2, LH / 2, D / 2),
])
const LID_OPEN = 1.9
const dummy = new THREE.Object3D()
const hinge = new THREE.Matrix4()
const tmp = new THREE.Matrix4()

/** 宝箱の中身：★2 以上のふつうの鉱石（時間帯・宝の山だけのものは入っていない）。山より、レアなものが少し出やすい */
const CHEST_ORES = ORES.filter((o) => o.stars >= 2 && !o.onlyAt && !o.onlyIn && !o.fromBoulder)
function pickChestOre(): OreId {
  const weights = CHEST_ORES.map((o) => Math.pow(o.weight, 0.6))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < CHEST_ORES.length; i++) {
    if (r < weights[i]) return CHEST_ORES[i].id
    r -= weights[i]
  }
  return CHEST_ORES[0].id
}

function Chests() {
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)]
  const lidAngle = useRef<number[]>(CHESTS.map((c) => (useDiscoveryStore.getState().openedChests.includes(c.id) ? LID_OPEN : 0)))
  const baseMatrices = useMemo(
    () =>
      CHESTS.map((c) => {
        dummy.position.set(c.x, 0, c.z)
        dummy.rotation.set(0, c.rotation, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        return dummy.matrix.clone()
      }),
    [],
  )

  const writeLid = (i: number) => {
    // ちょうつがい（箱の後ろの上）でふたを開ける
    hinge.makeTranslation(0, BH, -D / 2).multiply(tmp.makeRotationX(-lidAngle.current[i]))
    const m = tmp.multiplyMatrices(baseMatrices[i], hinge)
    refs[2].current!.setMatrixAt(i, m)
    refs[3].current!.setMatrixAt(i, m)
  }

  useLayoutEffect(() => {
    CHESTS.forEach((_, i) => {
      refs[0].current!.setMatrixAt(i, baseMatrices[i])
      refs[1].current!.setMatrixAt(i, baseMatrices[i])
      writeLid(i)
    })
    refs.forEach((r) => (r.current!.instanceMatrix.needsUpdate = true))
    // refs・writeLid は毎回同じものを使うので、作り直しは baseMatrices だけで判断する
  }, [baseMatrices])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const opened = useDiscoveryStore.getState().openedChests
    let changed = false
    CHESTS.forEach((c, i) => {
      const target = opened.includes(c.id) ? LID_OPEN : 0
      const a = lidAngle.current[i]
      if (a === target) return
      lidAngle.current[i] = target > a ? Math.min(target, a + dt * 4) : Math.max(target, a - dt * 1.5)
      writeLid(i)
      changed = true
    })
    if (changed) {
      refs[2].current!.instanceMatrix.needsUpdate = true
      refs[3].current!.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={refs[0]} args={[baseWood, woodMat, CHESTS.length]} castShadow />
      <instancedMesh ref={refs[1]} args={[baseGold, goldMat, CHESTS.length]} />
      <instancedMesh ref={refs[2]} args={[lidWood, woodMat, CHESTS.length]} castShadow />
      <instancedMesh ref={refs[3]} args={[lidGold, goldMat, CHESTS.length]} />
    </>
  )
}

const VEHICLES = [excavatorSensors, dumpTruckSensors, bulldozerSensors]
const CHECK_INTERVAL = 0.25
/** 全部の宝箱を開けてから、また閉じるまで [s] */
const REFILL_DELAY = 6

/** 名所を見つけたか・宝箱に触れたかを調べる（3D には何も描かない） */
function DiscoveryChecker() {
  const timer = useRef(0)
  const refillAt = useRef<number | null>(null)
  const clock = useRef(0)
  useFrame((_, dt) => {
    clock.current += dt
    timer.current += dt
    if (timer.current < CHECK_INTERVAL) return
    timer.current = 0
    const store = useDiscoveryStore.getState()

    for (const s of SIGHTS) {
      if (store.sights.includes(s.id)) continue
      if (!VEHICLES.some((v) => Math.hypot(v.x - s.x, v.z - s.z) < SIGHT_DISCOVER_RADIUS)) continue
      store.discoverSight(s.id)
      audio.play('findNew')
      useToastStore.getState().show({ title: `${s.name}を はっけん！`, icon: 'sight', sight: s.id, color: '#ffffff', stars: 0, isNew: true })
    }

    for (const c of CHESTS) {
      if (store.openedChests.includes(c.id)) continue
      if (!footprintTouches(c.x, c.z, CHEST_RADIUS + CHEST_TOUCH_MARGIN)) continue
      store.openChest(c.id)
      const ore = pickChestOre()
      const isNew = useCollectionStore.getState().add(ore)
      digEffects.ore(ore, c.x, 1.2, c.z)
      audio.play(isNew ? 'findNew' : 'find')
    }

    // 全部開けたら、少したってからまた閉じる（また探しに行ける）
    if (useDiscoveryStore.getState().openedChests.length >= CHESTS.length) {
      refillAt.current ??= clock.current + REFILL_DELAY
      if (clock.current >= refillAt.current) {
        refillAt.current = null
        refillChestsIfAllOpen()
      }
    }
  })
  return null
}

/** 名所（ゆきだるま・かざぐるま・ピラミッド・かざん）と宝箱 */
export function Discoveries() {
  return (
    <>
      {SIGHTS.map((s) => {
        const Model = SIGHT_MODELS[s.id]
        return <Model key={s.id} sight={s} />
      })}
      <Chests />
      <DiscoveryChecker />
    </>
  )
}
