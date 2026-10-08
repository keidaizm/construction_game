import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, type TimeOfDay } from '../stores/gameStore'
import { blend3, dayNight } from './dayNightState'
import { SUN_OFFSET } from './SunLight'

/** 昼 → 夜（darkness 0 → 1）にかかる時間 [秒]。昼 → 夕焼けはその半分 */
const TRANSITION = 3
/** 時間帯ごとの暗さ（夕焼けは昼と夜のまん中＝夕焼けの色がいちばん濃い所） */
export const DARKNESS: Record<TimeOfDay, number> = { day: 0, dusk: 0.5, night: 1 }
const SKY_DAY = new THREE.Color('#bfdcf2')
const SKY_DUSK = new THREE.Color('#f0a46e')
const SKY_NIGHT = new THREE.Color('#0d1734')
const STAR_COUNT = 500
const SKY_RADIUS = 360

/**
 * 時間帯の切り替え（gameStore.timeOfDay：昼・夕焼け・夜）。空の色・霧の色を変え、夜は星と月を出す。
 * 光の強さは SunLight、車両のライトは Headlights が dayNight.darkness を読んで変える。
 */
export function DayNight() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const sky = useRef<THREE.Group>(null)
  const sky3 = useMemo(() => new THREE.Color().copy(SKY_DAY), [])

  useEffect(() => {
    scene.background = sky3
    scene.fog = new THREE.Fog(sky3.clone(), 90, 300)
    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene, sky3])

  // 星（空の上半分に散らばる点。1 回の描画で済む）
  const starGeometry = useMemo(() => {
    const p = new Float32Array(STAR_COUNT * 3)
    for (let i = 0; i < STAR_COUNT; i++) {
      const a = Math.random() * Math.PI * 2
      const y = 0.08 + Math.random() * 0.92
      const r = Math.sqrt(1 - y * y)
      p.set([Math.cos(a) * r * SKY_RADIUS, y * SKY_RADIUS, Math.sin(a) * r * SKY_RADIUS], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  const starMaterial = useMemo(
    () => new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
    [],
  )
  const moonMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff4cf', transparent: true, opacity: 0, fog: false }), [])
  const moonPos = useMemo(() => SUN_OFFSET.clone().normalize().multiplyScalar(SKY_RADIUS - 20), [])
  useEffect(
    () => () => {
      starGeometry.dispose()
      starMaterial.dispose()
      moonMaterial.dispose()
    },
    [starGeometry, starMaterial, moonMaterial],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const target = DARKNESS[useGameStore.getState().timeOfDay]
    const d = dayNight.darkness
    dayNight.darkness = target > d ? Math.min(1, d + dt / TRANSITION) : Math.max(0, d - dt / TRANSITION)
    const t = dayNight.darkness

    blend3(sky3, SKY_DAY, SKY_DUSK, SKY_NIGHT, t)
    ;(scene.fog as THREE.Fog | null)?.color.copy(sky3)

    // 星と月は夕焼けが終わってから見えはじめる
    const show = THREE.MathUtils.clamp((t - 0.6) / 0.4, 0, 1)
    starMaterial.opacity = show
    moonMaterial.opacity = show
    if (sky.current) {
      sky.current.visible = show > 0
      sky.current.position.copy(camera.position)
    }
  })

  return (
    <group ref={sky}>
      <points geometry={starGeometry} material={starMaterial} renderOrder={-1} />
      <mesh position={moonPos} material={moonMaterial}>
        <sphereGeometry args={[9, 16, 12]} />
      </mesh>
    </group>
  )
}
