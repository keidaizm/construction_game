import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import type { RigListener } from '../shared/rig'
import type { BulldozerRigRefs } from './useBulldozerController'
import { BULLDOZER } from './bulldozerConfig'

const { bladeWidth: W, bladeHeight: H } = BULLDOZER.geometry

const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const scl = new THREE.Vector3()

function sync(body: RapierRigidBody | null, obj: THREE.Object3D | null) {
  if (!body || !obj) return
  obj.matrixWorld.decompose(pos, quat, scl)
  body.setNextKinematicTranslation(pos)
  body.setNextKinematicRotation(quat)
}

/**
 * ブルドーザーの当たり判定（車体・排土板）。見た目に毎フレーム追従する kinematic ボディ。
 * 排土板で石を押して運べる。土ブロック（固定の当たり判定）とは押し合わない。
 */
export function BulldozerColliders({ rig, listeners }: { rig: BulldozerRigRefs; listeners: RefObject<RigListener[]> }) {
  const body = useRef<RapierRigidBody>(null)
  const blade = useRef<RapierRigidBody>(null)

  useEffect(() => {
    const listener: RigListener = {
      update() {
        sync(body.current, rig.root.current)
        sync(blade.current, rig.blade.current)
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [rig, listeners])

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false}>
        {/* 履帯と腕（直線部＋前後の丸み） */}
        <CuboidCollider args={[1.38, 0.4, 1.68]} position={[0, 0.4, 0]} />
        <CuboidCollider args={[0.66, 0.45, 0.82]} position={[0, 1.2, 0.75]} />
        <CuboidCollider args={[0.95, 0.85, 0.72]} position={[0, 1.6, -0.75]} />
      </RigidBody>

      <RigidBody ref={blade} type="kinematicPosition" colliders={false}>
        {/* 板。下の方は履帯の前まで厚くして、石が板と履帯のすき間に入り込んだり、すり抜けたりしないように */}
        <CuboidCollider args={[W / 2, H / 2, 0.09]} position={[0, H / 2, 0]} friction={0.4} />
        <CuboidCollider args={[W / 2 - 0.1, H * 0.3, 0.42]} position={[0, H * 0.3, -0.35]} friction={0.4} />
        {/* 両はしの板 */}
        <CuboidCollider args={[0.05, H / 2, 0.2]} position={[W / 2, H / 2, 0.1]} friction={0.4} />
        <CuboidCollider args={[0.05, H / 2, 0.2]} position={[-W / 2, H / 2, 0.1]} friction={0.4} />
      </RigidBody>
    </>
  )
}
