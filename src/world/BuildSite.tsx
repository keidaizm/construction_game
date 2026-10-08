import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HOUSE, HOUSE_STARS, HOUSE_YAW, LOGS_PER_HOUSE, PLOTS, PLOT_RADIUS } from './buildSiteLayout'
import { useHouseStore } from '../stores/houseStore'
import { useProgressStore } from '../stores/progressStore'
import { useToastStore } from '../stores/toastStore'
import { logRegistry } from '../cargo/logs/logRegistry'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'

const MAX = PLOTS.length
const logGeometry = new THREE.CylinderGeometry(0.21, 0.21, 1, 8).rotateZ(Math.PI / 2)
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
const logMaterial = new THREE.MeshStandardMaterial({ color: '#9a6236', roughness: 1, flatShading: true })
const roofMaterial = new THREE.MeshStandardMaterial({ color: '#b5453a', roughness: 0.8 })
const doorMaterial = new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.9 })
const windowMaterial = new THREE.MeshStandardMaterial({ color: '#9fd3f0', roughness: 0.2 })
const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#a9a39a', roughness: 1 })
const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.85, depthWrite: false })

const WALL_TOP = 0.15 + HOUSE.layers * HOUSE.layer
const ROOF_RISE = 1.6
const ROOF_HALF = HOUSE.depth / 2 + 0.4
const ROOF_SLOPE = Math.atan2(ROOF_RISE, ROOF_HALF)
const ROOF_LEN = Math.hypot(ROOF_RISE, ROOF_HALF)

/** 家の部品（家のローカル：正面がローカル +Z） [位置, 回転 x, 大きさ] */
type Part = { p: [number, number, number]; rx?: number; s: [number, number, number] }

/** 使った木材の数（0〜12）で、見えている部品 */
function houseParts(stage: number) {
  const logs: Part[] = []
  const roofs: Part[] = []
  const doors: Part[] = []
  const windows: Part[] = []
  const stones: Part[] = [{ p: [0, 0.075, 0], s: [HOUSE.width + 0.6, 0.15, HOUSE.depth + 0.6] }]
  const { width: W, depth: D, layer: L } = HOUSE
  for (let k = 0; k < Math.min(stage, HOUSE.layers); k++) {
    const y = 0.15 + L / 2 + k * L
    logs.push({ p: [0, y, D / 2], s: [W + 0.4, 1, 1] }, { p: [0, y, -D / 2], s: [W + 0.4, 1, 1] })
    // 横の壁（ローカル Z 向き）は、丸太を 90° 回したものとして別にあつかう
    logs.push({ p: [W / 2, y, 0], rx: -1, s: [D + 0.4, 1, 1] }, { p: [-W / 2, y, 0], rx: -1, s: [D + 0.4, 1, 1] })
  }
  if (stage >= 9) roofs.push({ p: [0, WALL_TOP + ROOF_RISE / 2, ROOF_HALF / 2], rx: ROOF_SLOPE, s: [W + 0.8, 0.16, ROOF_LEN + 0.1] })
  if (stage >= 10) roofs.push({ p: [0, WALL_TOP + ROOF_RISE / 2, -ROOF_HALF / 2], rx: -ROOF_SLOPE, s: [W + 0.8, 0.16, ROOF_LEN + 0.1] })
  if (stage >= 11) {
    doors.push({ p: [-0.9, 0.15 + 0.95, D / 2 + 0.2], s: [1, 1.9, 0.12] })
    windows.push({ p: [1.2, 1.9, D / 2 + 0.2], s: [1, 0.8, 0.1] })
  }
  if (stage >= 12) stones.push({ p: [1.4, WALL_TOP + 1.3, -0.7], s: [0.55, 1.5, 0.55] })
  return { logs, roofs, doors, windows, stones }
}

const dummy = new THREE.Object3D()
const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), HOUSE_YAW)
const sideQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
const tiltQ = new THREE.Quaternion()
const X = new THREE.Vector3(1, 0, 0)

