import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { excavatorSensors } from '../../vehicles/excavator/excavatorSensors'
import { rockRegistry } from './rockRegistry'
import type { RockColor } from './rockTypes'
import { useGameStore } from '../../stores/gameStore'
import { useMissionStore } from '../../stores/missionStore'
import { dumpTruckSensors } from '../../vehicles/dumpTruck/dumpTruckSensors'
import { insideZone } from '../../missions/missionConfig'
import { remainingFor } from '../../stores/missionStore'
import { truckOverColors } from '../../missions/cargoCounts'

/** バケット先端からこの距離（水平）以内の岩に「とれる」マーカーを出す */
const SHOW_DISTANCE = 5
const HEIGHT_ABOVE = 0.9

const dummy = new THREE.Object3D()

/**
 * すくえる岩の上に浮かぶ、下向きの三角マーカー。
 * 文字を読めなくても「これが取れる」と分かるようにする。
 * すべてのマーカーを 1 回の描画（InstancedMesh）でまとめて描く。
 */
export function PickupMarkers({ max }: { max: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffd400',
        transparent: true,
        opacity: 0.95,
        depthTest: false, // バケットや車体の陰でも見えるように
      }),
    [],
  )
  // 三角すい（面が 3 つ）を逆さにして、どこから見ても「▼」に見えるようにする
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.3, 0.5, 3)
    g.rotateX(Math.PI)
    return g
  }, [])
  const scales = useRef<Float32Array>(new Float32Array(max))

  useFrame(({ clock }, rawDt) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(rawDt, 1 / 20)
    const t = clock.elapsedTime
    const tip = excavatorSensors.bucketTip
    // ショベルカーに乗っていて、バケットに空きがあるときだけ出す
    const canGrab = useGameStore.getState().activeVehicle === 'excavator' && excavatorSensors.freeSlots > 0
    const rocks = rockRegistry.rocks
    // ダンプに多く積みすぎているときは、荷台の岩にも ▼ を出す（すくい出して減らせる）
    const mission = useMissionStore.getState()
    // 色ごとに見る（くろが多すぎるなら、くろい岩にだけ ▼）
    const remaining = remainingFor(mission) as (c: RockColor) => number
    const truckOver = dumpTruckSensors.loadedCount > 0 ? truckOverColors(remaining) : new Set<RockColor>()
    // おきばの岩には、多すぎるときだけ ▼ を出す（取り除けることを知らせる）
    let visible = 0

    for (let i = 0; i < max; i++) {
      const rock = rocks[i]
      let target = 0
      const grabbable =
        rock &&
        ((rock.state === 'free' && (remaining(rock.color) < 0 || !insideZone(rock.body.translation()))) ||
          (rock.state === 'truck' && truckOver.has(rock.color)))
      if (rock && canGrab && grabbable && t >= rock.grabCooldownUntil) {
        const p = rock.body.translation()
        if (Math.hypot(p.x - tip.x, p.z - tip.z) < SHOW_DISTANCE) target = 1
      }
      // ふわっと出て、ふわっと消える
      const s = (scales.current[i] += (target - scales.current[i]) * Math.min(1, dt * 8))
      if (!rock || s < 0.02) {
        dummy.scale.setScalar(0)
      } else {
        const p = rock.body.translation()
        const bob = Math.sin(t * 4 + i) * 0.08
        dummy.position.set(p.x, p.y + rock.radius + HEIGHT_ABOVE + bob, p.z)
        dummy.rotation.set(0, t * 1.5 + i, 0)
        dummy.scale.setScalar(s * (1 + Math.sin(t * 6 + i) * 0.08))
        visible++
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.visible = visible > 0
  })

  return <instancedMesh ref={ref} args={[geometry, material, max]} frustumCulled={false} renderOrder={10} />
}
