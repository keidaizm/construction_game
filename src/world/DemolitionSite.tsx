import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { BUILDING, DEMOLITION_SITE as SITE, FLOOR_HP, RECYCLE_YARD as YARD, REBUILD_DELAY, STEEL_STARS } from './demolitionLayout'
import { building, buildingActive, buildingTop, rebuildBuilding } from './demolition'
import { scrapRegistry } from '../cargo/scrap/scrapRegistry'
import { useScrapStore } from '../stores/scrapStore'
import { useProgressStore } from '../stores/progressStore'
import { useToastStore } from '../stores/toastStore'
import { setDynamicObstacle, footprintTouches } from '../vehicles/shared/footprints'
import { setDigFloor } from '../vehicles/shared/digFloors'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'

const { width: W, depth: D, floorHeight: FH, floors: FLOORS } = BUILDING

/** ビルの壁（窓が 3 つ並んだ 1 階ぶん）の模様 */
function wallTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#c9c4b8'
  ctx.fillRect(0, 0, 128, 64)
  // 階の区切りの帯
  ctx.fillStyle = '#a8a294'
  ctx.fillRect(0, 56, 128, 8)
  for (let i = 0; i < 3; i++) {
    const x = 10 + i * 40
    ctx.fillStyle = '#4b5a66'
    ctx.fillRect(x, 14, 28, 30)
    // 割れた窓
    ctx.strokeStyle = '#d8e4ea'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + 6 + i * 4, 14)
    ctx.lineTo(x + 14, 28)
    ctx.lineTo(x + 22 - i * 3, 44)
    ctx.stroke()
  }
  // よごれ
  ctx.fillStyle = 'rgba(80,70,60,0.18)'
  for (let i = 0; i < 14; i++) ctx.fillRect((i * 37) % 128, (i * 23) % 56, 6 + (i % 4) * 3, 3)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const floorGeometry = new THREE.BoxGeometry(W, FH, D)
const slabGeometry = new THREE.BoxGeometry(W + 1.2, 0.3, D + 1.2)
const roofGeometry = new THREE.BoxGeometry(W + 0.3, 0.35, D + 0.3)
const roofMaterial = new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 1 })
const slabMaterial = new THREE.MeshStandardMaterial({ color: '#7d786f', roughness: 1 })
const yardMaterial = new THREE.MeshBasicMaterial({ color: '#2fbf5b', transparent: true, opacity: 0.45, depthWrite: false })
const yardRingMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false })
const postMaterial = new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.9 })
/** ヒビが入るほど、この色に近づく */
const CRACKED = new THREE.Color('#5a5048')
const WHITE = new THREE.Color('#ffffff')

/** リサイクル場の看板：鉄骨の絵と「2 / 5」 */
function drawYardSign(canvas: HTMLCanvasElement, have: number, target: number) {
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#eafbe9'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#2fbf5b'
  ctx.lineWidth = 14
  ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14)
  // 鉄骨（H 形鋼の切り口：I の形）
  ctx.fillStyle = '#b04a2e'
  ctx.fillRect(60, 30, 130, 20)
  ctx.fillRect(110, 50, 30, 60)
  ctx.fillRect(60, 110, 130, 20)
  ctx.fillStyle = '#2b2b2b'
  ctx.font = '900 84px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${have} / ${target}`, 370, canvas.height / 2 + 4)
}

/**
 * 古いビルと、リサイクル場（Lv7）。
 * - ビル：3 階建て。ブレーカーで叩くとゆれて黒ずみ、上の階から 1 つずつこわれる（がれきが出る、world/demolition）。
 *   全部こわれたら 30 秒して元に戻る（車両が上にいる間は待つ）。車両はぶつかると止まり、バケットの先は屋上で止まる
 * - リサイクル場（緑の場所）：止まった鉄骨（ふるい終わったもの）を 1 本ずつ集めて、てっこつにする。
 *   コンクリートつきのままなら「ふるいに かけてね」
 */
