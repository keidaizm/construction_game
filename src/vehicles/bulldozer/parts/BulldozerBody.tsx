import { blackRubber, chrome, darkSteel, glass, lamp, paintYellow } from '../../shared/materials'

/**
 * ブルドーザーの車体（エンジンフード・運転席・屋根）の見た目。
 * 原点は地面・履帯のまん中。+Z が前（排土板の側）。
 */
export function BulldozerBody() {
  return (
    <group>
      {/* 履帯の間のフレーム */}
      <mesh position={[0, 0.55, -0.1]} material={darkSteel}>
        <boxGeometry args={[1.4, 0.45, 2.9]} />
      </mesh>
      {/* エンジンフード（前） */}
      <mesh position={[0, 1.2, 0.75]} material={paintYellow}>
        <boxGeometry args={[1.3, 0.85, 1.6]} />
      </mesh>
      {/* フードの上のすき間（ラジエーターのグリル） */}
      <mesh position={[0, 1.15, 1.56]} material={darkSteel}>
        <boxGeometry args={[1.0, 0.6, 0.04]} />
      </mesh>
      {/* 排気管 */}
      <mesh position={[0.4, 1.95, 0.9]} material={darkSteel}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
      </mesh>
      {/* 運転席（後ろ） */}
      <group position={[0, 0.78, -0.75]}>
        <mesh position-y={0.25} material={paintYellow}>
          <boxGeometry args={[1.9, 0.5, 1.4]} />
        </mesh>
        <mesh position={[0, 0.65, 0]} material={blackRubber}>
          <boxGeometry args={[0.55, 0.5, 0.5]} />
        </mesh>
        {/* 窓（前・左右） */}
        <mesh position={[0, 1.15, 0.6]} material={glass}>
          <boxGeometry args={[1.2, 0.9, 0.02]} />
        </mesh>
        {[0.62, -0.62].map((x) => (
          <mesh key={x} position={[x, 1.15, 0]} material={glass}>
            <boxGeometry args={[0.02, 0.9, 1.1]} />
          </mesh>
        ))}
        {/* 屋根と柱（ROPS） */}
        {[
          [0.62, 0.6],
          [-0.62, 0.6],
          [0.62, -0.6],
          [-0.62, -0.6],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 1.15, z]} material={darkSteel}>
            <boxGeometry args={[0.08, 0.9, 0.08]} />
          </mesh>
        ))}
        <mesh position={[0, 1.65, 0]} material={paintYellow}>
          <boxGeometry args={[1.45, 0.1, 1.45]} />
        </mesh>
        <mesh position={[0.45, 1.72, 0.55]} material={lamp}>
          <boxGeometry args={[0.18, 0.1, 0.08]} />
        </mesh>
      </group>
      {/* 後ろのリッパー（つめ） */}
      <mesh position={[0, 0.55, -1.75]} material={darkSteel}>
        <boxGeometry args={[1.2, 0.2, 0.3]} />
      </mesh>
      <mesh position={[0, 0.3, -1.95]} rotation-x={0.3} material={chrome}>
        <boxGeometry args={[0.12, 0.6, 0.12]} />
      </mesh>
    </group>
  )
}