/** 家の部品を、区画の場所・向きでワールドへ置いて、InstancedMesh に書く */
function writeParts(mesh: THREE.InstancedMesh | null, list: Array<{ plot: number; part: Part }>) {
  if (!mesh) return
  list.forEach(({ plot, part }, i) => {
    const c = PLOTS[plot]
    dummy.position.set(...part.p).applyQuaternion(yawQ).add(new THREE.Vector3(c.x, 0, c.z))
    dummy.quaternion.copy(yawQ)
    if (part.rx === -1) dummy.quaternion.multiply(sideQ)
    else if (part.rx) dummy.quaternion.multiply(tiltQ.setFromAxisAngle(X, part.rx))
    dummy.scale.set(...part.s)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.count = list.length
  mesh.instanceMatrix.needsUpdate = true
}

/** 看板の絵：「いえ あと ◯ほん」 */
function drawSign(canvas: HTMLCanvasElement, rest: number, done: boolean) {
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff8e0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#9a6236'
  ctx.lineWidth = 14
  ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14)
  ctx.fillStyle = '#3a2a1a'
  ctx.font = '900 64px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (done) ctx.fillText('むらが できた！', canvas.width / 2, canvas.height / 2)
  else {
    ctx.fillText('いえ あと', canvas.width * 0.38, canvas.height / 2)
    ctx.fillStyle = '#e53935'
    ctx.font = '900 96px sans-serif'
    ctx.fillText(String(rest), canvas.width * 0.74, canvas.height / 2 + 4)
    ctx.fillStyle = '#3a2a1a'
    ctx.font = '900 48px sans-serif'
    ctx.fillText('ほん', canvas.width * 0.9, canvas.height / 2 + 14)
  }
}

/** 区画に置いた木材を使う間隔 [s] */
const USE_INTERVAL = 0.35

/**
 * 家を建てる場所（Lv6）。区画（黄色い輪）に木材を置くと 1 本ずつ家に使われ、丸太の壁 → 屋根 → 戸と窓 → えんとつ、と建っていく。
 * 12 本でできあがり（星 +3）、となりの区画へ。全部で 6 けん（村）。
 */
export function BuildSite() {
  const built = useHouseStore((s) => s.built)
  const progress = useHouseStore((s) => s.progress)
  const refs = {
    logs: useRef<THREE.InstancedMesh>(null),
    roofs: useRef<THREE.InstancedMesh>(null),
    doors: useRef<THREE.InstancedMesh>(null),
    windows: useRef<THREE.InstancedMesh>(null),
    stones: useRef<THREE.InstancedMesh>(null),
  }
  const current = built < MAX ? PLOTS[built] : null

  // 家の見た目（建てた家・いま建てている家）
  useLayoutEffect(() => {
    const lists = { logs: [], roofs: [], doors: [], windows: [], stones: [] } as Record<keyof typeof refs, Array<{ plot: number; part: Part }>>
    for (let i = 0; i < Math.min(built + 1, MAX); i++) {
      const parts = houseParts(i < built ? LOGS_PER_HOUSE : progress)
      for (const key of Object.keys(lists) as Array<keyof typeof refs>) for (const part of parts[key]) lists[key].push({ plot: i, part })
    }
    for (const key of Object.keys(lists) as Array<keyof typeof refs>) writeParts(refs[key].current, lists[key])
  }, [built, progress])

  // 看板
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
  const signMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: texture }), [texture])
  useEffect(() => {
    drawSign(canvas, LOGS_PER_HOUSE - progress, built >= MAX)
    texture.needsUpdate = true
  }, [canvas, texture, progress, built])
  useEffect(
    () => () => {
      texture.dispose()
      signMaterial.dispose()
    },
    [texture, signMaterial],
  )

  // 区画に置いた木材を使う
  const timer = useRef(0)
  useFrame((_, dt) => {
    timer.current += dt
    if (timer.current < USE_INTERVAL) return
    timer.current = 0
    const store = useHouseStore.getState()
    if (store.built >= MAX) return
    const plot = PLOTS[store.built]
    const log = logRegistry.logs.find((l) => {
      if (l.state !== 'free') return false
      const p = l.body.translation()
      const v = l.body.linvel()
      return Math.hypot(p.x - plot.x, p.z - plot.z) < PLOT_RADIUS && Math.hypot(v.x, v.y, v.z) < 0.8
    })
    if (!log) return
    const p = log.body.translation()
    digEffects.dust(p.x, p.y, p.z)
    logRegistry.despawn?.(log)
    const done = store.addLog(LOGS_PER_HOUSE)
    if (done) {
      useProgressStore.getState().addStars(HOUSE_STARS)
      audio.play('missionClear')
      useToastStore.getState().show({ title: `いえが できた！ ほし +${HOUSE_STARS}`, icon: 'star', color: '#ffc933', stars: 0, isNew: true })
    } else {
      audio.play('count')
    }
  })

  return (
    <>
      {/* 家はあとから建つ（見える範囲の計算が最初のままだと、画面に入っても描かれない）ので、範囲で省かない */}
      <instancedMesh ref={refs.logs} args={[logGeometry, logMaterial, MAX * HOUSE.layers * 4]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={refs.roofs} args={[boxGeometry, roofMaterial, MAX * 2]} castShadow frustumCulled={false} />
      <instancedMesh ref={refs.doors} args={[boxGeometry, doorMaterial, MAX]} frustumCulled={false} />
      <instancedMesh ref={refs.windows} args={[boxGeometry, windowMaterial, MAX]} frustumCulled={false} />
      <instancedMesh ref={refs.stones} args={[boxGeometry, stoneMaterial, MAX * 2]} receiveShadow frustumCulled={false} />
      {current && (
        <group position={[current.x, 0, current.z]}>
          {/* いま建てている区画：ここに木材を置く（黄色い輪） */}
          <mesh position-y={0.05} rotation-x={-Math.PI / 2} material={ringMaterial} renderOrder={2}>
            <ringGeometry args={[PLOT_RADIUS - 0.35, PLOT_RADIUS, 40]} />
          </mesh>
          {/* 看板（おきば＝ -X の方を向く） */}
          <group position={[-PLOT_RADIUS - 0.8, 0, PLOT_RADIUS - 0.5]} rotation-y={HOUSE_YAW}>
            {[-1.3, 1.3].map((x) => (
              <mesh key={x} position={[x, 1.1, -0.05]} material={doorMaterial}>
                <boxGeometry args={[0.15, 2.2, 0.15]} />
              </mesh>
            ))}
            <mesh position={[0, 1.9, 0.03]} material={signMaterial}>
              <planeGeometry args={[3, 0.94]} />
            </mesh>
          </group>
        </group>
      )}
    </>
  )
}
