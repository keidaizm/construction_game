import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { OFFICE, TOWER_STAGES } from './cityLayout'

const Z = new THREE.Vector3(0, 0, 1)
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const one = new THREE.Vector3(1, 1, 1)

/** 2 点をつなぐ角材（太さ t） */
function beam(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  q.setFromUnitVectors(Z, dir.normalize())
  return new THREE.BoxGeometry(t, t, len).applyMatrix4(m4.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, one))
}

const SIGNS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
]

/**
 * 四角すいの台の形の、鉄骨の骨組み（下の半幅 h0 → 上の半幅 h1）。
 * 4 本の柱と、だいたい 4m ごとの横の輪と、面ごとの X のすじかい。1 つの形にまとめる（描く回数を増やさない）
 */
export function latticeGeometry(y0: number, y1: number, h0: number, h1: number, t = 0.24) {
  const parts: THREE.BufferGeometry[] = []
  const levels = Math.max(1, Math.round((y1 - y0) / 4))
  const corner = (k: number, f: number) => {
    const h = h0 + (h1 - h0) * f
    return new THREE.Vector3(SIGNS[k][0] * h, y0 + (y1 - y0) * f, SIGNS[k][1] * h)
  }
  for (let k = 0; k < 4; k++) parts.push(beam(corner(k, 0), corner(k, 1), t * 1.5))
  for (let l = 0; l < levels; l++) {
    const f0 = l / levels
    const f1 = (l + 1) / levels
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4
      parts.push(beam(corner(k, f1), corner(n, f1), t))
      parts.push(beam(corner(k, f0), corner(n, f1), t * 0.7))
      parts.push(beam(corner(n, f0), corner(k, f1), t * 0.7))
    }
  }
  return mergeGeometries(parts)!
}

/** タワーの段ごとの形（骨組みは latticeGeometry、展望台は箱。いちばん上には細いアンテナ） */
export function towerStageGeometry(i: number) {
  const s = TOWER_STAGES[i]
  if (s.kind === 'deck') return new THREE.BoxGeometry(s.half0 * 2, s.y1 - s.y0, s.half0 * 2).translate(0, (s.y0 + s.y1) / 2, 0)
  const g = latticeGeometry(s.y0, s.y1, s.half0, s.half1, i === 0 ? 0.32 : 0.24)
  if (i !== TOWER_STAGES.length - 1) return g
  const antenna = new THREE.CylinderGeometry(0.08, 0.12, 4, 6).translate(0, s.y1 + 2, 0)
  return mergeGeometries([g, antenna])!
}

/** 展望台の窓の帯（箱より少し大きく、高さは 6 割） */
export function towerDeckGlassGeometry(i: number) {
  const s = TOWER_STAGES[i]
  return new THREE.BoxGeometry(s.half0 * 2 + 0.1, (s.y1 - s.y0) * 0.6, s.half0 * 2 + 0.1).translate(0, (s.y0 + s.y1) / 2, 0)
}

/**
 * ビルの壁の模様：ガラスの窓がならぶ 1 階ぶん。map（窓は青いガラス、柱は白っぽい）と、
 * 夜に窓だけ光らせる emissiveMap（窓が白、ほかは黒）
 */
export function officeTextures() {
  const make = (night: boolean) => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = night ? '#000000' : '#e8e6e0'
    ctx.fillRect(0, 0, 128, 64)
    for (let i = 0; i < 4; i++) {
      const x = 6 + i * 31
      ctx.fillStyle = night ? (i === 2 ? '#7a6a40' : '#ffffff') : '#5f8db3'
      ctx.fillRect(x, 10, 24, 40)
      if (!night) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(x + 3, 13, 5, 30)
      }
    }
    // 階の区切りの帯
    if (!night) {
      ctx.fillStyle = '#c9c6bd'
      ctx.fillRect(0, 56, 128, 8)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(2, 1)
    return t
  }
  return { map: make(false), emissiveMap: make(true) }
}

/** ビル 1 階ぶんの箱 */
export const officeFloorGeometry = new THREE.BoxGeometry(OFFICE.width, OFFICE.floorHeight, OFFICE.depth)
/** 建てている途中の階の骨組み（鉄骨） */
export const officeFrameGeometry = latticeGeometry(0, OFFICE.floorHeight, OFFICE.width / 2, OFFICE.width / 2, 0.2)
