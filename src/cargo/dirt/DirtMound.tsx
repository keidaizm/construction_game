import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useGameStore } from '../../stores/gameStore'
import { setDynamicObstacle } from '../../vehicles/shared/footprints'
import { seededRandom } from '../../world/textures'
import { BLOCK, MOUND_GRID, initialHeights, type DirtMoundConfig } from './dirtConfig'
import { dirtRegistry, type DirtMoundHandle } from './dirtRegistry'
import type { OuterBiome } from '../../world/biomes'

const C = (MOUND_GRID - 1) / 2
/** バケットの先がこれだけ列の外にはみ出していても、その列を崩す（子ども向けに甘め） */
const DIG_MARGIN = 0.2
const MAX_BLOCKS = initialHeights().reduce((a, b) => a + b, 0)

const blockGeometry = new THREE.BoxGeometry(BLOCK * 0.98, BLOCK * 0.98, BLOCK * 0.98)
const blockMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true })
const dummy = new THREE.Object3D()

/** 宝の山のブロックの色（地帯ごと）と、まざっている宝石の粒の色 */
const TREASURE_LOOK: Record<OuterBiome, { h: number; s: number; l: number; gems: readonly string[] }> = {
  snow: { h: 0.56, s: 0.35, l: 0.78, gems: ['#7fd8ff', '#c9f2ff'] },
  forest: { h: 0.27, s: 0.35, l: 0.3, gems: ['#3fbf86', '#9be36b'] },
  desert: { h: 0.09, s: 0.5, l: 0.58, gems: ['#ff9f6b', '#ffd36b'] },
  rocky: { h: 0.72, s: 0.08, l: 0.3, gems: ['#8f6bd6', '#d0b8ff'] },
}

/**
 * 土の山（土ブロックの集まり）。バケットで崩すと、中から石や鉱石が出てくる（useBucketDig）。
 * ブロックは列ごとの高さで持ち、崩すとその列のいちばん上が消える。
 * 石が上に乗れるよう、列ごとに固定の当たり判定を置く。
 */
export function DirtMound({ config }: { config: DirtMoundConfig }) {
  const [heights, setHeights] = useState(initialHeights)
  const heightsRef = useRef(heights)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const resetToken = useGameStore((s) => s.resetToken)
  const [cx, cz] = config.center

  // ブロックごとの土の色（少しずつ違う）
  const colors = useMemo(() => {
    const rand = seededRandom(cx * 31 + cz * 17)
    const look = config.treasure ? TREASURE_LOOK[config.treasure] : null
    // 列ごと・段ごと（最大 3 段）に 1 色。宝の山は地帯の色で、ところどころ宝石の粒が光るブロック
    return Array.from({ length: MOUND_GRID * MOUND_GRID * 3 }, () => {
      if (!look) return new THREE.Color().setHSL(0.07 + rand() * 0.02, 0.45, 0.28 + rand() * 0.1)
      if (rand() < 0.22) return new THREE.Color(look.gems[Math.floor(rand() * look.gems.length)])
      return new THREE.Color().setHSL(look.h + rand() * 0.02, look.s, look.l + rand() * 0.08)
    })
  }, [cx, cz, config.treasure])

  // 「はじめから」・次のミッションで山を元に戻す
  const lastReset = useRef(resetToken)
  useEffect(() => {
    if (lastReset.current === resetToken) return
    lastReset.current = resetToken
    const h = initialHeights()
    heightsRef.current = h
    setHeights(h)
  }, [resetToken])

  // 見た目を高さに合わせる
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    let n = 0
    heights.forEach((h, idx) => {
      const i = Math.floor(idx / MOUND_GRID)
      const j = idx % MOUND_GRID
      for (let k = 0; k < h; k++) {
        dummy.position.set(cx + (i - C) * BLOCK, BLOCK / 2 + k * BLOCK, cz + (j - C) * BLOCK)
        dummy.updateMatrix()
        m.setMatrixAt(n, dummy.matrix)
        m.setColorAt(n, colors[idx * 3 + k])
        n++
      }
    })
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    // ブロックが残っている間は、車両がぶつかって止まる
    setDynamicObstacle(config.id, n > 0 ? { x: cx, z: cz, r: 2.2 } : null)
  }, [heights, cx, cz, colors, config.id])

  useEffect(() => () => setDynamicObstacle(config.id, null), [config.id])

  // バケットで崩すための窓口
  useEffect(() => {
    const handle: DirtMoundHandle = {
      id: config.id,
      center: config.center,
      treasure: config.treasure,
      tryDig(x, y, z) {
        const fi = (x - cx) / BLOCK + C
        const fj = (z - cz) / BLOCK + C
        const i = Math.round(fi)
        const j = Math.round(fj)
        if (i < 0 || j < 0 || i >= MOUND_GRID || j >= MOUND_GRID) return null
        if (Math.abs(fi - i) > 0.5 + DIG_MARGIN || Math.abs(fj - j) > 0.5 + DIG_MARGIN) return null
        const idx = i * MOUND_GRID + j
        const h = heightsRef.current[idx]
        if (h <= 0 || y > h * BLOCK + 0.1) return null
        const next = [...heightsRef.current]
        next[idx] = h - 1
        heightsRef.current = next
        setHeights(next)
        return { x: cx + (i - C) * BLOCK, y: (h - 0.5) * BLOCK, z: cz + (j - C) * BLOCK }
      },
    }
    dirtRegistry.add(handle)
    return () => dirtRegistry.remove(handle)
  }, [config.id, config.center, config.treasure, cx, cz])

  return (
    <>
      <instancedMesh ref={mesh} args={[blockGeometry, blockMaterial, MAX_BLOCKS]} castShadow receiveShadow />
      <RigidBody type="fixed" colliders={false}>
        {heights.map((h, idx) =>
          h > 0 ? (
            <CuboidCollider
              key={`${idx}-${h}`}
              args={[BLOCK / 2, (h * BLOCK) / 2, BLOCK / 2]}
              position={[cx + (Math.floor(idx / MOUND_GRID) - C) * BLOCK, (h * BLOCK) / 2, cz + ((idx % MOUND_GRID) - C) * BLOCK]}
            />
          ) : null,
        )}
      </RigidBody>
    </>
  )
}
