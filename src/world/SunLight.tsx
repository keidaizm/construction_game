import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { blend3, dayNight } from './dayNightState'

/** 車両から見た太陽（夜は月）の方向。月の見た目（DayNight）もこの方向に出す */
export const SUN_OFFSET = new THREE.Vector3(18, 30, 12)

// 昼 → 夕焼け → 夜（月明かり：うっすら見えるくらいの青白い光）
const SUN = { day: new THREE.Color('#ffffff'), dusk: new THREE.Color('#ffb27a'), night: new THREE.Color('#9fb6ff') }
const HEMI_SKY = { day: new THREE.Color('#dbeeff'), dusk: new THREE.Color('#f5c7a0'), night: new THREE.Color('#5f74a8') }
const HEMI_GROUND = { day: new THREE.Color('#8a6a45'), dusk: new THREE.Color('#7a5236'), night: new THREE.Color('#2a2622') }
const SUN_INTENSITY = { day: 2.2, night: 0.75 }
const HEMI_INTENSITY = { day: 1.1, night: 0.75 }

/**
 * 太陽光。影を描く範囲を車両の周りだけに絞り、車両に合わせて移動させる。
 * 広い範囲に影を落とすより、ずっと軽くてくっきりする。
 * 夜は同じ光を月明かり（弱い青白い光）にする（dayNight.darkness）。
 */
export function SunLight({ target }: { target: RefObject<THREE.Object3D | null> }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const scene = useThree((s) => s.scene)
  const lightTarget = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    scene.add(lightTarget)
    if (light.current) light.current.target = lightTarget
    return () => {
      scene.remove(lightTarget)
    }
  }, [scene, lightTarget])

  useFrame(() => {
    const t = target.current
    if (!t || !light.current) return
    lightTarget.position.copy(t.position)
    light.current.position.copy(t.position).add(SUN_OFFSET)

    const d = dayNight.darkness
    blend3(light.current.color, SUN.day, SUN.dusk, SUN.night, d)
    light.current.intensity = THREE.MathUtils.lerp(SUN_INTENSITY.day, SUN_INTENSITY.night, d)
    if (hemi.current) {
      blend3(hemi.current.color, HEMI_SKY.day, HEMI_SKY.dusk, HEMI_SKY.night, d)
      blend3(hemi.current.groundColor, HEMI_GROUND.day, HEMI_GROUND.dusk, HEMI_GROUND.night, d)
      hemi.current.intensity = THREE.MathUtils.lerp(HEMI_INTENSITY.day, HEMI_INTENSITY.night, d)
    }
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#dbeeff', '#8a6a45', 1.1]} />
      <directionalLight
        ref={light}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={5}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
    </>
  )
}
