import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { forest, forestDirty, findRegrowSpot, useForestStore, type ForestTree } from './forest'
import { FOLIAGE, trunkGeometry, trunkMaterial } from './treeModels'
import type { TreeKind } from './fieldLayout'
import { heightAt } from './terrain'
import { useGameStore } from '../stores/gameStore'
import { useProgressStore } from '../stores/progressStore'
import { readAxes, zeroAxes } from '../stores/inputStore'
import { FELL_LEVEL, levelForStars } from '../missions/levels'
import { setDynamicObstacle, touchingFootprint } from '../vehicles/shared/footprints'
import { bulldozerSensors } from '../vehicles/bulldozer/bulldozerSensors'
import { excavatorSensors } from '../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../vehicles/dumpTruck/dumpTruckSensors'
import { BULLDOZER } from '../vehicles/bulldozer/bulldozerConfig'
import { LOG, logRegistry } from '../cargo/logs/logRegistry'
import { digEffects } from '../effects/DigEffects'
import { audio } from '../audio/AudioManager'

/** ブルドーザーで押し続けると倒れるまでの時間 [s] */
const PUSH_TO_FELL = 0.6
/** 倒れきるまでの時間 [s] */
const FALL_TIME = 1.2
/** 倒れてから木材が出て、木が消えるまで [s] */
const LOGS_AFTER = 1.4
/** 倒してから、また生えるまで [s] */
const REGROW_AFTER = 20
/** 生えて大きくなるまで [s] */
const GROW_TIME = 2.5
/** 1 本の木から出る木材の数 */
const LOGS_PER_TREE = 3

const KINDS: readonly TreeKind[] = ['pine', 'snowPine', 'round']
const qFall = new THREE.Quaternion()
const qYaw = new THREE.Quaternion()
const axis = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const m = new THREE.Matrix4()
const pos = new THREE.Vector3()
const scl = new THREE.Vector3()
const axes = zeroAxes()

/**
 * 木材を出す場所：車両（倒したあとも前へ進んでいるブルドーザーなど）に重なるなら、横のあいた所へずらす。
 * 車両の中・上に出ると、排土板と車体の間にはさまって取れなくなる（ユーザー指摘）
 */
function clearLogSpot(x: number, z: number, dx: number, dz: number) {
  const reach = LOG.length / 2 + 0.4
  if (!touchingFootprint(x, z, reach)) return { x, z }
  // 倒れた向きに直角な横へ、少しずつ離していく
  for (const side of [3, -3, 4.5, -4.5, 6, -6, 8, -8]) {
    const sx = x + dz * side
    const sz = z - dx * side
    if (!touchingFootprint(sx, sz, reach)) return { x: sx, z: sz }
  }
  return { x: x + dx * 8, z: z + dz * 8 }
}

/** 木の見た目の行列（根元を中心に、倒れる向きへ傾ける） */
function treeMatrix(tree: ForestTree, time: number) {
  let tilt = 0
  let size = tree.scale
  if (tree.state === 'falling') tilt = Math.min(1, (tree.t / FALL_TIME) ** 2) * (Math.PI / 2 - 0.08)
  if (tree.state === 'gone') size = 0
  if (tree.state === 'growing') size = tree.scale * Math.min(1, tree.t / GROW_TIME)
  // 押されている間は小さくゆれる
  const wobble = tree.state === 'standing' && tree.push > 0 ? Math.sin(time * 40) * 0.04 * (tree.push / PUSH_TO_FELL + 0.3) : 0
  const d = tree.fallYaw
  axis.set(Math.cos(d), 0, -Math.sin(d)) // 上 × 倒れる向き：この軸で回すと、てっぺんが倒れる向きへ
  qFall.setFromAxisAngle(axis, tilt + wobble)
  qYaw.setFromAxisAngle(UP, tree.rotation)
  pos.set(tree.x, heightAt(tree.x, tree.z) - 0.25, tree.z)
  scl.setScalar(Math.max(size, 0.0001))
  return m.compose(pos, qFall.multiply(qYaw), scl)
}

/**
 * 倒せる木（外がわの地帯）。Lv5 から、ブルドーザーで押し続けると倒れて、木材が 3 本出る。
 * 倒した木は 20 秒たつと、同じ地帯の木の少ない場所にまた生える（ユーザー提案）。
 */
