import { Suspense, useMemo, type ReactNode } from 'react'
import { CuboidCollider, Physics, RigidBody, TrimeshCollider } from '@react-three/rapier'
import { createHillTrimesh } from '../world/groundGeometry'

/**
 * 物理演算のワールド（Rapier）。
 * - timeStep="vary"：描画 1 フレームにつき 1 回進める。バケットに追従する岩が
 *   補間のズレで震えて見えないようにするため
 * - 地面は平らな固定の当たり判定。丘の所だけ、見た目の地面と同じ形の三角形の当たり判定を重ねる
 * Rapier の WASM 読み込み中は何も表示しない（一瞬だけ）。
 */
/**
 * 三角形の当たり判定の設定：外向き（上向き）の面がそろっている＝中は固い、として扱う（ORIENTED）＋継ぎ目で引っかからない。
 * これがないと厚みのない面になり、バケットで押し込んだ石が面をすり抜けて丘の中に入ってしまった（ユーザー指摘）
 */
const TRIMESH_FLAGS = 8 /* ORIENTED */ | 144 /* FIX_INTERNAL_EDGES */

/** 丘の当たり判定（石が丘を転がる） */
function HillColliders() {
  const { vertices, indices } = useMemo(() => createHillTrimesh(), [])
  if (indices.length === 0) return null
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* @react-three/rapier の型は 2 つだけだが、3 つ目（flags）も Rapier にそのまま渡る */}
      <TrimeshCollider args={[vertices, indices, TRIMESH_FLAGS] as unknown as [Float32Array, Uint32Array]} friction={1} />
    </RigidBody>
  )
}

export function PhysicsWorld({ children, debug = false }: { children: ReactNode; debug?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Physics gravity={[0, -9.81, 0]} timeStep="vary" debug={debug}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[260, 0.5, 260]} position={[0, -0.5, 0]} friction={1} />
        </RigidBody>
        <HillColliders />
        {children}
      </Physics>
    </Suspense>
  )
}