export function DemolitionSite() {
  const floorMeshes = useRef<(THREE.Mesh | null)[]>([])
  const roof = useRef<THREE.Mesh>(null)
  const shakeGroup = useRef<THREE.Group>(null)
  const bodies = useRef<(RapierRigidBody | null)[]>([])

  const wall = useMemo(wallTexture, [])
  const wallMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: wall, roughness: 0.95 }), [wall])
  /** いちばん上の階（叩かれるとヒビで暗くなる） */
  const damagedMaterial = useMemo(() => wallMaterial.clone(), [wallMaterial])
  const topMaterials = useMemo(() => {
    // 箱の面の順：+X, -X, +Y, -Y, +Z, -Z（上下は窓のない色）
    const plain = new THREE.MeshStandardMaterial({ color: '#b8b2a6', roughness: 1 })
    return { plain }
  }, [])

  // 起きたとき：ビルを最初の形に（前の Lv7 の遊びでこわしたままでも）
  useEffect(() => {
    rebuildBuilding()
    buildingActive.value = true
    return () => {
      buildingActive.value = false
      setDynamicObstacle('building-a', null)
      setDynamicObstacle('building-b', null)
      setDigFloor('building', null)
      wall.dispose()
      wallMaterial.dispose()
      damagedMaterial.dispose()
      topMaterials.plain.dispose()
    }
  }, [wall, wallMaterial, damagedMaterial, topMaterials])

  // リサイクル場の看板
  const signCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 160
    return c
  }, [])
  const signTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(signCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [signCanvas])
  const signMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture }), [signTexture])
  const target = useScrapStore((s) => s.target)
  const have = useScrapStore((s) => s.loads.reduce((n, k) => n + k, 0))
  useEffect(() => {
    drawYardSign(signCanvas, have, target)
    signTexture.needsUpdate = true
  }, [signCanvas, signTexture, have, target])
  useEffect(
    () => () => {
      signTexture.dispose()
      signMaterial.dispose()
    },
    [signTexture, signMaterial],
  )

  /** 階の見た目・当たり判定・ぶつかる所を、いまの階の数に合わせる */
  const sync = () => {
    const n = building.floors
    floorMeshes.current.forEach((m, i) => {
      if (!m) return
      m.visible = i < n
      const mat = i === n - 1 ? damagedMaterial : wallMaterial
      m.material = [mat, mat, topMaterials.plain, topMaterials.plain, mat, mat]
    })
    if (roof.current) {
      roof.current.visible = n > 0
      roof.current.position.y = n * FH + 0.17
    }
    bodies.current.forEach((b, i) => {
      if (!b) return
      // 当たり判定は消せないので、こわれた階は地面の下へ退避させる
      b.setNextKinematicTranslation({ x: SITE.x, y: i < n ? i * FH + FH / 2 : -60 - i * 5, z: SITE.z })
    })
    const standing = n > 0
    setDynamicObstacle('building-a', standing ? { x: SITE.x - W / 4, z: SITE.z, r: D / 2 + 0.4 } : null)
    setDynamicObstacle('building-b', standing ? { x: SITE.x + W / 4, z: SITE.z, r: D / 2 + 0.4 } : null)
    setDigFloor('building', standing ? { x: SITE.x, z: SITE.z, heading: 0, halfWidth: W / 2, halfLength: D / 2, top: buildingTop() + 0.35, noLanding: true } : null)
  }

  const yardTimer = useRef(0)
  const hintAt = useRef(-Infinity)
  useFrame(({ clock }, dt) => {
    // --- ビル ---
    if (building.shake > 0) building.shake = Math.max(0, building.shake - dt * 3)
    if (shakeGroup.current) {
      const w = building.shake > 0 ? Math.sin(clock.elapsedTime * 70) * 0.06 * building.shake : 0
      shakeGroup.current.position.set(w, 0, -w)
    }
    if (building.dirty) {
      building.dirty = false
      damagedMaterial.color.copy(WHITE).lerp(CRACKED, (1 - building.hp / FLOOR_HP) * 0.7)
      sync()
    }
    // 全部こわれたら、しばらくして元に戻る（車両が跡地にいる間は待つ）
    if (building.floors === 0 && scrapRegistry.now - building.brokenAt > REBUILD_DELAY && !footprintTouches(SITE.x, SITE.z, D / 2 + 1)) {
      rebuildBuilding()
      for (let k = 0; k < 6; k++) digEffects.dust(SITE.x + (Math.random() - 0.5) * W, 0.5 + Math.random() * 4, SITE.z + (Math.random() - 0.5) * D)
    }

    // --- リサイクル場：止まった鉄骨を 1 本ずつ数える ---
    yardTimer.current += dt
    if (yardTimer.current < 0.3) return
    yardTimer.current = 0
    for (const piece of scrapRegistry.pieces) {
      if (piece.state !== 'free') continue
      const p = piece.body.translation()
      if (Math.hypot(p.x - YARD.x, p.z - YARD.z) > YARD.radius) continue
      const v = piece.body.linvel()
      if (Math.hypot(v.x, v.y, v.z) > 0.6) continue
      if (piece.kind === 'mixed') {
        // コンクリートつきは数えない（何度も出さない）
        if (clock.elapsedTime - hintAt.current > 8) {
          hintAt.current = clock.elapsedTime
          useToastStore.getState().show({ title: 'スケルトンバケットで ふるってから もってきてね', icon: 'steel', color: '#a9a8a2', stars: 0, isNew: false })
        }
        continue
      }
      digEffects.dust(p.x, p.y, p.z)
      scrapRegistry.despawn?.(piece)
      audio.play('clang')
      if (useScrapStore.getState().deliver()) {
        useProgressStore.getState().addStars(STEEL_STARS)
        audio.play('missionClear')
      }
      break // 1 回に 1 本（ポン、ポン、と数える）
    }
  })

  return (
    <>
      {/* ビル */}
      <group position={[SITE.x, 0, SITE.z]}>
        <mesh position-y={0.15} geometry={slabGeometry} material={slabMaterial} receiveShadow />
        <group ref={shakeGroup}>
          {Array.from({ length: FLOORS }, (_, i) => (
            <mesh key={i} ref={(el) => void (floorMeshes.current[i] = el)} position-y={i * FH + FH / 2} geometry={floorGeometry} castShadow receiveShadow />
          ))}
          <mesh ref={roof} geometry={roofGeometry} material={roofMaterial} position-y={FLOORS * FH + 0.17} castShadow />
        </group>
      </group>
      {/* 階ごとの当たり判定（石・がれきが壁で止まる）。こわれた階は地面の下へ */}
      {Array.from({ length: FLOORS }, (_, i) => (
        <RigidBody key={i} ref={(el) => void (bodies.current[i] = el)} type="kinematicPosition" colliders={false} position={[SITE.x, i * FH + FH / 2, SITE.z]}>
          <CuboidCollider args={[W / 2, FH / 2, D / 2]} friction={0.8} />
        </RigidBody>
      ))}

      {/* リサイクル場（緑の場所）と看板 */}
      <group position={[YARD.x, 0, YARD.z]}>
        <mesh position-y={0.04} rotation-x={-Math.PI / 2} material={yardMaterial} renderOrder={2}>
          <circleGeometry args={[YARD.radius, 40]} />
        </mesh>
        <mesh position-y={0.05} rotation-x={-Math.PI / 2} material={yardRingMaterial} renderOrder={2}>
          <ringGeometry args={[YARD.radius - 0.3, YARD.radius, 40]} />
        </mesh>
        {/* 看板（輪の東がわ）。基地（北）からも、ビル（南）から来るダンプからも見えるよう、表と裏に絵 */}
        <group position={[-YARD.radius - 0.8, 0, 0]}>
          {[-1.3, 1.3].map((x) => (
            <mesh key={x} position={[x, 1.1, 0]} material={postMaterial}>
              <boxGeometry args={[0.15, 2.2, 0.15]} />
            </mesh>
          ))}
          <mesh position={[0, 1.9, 0.09]} material={signMaterial}>
            <planeGeometry args={[3, 0.94]} />
          </mesh>
          <mesh position={[0, 1.9, -0.09]} rotation-y={Math.PI} material={signMaterial}>
            <planeGeometry args={[3, 0.94]} />
          </mesh>
        </group>
      </group>
    </>
  )
}
