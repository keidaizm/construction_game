import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Beam } from '../../shared/Beam'
import { darkSteel } from '../../shared/materials'
import { BUCKET_PROFILE as PROFILE, BUCKET_TIP, BUCKET_WIDTH as WIDTH, type YZ } from '../bucketShape'

/** 底の格子の、すき間をあけて並べた細い板の位置（ローカル X） */
const SLATS = [-0.42, -0.25, -0.08, 0.08, 0.25, 0.42]

/** 2 点をつなぐ角材の形（Beam と同じ置き方）を、1 つの形にまとめるために作る */
function beamGeometry(from: YZ, to: YZ, width: number, height: number, x = 0) {
  const dy = to[0] - from[0]
  const dz = to[1] - from[1]
  return new THREE.BoxGeometry(width, height, Math.hypot(dy, dz))
    .rotateX(-Math.atan2(dy, dz))
    .translate(x, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2)
}

/**
 * スケルトンバケット（Lv7）。形はふつうのバケットと同じで、底と背中が格子（すき間から小石が落ちる）。
 * すき間の板と横の骨は 1 つの形にまとめて、描く回数を増やさない。
 */
export function SkeletonBucketModel({ paint, accent = darkSteel }: { paint: THREE.Material; accent?: THREE.Material }) {
  const sideGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    PROFILE.forEach(([y, z], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)))
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false })
    g.rotateY(-Math.PI / 2) // 形の x → ローカル z
    return g
  }, [])
  const gridGeometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    // 縦の板（外殻にそって、すき間をあけて）
    for (let i = 1; i < PROFILE.length; i++) for (const x of SLATS) parts.push(beamGeometry(PROFILE[i - 1], PROFILE[i], 0.07, 0.06, x))
    // 横の骨（外殻の角ごと）
    for (const [y, z] of PROFILE.slice(1, -1)) parts.push(new THREE.BoxGeometry(WIDTH, 0.07, 0.07).translate(0, y, z))
    return mergeGeometries(parts)!
  }, [])
  useEffect(
    () => () => {
      sideGeometry.dispose()
      gridGeometry.dispose()
    },
    [sideGeometry, gridGeometry],
  )

  return (
    <group>
      <mesh geometry={gridGeometry} material={paint} />
      {/* 側板 */}
      <mesh geometry={sideGeometry} position-x={WIDTH / 2 + 0.025} material={paint} />
      <mesh geometry={sideGeometry} position-x={-WIDTH / 2 + 0.025} material={paint} />
      {/* 刃（爪のかわりに 1 枚の板） */}
      <Beam from={[-0.1, 1.18]} to={[BUCKET_TIP[1], BUCKET_TIP[2]]} width={WIDTH} height={0.06} material={accent} />
      {/* ピンのボス */}
      <mesh rotation-z={Math.PI / 2} material={accent}>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 10]} />
      </mesh>
    </group>
  )
}
