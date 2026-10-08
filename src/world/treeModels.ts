import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { TreeKind } from './fieldLayout'

/** 木の形（倒れない木の Environment と、倒せる木の TreeField で共有） */
export const trunkGeometry = new THREE.CylinderGeometry(0.35, 0.45, 2.4, 7).translate(0, 1.2, 0)
export const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 1 })
const leafy = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })

/** 木の葉（種類ごと。原点は木の根元、大きさ 1 倍のとき） */
export const FOLIAGE: Record<TreeKind, Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>> = {
  pine: [{ geometry: new THREE.ConeGeometry(2.2, 5.5, 8).translate(0, 4.6, 0), material: leafy('#4f8a3a') }],
  snowPine: [
    { geometry: new THREE.ConeGeometry(2.2, 5.5, 8).translate(0, 4.6, 0), material: leafy('#3d6b45') },
    // 雪をかぶった先と、裾の雪
    {
      geometry: mergeGeometries([new THREE.ConeGeometry(0.8, 1.7, 8).translate(0, 6.55, 0), new THREE.CylinderGeometry(1.75, 2.3, 0.5, 8).translate(0, 2.25, 0)]),
      material: leafy('#f4f8fb'),
    },
  ],
  round: [{ geometry: new THREE.IcosahedronGeometry(2.3, 0).translate(0, 4.3, 0), material: leafy('#6fae3f') }],
  palm: [
    { geometry: new THREE.CylinderGeometry(0.22, 0.32, 5.5, 7).translate(0.25, 2.75, 0).rotateZ(-0.06), material: trunkMaterial },
    {
      geometry: mergeGeometries(
        [0, 1.25, 2.5, 3.75, 5].map((a) => new THREE.BoxGeometry(3.2, 0.12, 0.8).translate(1.6, 0, 0).rotateZ(-0.35).rotateY(a).translate(0.55, 5.5, 0)),
      ),
      material: leafy('#4f9e3c'),
    },
  ],
  cactus: [
    {
      geometry: mergeGeometries([
        new THREE.CylinderGeometry(0.38, 0.42, 3.2, 8).translate(0, 1.6, 0),
        new THREE.CylinderGeometry(0.24, 0.24, 1.3, 7).translate(0.75, 2.1, 0),
        new THREE.CylinderGeometry(0.2, 0.2, 0.75, 6).rotateZ(Math.PI / 2).translate(0.4, 1.5, 0),
        new THREE.CylinderGeometry(0.22, 0.22, 1, 7).translate(-0.7, 2.4, 0),
        new THREE.CylinderGeometry(0.18, 0.18, 0.65, 6).rotateZ(Math.PI / 2).translate(-0.36, 1.95, 0),
      ]),
      material: leafy('#4f9a4a'),
    },
  ],
}

