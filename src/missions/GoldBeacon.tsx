import { heightAt } from '../world/terrain'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rockRegistry } from '../cargo/rocks/rockRegistry'
import { useGameStore } from '../stores/gameStore'
import { maybePlaceGoldRock } from './goldTreasure'

/**
 * 金色の石（ボーナスの宝物）。
 * - ミッションのはじめ（「はじめから」・次のミッション・起動したとき）に、ときどきどこかに置く
 * - 置いてある間は、遠くからでも見える金色の光の柱を立てる（矢印では教えない＝探検で見つける）
 */
export function GoldBeacon() {
  const beam = useRef<THREE.Group>(null)
  const pendingPlace = useRef(true)
  const resetToken = useGameStore((s) => s.resetToken)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffd84a',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  )

  // リセットのあと（岩が元に戻ってから）置き直す
  useEffect(() => {
    pendingPlace.current = true
  }, [resetToken])

  useFrame(({ clock }) => {
    if (pendingPlace.current && rockRegistry.spawn && rockRegistry.rocks.length > 0) {
      pendingPlace.current = false
      maybePlaceGoldRock()
    }
    const g = beam.current
    if (!g) return
    const gold = rockRegistry.rocks.find((r) => r.color === 'gold' && r.state === 'free')
    g.visible = !!gold
    if (!gold) return
    const p = gold.body.translation()
    g.position.set(p.x, heightAt(p.x, p.z), p.z)
    const t = clock.elapsedTime
    material.opacity = 0.25 + Math.sin(t * 3) * 0.1
    g.rotation.y = t * 0.8
  })

  return (
    <group ref={beam} visible={false}>
      <mesh position-y={18} material={material} renderOrder={3}>
        <cylinderGeometry args={[0.5, 0.9, 36, 12, 1, true]} />
      </mesh>
      <mesh position-y={0.05} rotation-x={-Math.PI / 2} material={material}>
        <ringGeometry args={[1.0, 1.6, 24]} />
      </mesh>
    </group>
  )
}
