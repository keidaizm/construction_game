import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { seededRandom } from '../../world/textures'
import { ROCK_KINDS, type RockKind } from './rockTypes'

const VARIANTS = 5
const cache = new Map<RockKind, THREE.BufferGeometry[]>()

/** 球をランダムにゆがめて、ゴツゴツした岩の形を作る */
function createRockGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const rand = seededRandom(seed)
  const g = mergeVertices(new THREE.IcosahedronGeometry(radius, 1))
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    v.multiplyScalar(0.78 + rand() * 0.32)
    v.y *= 0.8 // 少し平たく（転がり続けにくい）
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/** 種類ごとに数パターンの形を作り、使い回す（メモリとドローの準備を節約） */
export function getRockGeometry(kind: RockKind, variant: number): THREE.BufferGeometry {
  let list = cache.get(kind)
  if (!list) {
    list = Array.from({ length: VARIANTS }, (_, i) => createRockGeometry(ROCK_KINDS[kind].radius, 100 + i * 17))
    cache.set(kind, list)
  }
  return list[variant % VARIANTS]
}