export function TreeField() {
  const byKind = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, forest.trees.filter((t) => t.kind === k)])) as Record<TreeKind, ForestTree[]>, [])
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const foliageRefs = useRef<Record<string, THREE.InstancedMesh | null>>({})
  const trunkTrees = useMemo(() => KINDS.flatMap((k) => byKind[k]), [byKind])
  const dirty = useRef(true)

  // 立っている木は、車両がぶつかって止まる
  const setObstacle = (t: ForestTree) => setDynamicObstacle(`tree-${t.id}`, t.state === 'standing' ? { x: t.x, z: t.z, r: t.r } : null)
  useEffect(() => {
    forest.trees.forEach(setObstacle)
    return () => forest.trees.forEach((t) => setDynamicObstacle(`tree-${t.id}`, null))
  }, [])

  const write = (time: number) => {
    trunkTrees.forEach((t, i) => trunkRef.current?.setMatrixAt(i, treeMatrix(t, time)))
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true
    for (const k of KINDS) {
      FOLIAGE[k].forEach((_, fi) => {
        const mesh = foliageRefs.current[`${k}-${fi}`]
        if (!mesh) return
        byKind[k].forEach((t, i) => mesh.setMatrixAt(i, treeMatrix(t, time)))
        mesh.instanceMatrix.needsUpdate = true
      })
    }
  }
  useLayoutEffect(() => write(0))

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const time = clock.elapsedTime
    let changed = false

    // --- ブルドーザーで押す（Lv5 から） ---
    const canFell =
      useGameStore.getState().activeVehicle === 'bulldozer' && levelForStars(useProgressStore.getState().stars).level >= FELL_LEVEL
    readAxes(axes)
    const pushing = canFell && axes.driveY > 0.2
    const bladeZ = BULLDOZER.footprint[2][0]
    const bladeR = BULLDOZER.footprint[2][1]
    const bx = bulldozerSensors.x + Math.sin(bulldozerSensors.heading) * bladeZ
    const bz = bulldozerSensors.z + Math.cos(bulldozerSensors.heading) * bladeZ

    for (const t of forest.trees) {
      if (t.state === 'standing') {
        const touching = pushing && Math.abs(t.x - bx) < 6 && Math.abs(t.z - bz) < 6 && Math.hypot(t.x - bx, t.z - bz) < t.r + bladeR + 0.35
        if (touching) {
          t.push += dt
          changed = true
          if (t.push >= PUSH_TO_FELL) {
            // 倒れる：ブルドーザーの向きへ
            t.state = 'falling'
            t.t = 0
            t.fallYaw = bulldozerSensors.heading
            t.push = 0
            setObstacle(t)
            audio.play('crack')
          }
        } else if (t.push > 0) {
          t.push = Math.max(0, t.push - dt * 2)
          changed = true
        }
        continue
      }
      t.t += dt
      changed = true
      if (t.state === 'falling' && t.t >= LOGS_AFTER) {
        // 倒れた幹のところに木材を並べて出す
        const dx = Math.sin(t.fallYaw)
        const dz = Math.cos(t.fallYaw)
        for (let k = 0; k < LOGS_PER_TREE; k++) {
          const along = (1.4 + k * 1.8) * t.scale
          const spot = clearLogSpot(t.x + dx * along, t.z + dz * along, dx, dz)
          logRegistry.spawn?.(spot.x, heightAt(spot.x, spot.z) + 0.5 + k * 0.1, spot.z, t.fallYaw + Math.PI / 2)
          digEffects.dust(spot.x, heightAt(spot.x, spot.z) + 0.5, spot.z)
        }
        audio.play('rockDrop')
        t.state = 'gone'
        t.t = 0
      } else if (t.state === 'gone' && t.t >= REGROW_AFTER) {
        const spot = findRegrowSpot(t, [excavatorSensors, dumpTruckSensors, bulldozerSensors])
        if (spot) {
          t.x = spot.x
          t.z = spot.z
          t.rotation = Math.random() * Math.PI * 2
          t.state = 'growing'
          t.t = 0
          useForestStore.getState().bump()
        } else {
          t.t = REGROW_AFTER - 5 // しばらくしてからまたさがす
        }
      } else if (t.state === 'growing' && t.t >= GROW_TIME) {
        t.state = 'standing'
        t.t = 0
        setObstacle(t)
      }
    }
    if (forestDirty.value) {
      forestDirty.value = false
      forest.trees.forEach(setObstacle)
      changed = true
    }
    if (changed || dirty.current) {
      dirty.current = false
      write(time)
    }
  })

  return (
    <>
      {/* 木は倒れたり別の場所に生えたりするので、見える範囲の計算で省かない（最初の範囲のままだと消えて見える） */}
      <instancedMesh ref={trunkRef} args={[trunkGeometry, trunkMaterial, trunkTrees.length]} frustumCulled={false} />
      {KINDS.flatMap((k) =>
        byKind[k].length === 0
          ? []
          : FOLIAGE[k].map((f, fi) => (
              <instancedMesh
                key={`${k}-${fi}`}
                ref={(mesh) => void (foliageRefs.current[`${k}-${fi}`] = mesh)}
                args={[f.geometry, f.material, byKind[k].length]}
                castShadow
                frustumCulled={false}
              />
            )),
      )}
    </>
  )
}
