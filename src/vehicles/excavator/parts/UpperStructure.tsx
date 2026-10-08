import { blackRubber, chrome, counterweight, darkSteel, glass, lamp, paintYellow } from '../../shared/materials'

/**
 * 上部旋回体の見た目（キャブ・エンジンフード・カウンターウェイト）。
 * 原点は旋回中心の上面。+Z が前、+X が左（キャブは左前）。
 */
export function UpperStructure() {
  return (
    <group>
      {/* デッキ */}
      <mesh position={[0, 0.14, -0.25]} material={darkSteel}>
        <boxGeometry args={[2.45, 0.28, 3.5]} />
      </mesh>
      {/* エンジンフード */}
      <mesh position={[0, 0.7, -1.15]} material={paintYellow}>
        <boxGeometry args={[2.4, 0.85, 1.5]} />
      </mesh>
      {/* カウンターウェイト */}
      <mesh position={[0, 0.6, -2.05]} material={counterweight}>
        <boxGeometry args={[2.5, 0.95, 0.5]} />
      </mesh>
      {/* 右前の工具箱・タンク */}
      <mesh position={[-0.72, 0.62, 0.55]} material={paintYellow}>
        <boxGeometry args={[0.95, 0.7, 1.4]} />
      </mesh>
      {/* 排気管 */}
      <mesh position={[-0.7, 1.35, -1.1]} material={darkSteel}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
      </mesh>
      {/* 手すり */}
      <mesh position={[-1.12, 1.25, -1.15]} material={chrome}>
        <boxGeometry args={[0.04, 0.04, 1.3]} />
      </mesh>

      {/* キャブ */}
      <group position={[0.7, 0.28, 0.45]}>
        <mesh position={[0, 0.8, -0.1]} material={paintYellow}>
          <boxGeometry args={[0.95, 1.6, 1.3]} />
        </mesh>
        {/* 窓（前・左・右・後ろ） */}
        <mesh position={[0, 0.95, 0.56]} material={glass}>
          <boxGeometry args={[0.85, 1.15, 0.02]} />
        </mesh>
        <mesh position={[0.48, 0.95, -0.05]} material={glass}>
          <boxGeometry args={[0.02, 1.15, 1.1]} />
        </mesh>
        <mesh position={[-0.48, 1.05, 0.1]} material={glass}>
          <boxGeometry args={[0.02, 0.9, 0.8]} />
        </mesh>
        {/* 屋根 */}
        <mesh position={[0, 1.63, -0.1]} material={darkSteel}>
          <boxGeometry args={[1.0, 0.07, 1.4]} />
        </mesh>
        {/* 作業灯 */}
        <mesh position={[-0.3, 1.63, 0.62]} material={lamp}>
          <boxGeometry args={[0.16, 0.1, 0.06]} />
        </mesh>
        {/* 座席（窓越しに見える） */}
        <mesh position={[0, 0.55, -0.15]} material={blackRubber}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </mesh>
      </group>

      {/* ブームの根元ブラケット */}
      {[0.12, -0.42].map((x) => (
        <mesh key={x} position={[x, 0.55, 0.95]} material={darkSteel}>
          <boxGeometry args={[0.1, 0.55, 0.55]} />
        </mesh>
      ))}
    </group>
  )
}
