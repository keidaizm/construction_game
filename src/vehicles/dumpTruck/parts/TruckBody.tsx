import { blackRubber, cabWhite, chrome, darkSteel, glass, lamp } from '../../shared/materials'

/**
 * ダンプカーの車体（フレーム・キャブ）の見た目。
 * キャブオーバー型（運転席が前輪の上にある、日本でよく見る形）。
 */
export function TruckBody() {
  return (
    <group>
      {/* フレーム */}
      {[0.45, -0.45].map((x) => (
        <mesh key={x} position={[x, 0.85, -0.2]} material={darkSteel}>
          <boxGeometry args={[0.18, 0.3, 6.4]} />
        </mesh>
      ))}
      {/* 燃料タンク・工具箱 */}
      <mesh position={[0.85, 0.75, 0.9]} rotation-x={Math.PI / 2} material={chrome}>
        <cylinderGeometry args={[0.28, 0.28, 0.9, 12]} />
      </mesh>
      <mesh position={[-0.85, 0.75, 0.9]} material={darkSteel}>
        <boxGeometry args={[0.5, 0.5, 0.9]} />
      </mesh>

      {/* キャブ */}
      <group position={[0, 0.9, 2.8]}>
        <mesh position={[0, 0.95, 0]} material={cabWhite}>
          <boxGeometry args={[2.3, 1.9, 1.6]} />
        </mesh>
        {/* フロントガラス・横窓 */}
        <mesh position={[0, 1.35, 0.81]} material={glass}>
          <boxGeometry args={[2.1, 0.8, 0.02]} />
        </mesh>
        {[1.16, -1.16].map((x) => (
          <mesh key={x} position={[x, 1.35, 0.25]} material={glass}>
            <boxGeometry args={[0.02, 0.7, 0.9]} />
          </mesh>
        ))}
        {/* ストライプ */}
        <mesh position={[0, 0.55, 0.81]} material={darkSteel}>
          <boxGeometry args={[2.32, 0.12, 0.02]} />
        </mesh>
        {/* バンパー・ライト */}
        <mesh position={[0, -0.2, 0.85]} material={darkSteel}>
          <boxGeometry args={[2.4, 0.3, 0.15]} />
        </mesh>
        {[0.85, -0.85].map((x) => (
          <mesh key={x} position={[x, 0.2, 0.82]} material={lamp}>
            <boxGeometry args={[0.35, 0.16, 0.04]} />
          </mesh>
        ))}
        {/* 屋根の上のランプ */}
        <mesh position={[0, 1.95, 0.3]} material={lamp}>
          <boxGeometry args={[0.8, 0.1, 0.15]} />
        </mesh>
      </group>

      {/* 泥よけ（後輪の上） */}
      {[1.0, -1.0].map((x) => (
        <mesh key={x} position={[x, 1.12, -2.0]} material={blackRubber}>
          <boxGeometry args={[0.6, 0.06, 2.4]} />
        </mesh>
      ))}
    </group>
  )
}
