/** ミッションの設定。目標の数の範囲はレベルごと（levels.ts）。 */

/**
 * おきば（岩を運ぶ場所）。ダンプの初期位置からまっすぐ前。
 * - radius：地面に描く円の半径。岩の中心がこの円の中にあれば数える（見た目と数え方を一致させる）
 *   荷台の後ろに落ちた岩も入るよう、大きめにしてある
 */
export const DELIVERY_ZONE = {
  x: 4.6,
  z: 31,
  radius: 6.5,
}

/** 岩の中心がおきばの緑の円の中にあるか（見た目どおりに数える） */
export function insideZone(p: { x: number; y: number; z: number }) {
  return p.y < 1.2 && Math.hypot(p.x - DELIVERY_ZONE.x, p.z - DELIVERY_ZONE.z) <= DELIVERY_ZONE.radius
}
