import { truckShape } from '../vehicles/dumpTruck/dumpTruckConfig'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { dumpTruckSensors } from '../vehicles/dumpTruck/dumpTruckSensors'
import { remainingFor, useMissionStore } from '../stores/missionStore'
import { truckOverColors } from './cargoCounts'

const SIZE = 256

/** 荷台に載っている数の札を Canvas に描く。多すぎるときは赤 */
function draw(ctx: CanvasRenderingContext2D, count: number, over: boolean) {
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 10, 0, Math.PI * 2)
  ctx.fillStyle = over ? '#e53935' : '#ffffff'
  ctx.fill()
  ctx.lineWidth = 12
  ctx.strokeStyle = over ? '#ffffff' : '#2b2b2b'
  ctx.stroke()
  ctx.fillStyle = over ? '#ffffff' : '#2b2b2b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${over ? 120 : 140}px system-ui, sans-serif`
  ctx.fillText(String(count), SIZE / 2, over ? SIZE / 2 - 18 : SIZE / 2 + 6)
  if (over) {
    ctx.font = '900 48px system-ui, sans-serif'
    ctx.fillText('おおい', SIZE / 2, SIZE / 2 + 72)
  }
}

/**
 * ダンプの荷台の上に浮かぶ「いま何こ載っているか」の札。
 * ミッションの残りより多いと赤くなり「おおい」と出る（→ ショベルですくい出して減らす）。
 */
export function TruckCargoBadge({ truck }: { truck: RefObject<THREE.Object3D | null> }) {
  const sprite = useRef<THREE.Sprite>(null)
  const last = useRef('')
  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
    return { canvas, texture, material }
  }, [])
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )

  useFrame(() => {
    const s = sprite.current
    const t = truck.current
    if (!s || !t) return
    const count = dumpTruckSensors.loadedCount
    const mission = useMissionStore.getState()
    const { status } = mission
    s.visible = count > 0 && status === 'playing'
    if (!s.visible) return
    // 残りより多い色・ミッションにない色が 1 つでもあれば「おおい」
    const over = truckOverColors(remainingFor(mission)).size > 0
    const key = `${count}-${over}`
    if (key !== last.current) {
      last.current = key
      draw(canvas.getContext('2d')!, count, over)
      texture.needsUpdate = true
    }
    // 荷台の中央の上（トラックの向きに合わせる）
    const G = truckShape.current
    const back = G.bedHinge[2] + G.bedLength / 2
    // 荷台の岩の上の ▼ と重ならない高さ（重ダンプは荷台が高い）
    const height = G.bedHinge[1] + G.bedFloorThickness + G.bedWallHeight + 1.9
    s.position.set(t.position.x + Math.sin(t.rotation.y) * back, t.position.y + height, t.position.z + Math.cos(t.rotation.y) * back)
  })

  return <sprite ref={sprite} material={material} scale={[1.6, 1.6, 1]} renderOrder={12} visible={false} />
}
