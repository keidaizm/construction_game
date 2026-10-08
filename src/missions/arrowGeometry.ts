import * as THREE from 'three'

/**
 * 平たい矢印の形（上から見た形。+Z が矢印の向き、長さ約 2.4m）。
 * おきばへの緑の矢印と、色ごとのコンパスの矢印で共有する。
 */
export function createArrowGeometry() {
  const s = new THREE.Shape()
  // Shape は XY 平面に描き、あとで寝かせる（先端を +Y に描いて、+Z を向くように回転）
  s.moveTo(0, 1.3)
  s.lineTo(1.0, 0.1)
  s.lineTo(0.38, 0.1)
  s.lineTo(0.38, -1.1)
  s.lineTo(-0.38, -1.1)
  s.lineTo(-0.38, 0.1)
  s.lineTo(-1.0, 0.1)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false })
  g.rotateX(Math.PI / 2) // 先端 +Y → +Z（寝かせる）
  return g
}
