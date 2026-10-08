import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import type { RigListener } from '../shared/rig'
import { DUMP_TRUCK, type TruckGeometry } from './dumpTruckConfig'
import { dumpTruckSensors } from './dumpTruckSensors'

const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const scl = new THREE.Vector3()
/** あおりを開けている間、当たり判定を置いておく場所（地面のはるか下） */
const PARKED = { x: 0, y: -100, z: 0 }

function sync(body: RapierRigidBody | null, obj: THREE.Object3D | null) {
  if (!body || !obj) return
  obj.matrixWorld.decompose(pos, quat, scl)
  body.setNextKinematicTranslation(pos)
  body.setNextKinematicRotation(quat)
}

/**
 * ダンプカーの当たり判定（車体・荷台・後ろのあおり）。見た目に毎フレーム追従する kinematic ボディ。
 * - 荷台の床は滑りやすくして、荷台を上げたときに岩が滑り落ちるようにする
 * - 後ろのあおりは別のボディにし、荷台を上げたら地面の下へ退避させて出口を開ける
 *   （Collider の有効／無効の切り替えは kinematic ボディで効かないことがあったため）
 */
export function DumpTruckColliders({
  root,
  bed,
  tailgate,
  listeners,
  geometry: G,
}: {
  root: RefObject<THREE.Group | null>
  bed: RefObject<THREE.Group | null>
  tailgate: RefObject<THREE.Group | null>
  listeners: RefObject<RigListener[]>
  /** いまのダンプの大きさ（変わったら当たり判定を作りなおす） */
  geometry: TruckGeometry
}) {
  const { bedLength: L, bedWidth: W, bedFloorThickness: F, bedWallHeight: H, bedWallThickness: T } = G
  const body = useRef<RapierRigidBody>(null)
  const bedBody = useRef<RapierRigidBody>(null)
  const gateBody = useRef<RapierRigidBody>(null)

  useEffect(() => {
    let gateOpen = false
    const listener: RigListener = {
      update() {
        sync(body.current, root.current)
        sync(bedBody.current, bed.current)

        const gate = gateBody.current
        const obj = tailgate.current
        if (!gate || !obj) return
        const open = dumpTruckSensors.bedAngle > DUMP_TRUCK.cargo.tailgateOpenAngle
        if (open) {
          // 瞬間移動（setTranslation）で退避。速度が付かないので岩をはじき飛ばさない
          if (!gateOpen) gate.setTranslation(PARKED, true)
        } else {
          obj.matrixWorld.decompose(pos, quat, scl)
          if (gateOpen) {
            gate.setTranslation(pos, true)
            gate.setRotation(quat, true)
          } else {
            gate.setNextKinematicTranslation(pos)
            gate.setNextKinematicRotation(quat)
          }
        }
        gateOpen = open
      },
    }
    const list = listeners.current
    list.push(listener)
    return () => {
      list.splice(list.indexOf(listener), 1)
    }
  }, [root, bed, tailgate, listeners])

  return (
    <>
      <RigidBody key={`body-${G.kind}`} ref={body} type="kinematicPosition" colliders={false}>
        {/* フレーム（後端はヒンジより前で終わらせ、滑り落ちた岩が引っかからないように）と、前のキャブ・エンジン */}
        <CuboidCollider args={[...G.frameBox[0]]} position={[...G.frameBox[1]]} />
        <CuboidCollider args={[...G.frontBox[0]]} position={[...G.frontBox[1]]} />
      </RigidBody>

      <RigidBody key={`bed-${G.kind}`} ref={bedBody} type="kinematicPosition" colliders={false}>
        {/* 床（滑りやすい） */}
        <CuboidCollider args={[W / 2, F / 2, L / 2]} position={[0, F / 2, L / 2]} friction={0.05} />
        {/* 左右・前のあおり */}
        <CuboidCollider args={[T / 2, H / 2, L / 2]} position={[W / 2 - T / 2, F + H / 2, L / 2]} friction={0.3} />
        <CuboidCollider args={[T / 2, H / 2, L / 2]} position={[-(W / 2 - T / 2), F + H / 2, L / 2]} friction={0.3} />
        <CuboidCollider args={[W / 2, 0.45, T / 2]} position={[0, F + 0.45, L - T / 2]} friction={0.3} />
      </RigidBody>

      {/* 後ろのあおり（見た目の Tailgate Group と同じ座標系。上端がヒンジ） */}
      <RigidBody key={`gate-${G.kind}`} ref={gateBody} type="kinematicPosition" colliders={false}>
        <CuboidCollider args={[W / 2, H / 2, T / 2]} position={[0, -H / 2, T / 2]} friction={0.3} />
      </RigidBody>
    </>
  )
}
