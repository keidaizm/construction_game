import * as THREE from 'three'
import { FIELD } from './fieldLayout'
import { groundColorAt } from './biomes'
import { heightAt } from './terrain'
import { GROUND_DETAIL_LEVEL } from './textures'

export const GROUND_SIZE = FIELD.groundSize
/** 地面の分割数（一辺）。4m ごと：地帯の色の境目と丘がなめらかになる細かさ */
const SEGMENTS = 130

/**
 * 地面の形（丘の高さ）と色（地帯の色）。見た目の地面と、丘の当たり判定の両方に使う。
 * 色は灰色の模様テクスチャと掛け合わせるので、模様の明るさで割っておく。
 */
export function createGroundGeometry() {
  const g = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, SEGMENTS, SEGMENTS)
  g.rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, heightAt(x, z))
    groundColorAt(x, z, c)
    colors.set([Math.min(1, c.r / GROUND_DETAIL_LEVEL), Math.min(1, c.g / GROUND_DETAIL_LEVEL), Math.min(1, c.b / GROUND_DETAIL_LEVEL)], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

/** 丘の部分だけの三角形（石の当たり判定用。平らな所は箱の当たり判定にまかせる） */
export function createHillTrimesh() {
  const g = createGroundGeometry()
  const pos = g.getAttribute('position')
  const index = g.getIndex()!
  const vertices = new Float32Array(pos.array as Float32Array)
  const indices: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)
    if (pos.getY(a) > 0.001 || pos.getY(b) > 0.001 || pos.getY(c) > 0.001) indices.push(a, b, c)
  }
  g.dispose()
  return { vertices, indices: new Uint32Array(indices) }
}
