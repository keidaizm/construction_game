import { useEffect, useMemo } from 'react'
import { createGroundDetailTexture } from './textures'
import { createGroundGeometry, GROUND_SIZE } from './groundGeometry'

/** 地面。頂点ごとに地帯（biomes.ts）の色と丘（terrain.ts）の高さを付け、灰色の細かい模様と掛け合わせる */
export function Ground() {
  const texture = useMemo(() => {
    const t = createGroundDetailTexture()
    t.repeat.set(GROUND_SIZE / 6, GROUND_SIZE / 6)
    return t
  }, [])
  const geometry = useMemo(() => createGroundGeometry(), [])
  useEffect(
    () => () => {
      texture.dispose()
      geometry.dispose()
    },
    [texture, geometry],
  )

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={texture} vertexColors roughness={1} />
    </mesh>
  )
}
