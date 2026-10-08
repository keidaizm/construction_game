import { blackRubber, darkSteel, glass, lamp, paintYellow } from '../../shared/materials'

const RAIL = 0.05

/** 手すり（細い棒）。from〜to のまっすぐな棒 */
function Rail({ from, to }: { from: readonly [number, number, number]; to: readonly [number, number, number] }) {
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2] as const
  const size = [Math.max(Math.abs(to[0] - from[0]), RAIL), Math.max(Math.abs(to[1] - from[1]), RAIL), Math.max(Math.abs(to[2] - from[2]), RAIL)] as const
  return (
    <mesh position={mid} material={darkSteel}>
      <boxGeometry args={[...size]} />
    </mesh>
  )
}

/**
 * 重ダンプ（オフロードダンプ）の車体：前のエンジン・ラジエーター、上のデッキ、左に寄った運転席、手すりとはしご。
 * 原点は地面・前後輪の間あたり。+Z が前、+X が左。
 */
export function BigTruckBody() {
  return (
    <group>
      {/* フレーム */}
      {[0.55, -0.55].map((x) => (
        <mesh key={x} position={[x, 1.15, -0.2]} material={darkSteel}>
          <boxGeometry args={[0.3, 0.5, 6.6]} />
        </mesh>
      ))}
      {/* エンジンルームとラジエーター（前） */}
      <mesh position={[0, 1.75, 2.75]} material={paintYellow} castShadow>
        <boxGeometry args={[2.2, 1.2, 1.9]} />
      </mesh>
      <mesh position={[0, 1.75, 3.71]} material={darkSteel}>
        <boxGeometry args={[1.6, 0.95, 0.04]} />
      </mesh>
      {[-0.32, 0, 0.32].map((y) => (
        <mesh key={y} position={[0, 1.75 + y, 3.74]} material={paintYellow}>
          <boxGeometry args={[1.5, 0.06, 0.03]} />
        </mesh>
      ))}
      {/* 前のバンパーとライト */}
      <mesh position={[0, 0.95, 3.75]} material={darkSteel}>
        <boxGeometry args={[3.0, 0.35, 0.3]} />
      </mesh>
      {[1.25, -1.25].map((x) => (
        <mesh key={x} position={[x, 2.15, 3.72]} material={lamp}>
          <boxGeometry args={[0.3, 0.2, 0.05]} />
        </mesh>
      ))}
      {/* 前輪の上の泥よけ */}
      {[1.2, -1.2].map((x) => (
        <mesh key={x} position={[x, 1.72, 2.5]} material={paintYellow} castShadow>
          <boxGeometry args={[0.75, 0.1, 2.0]} />
        </mesh>
      ))}
      {/* デッキ（運転席の床）：車体の幅いっぱい */}
      <mesh position={[0, 2.38, 2.75]} material={paintYellow}>
        <boxGeometry args={[3.1, 0.1, 2.0]} />
      </mesh>
      {/* 運転席（左に寄せる） */}
      <group position={[0.85, 2.43, 2.65]}>
        <mesh position-y={0.68} material={paintYellow} castShadow>
          <boxGeometry args={[1.25, 1.35, 1.5]} />
        </mesh>
        <mesh position={[0, 0.85, 0.76]} material={glass}>
          <boxGeometry args={[1.05, 0.75, 0.02]} />
        </mesh>
        <mesh position={[0.63, 0.85, 0.05]} material={glass}>
          <boxGeometry args={[0.02, 0.7, 1.15]} />
        </mesh>
        <mesh position={[-0.63, 0.85, 0.05]} material={glass}>
          <boxGeometry args={[0.02, 0.7, 1.15]} />
        </mesh>
        <mesh position={[0, 1.38, 0.3]} material={lamp}>
          <boxGeometry args={[0.5, 0.08, 0.12]} />
        </mesh>
      </group>
      {/* 右前の排気・エアクリーナー */}
      <mesh position={[-0.9, 2.75, 2.2]} material={darkSteel}>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 10]} />
      </mesh>
      {/* デッキのまわりの手すり */}
      <Rail from={[1.55, 2.95, 1.8]} to={[1.55, 2.95, 3.7]} />
      <Rail from={[-1.55, 2.95, 1.8]} to={[-1.55, 2.95, 3.7]} />
      <Rail from={[-1.55, 2.95, 3.7]} to={[0.2, 2.95, 3.7]} />
      {[1.8, 2.75, 3.7].flatMap((z) => [
        <Rail key={`l${z}`} from={[1.55, 2.43, z]} to={[1.55, 2.95, z]} />,
        <Rail key={`r${z}`} from={[-1.55, 2.43, z]} to={[-1.55, 2.95, z]} />,
      ])}
      {/* 左前のはしご（ななめ） */}
      <group position={[1.45, 1.4, 3.85]} rotation-x={-0.35}>
        {[0.3, -0.3].map((x) => (
          <mesh key={x} position={[x, 0, 0]} material={darkSteel}>
            <boxGeometry args={[0.05, 2.2, 0.05]} />
          </mesh>
        ))}
        {[-0.8, -0.35, 0.1, 0.55].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={darkSteel}>
            <boxGeometry args={[0.6, 0.05, 0.12]} />
          </mesh>
        ))}
      </group>
      {/* 後輪の上の泥よけ */}
      {[1.25, -1.25].map((x) => (
        <mesh key={x} position={[x, 1.72, -2.15]} material={blackRubber}>
          <boxGeometry args={[1.0, 0.08, 1.9]} />
        </mesh>
      ))}
    </group>
  )
}
