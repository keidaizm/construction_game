import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOULDERS } from './fieldLayout'
import { boulderDirty, boulderShape, boulderStates, restoreBoulders } from './boulders'
import type { Biome } from './biomes'
import { useGameStore } from '../stores/gameStore'
import { setDynamicObstacle } from '../vehicles/shared/footprints'
import { setDigFloor } from '../vehicles/shared/digFloors'

const geometry = new THREE.DodecahedronGeometry(1.5, 0)
const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true })
/** 大きな岩の色（雪原は雪をかぶって白っぽく、砂漠は赤茶色） */
const BOULDER_COLORS: Record<Biome, string> = { base: '#8a7f73', snow: '#dfe6ec', forest: '#7a7d66', desert: '#c39566', rocky: '#706b66' }
/** ヒビが入るほど、この色に近づく */
const CRACKED = new THREE.Color('#3a3430')
const dummy = new THREE.Object3D()
const color = new THREE.Color()

/**
 * 大きな岩。車両がぶつかると止まる（footprints の動く障害物）。バケット・ブレーカーの先は岩の上で止まる（digFloors）。
 * ブレーカーで叩かれるとゆれてヒビ（色が暗く）が入り、割れると消える。次のミッションで元に戻る。
 */
export function BoulderField() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const resetToken = useGameStore((s) => s.resetToken)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    restoreBoulders()
  }, [resetToken])

  // ぶつかる所・先が止まる所（割れていない岩だけ）
  const syncObstacles = () => {
    BOULDERS.forEach((b, i) => {
      const broken = boulderStates[i].broken
      setDynamicObstacle(`boulder-${i}`, broken ? null : { x: b.x, z: b.z, r: b.r })
      const sh = boulderShape(i)
      setDigFloor(
        `boulder-${i}`,
        broken ? null : { x: sh.cx, z: sh.cz, heading: sh.yaw, halfWidth: sh.rx * 0.7, halfLength: sh.rz * 0.7, top: sh.cy + sh.ry * 0.8, noLanding: true },
      )
    })
  }

  useEffect(
    () => () =>
      BOULDERS.forEach((_, i) => {
        setDynamicObstacle(`boulder-${i}`, null)
        setDigFloor(`boulder-${i}`, null)
      }),
    [],
  )

  const write = (t: number) => {
    const m = mesh.current
    if (!m) return
    let shaking = false
    BOULDERS.forEach((p, i) => {
      const st = boulderStates[i]
      const sh = boulderShape(i)
      const wobble = st.shake > 0 ? Math.sin(t * 70 + i) * 0.05 * st.shake : 0
      if (st.shake > 0) shaking = true
      dummy.position.set(sh.cx + wobble, sh.cy, sh.cz - wobble)
      dummy.rotation.set(0, p.rotation, 0)
      const s = st.broken ? 0 : p.scale
      dummy.scale.set(s, s * 0.75, s * 1.1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      const damage = 1 - st.hp / st.maxHp
      m.setColorAt(i, color.set(BOULDER_COLORS[p.biome]).lerp(CRACKED, damage * 0.6))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return shaking
  }

  useLayoutEffect(() => {
    // 最初に 1 回。以降は boulderDirty・ゆれを見て useFrame で書きかえる
    write(0)
    syncObstacles()
  }, [])

  const shakingRef = useRef(false)
  useFrame(({ clock }, dt) => {
    let anyShake = false
    for (const st of boulderStates) {
      if (st.shake > 0) {
        st.shake = Math.max(0, st.shake - dt * 3)
        anyShake = true
      }
    }
    if (!boulderDirty.value && !anyShake && !shakingRef.current) return
    if (boulderDirty.value) syncObstacles()
    boulderDirty.value = false
    shakingRef.current = !!write(clock.elapsedTime)
  })

  return <instancedMesh ref={mesh} args={[geometry, material, BOULDERS.length]} castShadow />
}
