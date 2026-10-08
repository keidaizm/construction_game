import * as THREE from 'three'

/**
 * 車両で共有するマテリアル。
 * マテリアル数を抑えると Android タブレットでも描画が軽くなる。
 */
export const paintYellow = new THREE.MeshStandardMaterial({ color: '#f2b705', roughness: 0.55, metalness: 0.15 })
export const darkSteel = new THREE.MeshStandardMaterial({ color: '#3b3d40', roughness: 0.7, metalness: 0.4 })
export const blackRubber = new THREE.MeshStandardMaterial({ color: '#1e1f21', roughness: 0.9 })
export const counterweight = new THREE.MeshStandardMaterial({ color: '#4a4c50', roughness: 0.6, metalness: 0.3 })
export const glass = new THREE.MeshStandardMaterial({
  color: '#7fb6d9',
  roughness: 0.1,
  metalness: 0.2,
  transparent: true,
  opacity: 0.55,
})
export const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.2, metalness: 0.9 })
export const cabWhite = new THREE.MeshStandardMaterial({ color: '#f1f0ea', roughness: 0.45, metalness: 0.1 })
export const lamp = new THREE.MeshStandardMaterial({ color: '#fff6d0', emissive: '#fff2b0', emissiveIntensity: 0.6 })

/** 操作中の部位を少し光らせ、レバーと 3D の部位を結び付けるための色 */
export const PART_COLORS = {
  swing: '#9b51e0',
  boom: '#ff7a00',
  arm: '#2f80ed',
  bucket: '#1fa855',
  bed: '#e53935',
  blade: '#00a3a3',
  drive: '#555555',
} as const

/** ブーム・アーム・バケットごとの塗装（操作中にハイライトさせるため個別に持つ） */
export function createPartPaint(highlight: string) {
  const m = paintYellow.clone()
  m.emissive = new THREE.Color(highlight)
  m.emissiveIntensity = 0
  return m
}
