import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ConvexHullCollider, CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useGameStore } from '../../stores/gameStore'
import { useCraneStore } from '../../stores/craneStore'
import { ALL_LOADS, craneLoads, type LoadDef, type LoadEntry } from './craneYard'

/** 三角の屋根のブロック（横から見て三角） */
function roofGeometry(w: number, h: number, d: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2, -h / 2)
  shape.lineTo(w / 2, -h / 2)
  shape.lineTo(0, h / 2)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)
}

/** コンテナの数字の絵（色の板に白い丸、大きな数字） */
function drawNumber(canvas: HTMLCanvasElement, color: string, n: number) {
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  const s = Math.min(w, h)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  // 波板のすじ
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 5, h)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, s * 0.38, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222222'
  // 2けたの数は少し小さく（白い丸からはみ出さないように）
  ctx.font = `900 ${Math.round(s * (n >= 10 ? 0.42 : 0.55))}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), w / 2, h / 2 + s * 0.04)
}

export function Load({ def, index }: { def: LoadDef; index: number }) {
  const body = useRef<RapierRigidBody>(null)
  const [w, h, d] = def.size
  const isContainer = def.game === 'containers'
  const question = useCraneStore((s) => s.question)

  // コンテナは数字を書いた絵を、上と横の面に貼る（長い面と短い面で、数字がのびないよう絵を分ける）
  const pictures = useMemo(() => {
    const make = (cw: number, ch: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      return { canvas, texture }
    }
    return { long: make(Math.round(128 * (w / h)), 128), short: make(Math.round(128 * (d / h)), 128) }
  }, [w, h, d])
  const materials = useMemo(() => {
    if (!isContainer) return new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7, flatShading: true })
    const long = new THREE.MeshStandardMaterial({ map: pictures.long.texture, roughness: 0.6 })
    const short = new THREE.MeshStandardMaterial({ map: pictures.short.texture, roughness: 0.6 })
    const plain = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6 })
    // 箱の面の順：+x, -x, +y, -y, +z, -z（+x・-x が短い面、上と ±z が長い面）
    return [short, short, long, plain, long, long]
  }, [isContainer, def.color, pictures])
  const number = isContainer ? question.options[index] : 0
  useEffect(() => {
    if (!isContainer) return
    for (const p of [pictures.long, pictures.short]) {
      drawNumber(p.canvas, def.color, number)
      p.texture.needsUpdate = true
    }
    const entry = craneLoads.list.find((l) => l.id === def.id)
    if (entry) entry.number = number
  }, [isContainer, pictures, def.color, def.id, number])

  const geometry = useMemo(() => (def.shape === 'roof' ? roofGeometry(w, h, d) : new THREE.BoxGeometry(w, h, d)), [def.shape, w, h, d])
  const hull = useMemo(() => new Float32Array(geometry.getAttribute('position').array as Float32Array), [geometry])
  useEffect(
    () => () => {
      geometry.dispose()
      pictures.long.texture.dispose()
      pictures.short.texture.dispose()
      ;(Array.isArray(materials) ? materials : [materials]).forEach((m) => m.dispose())
    },
    [geometry, pictures, materials],
  )

  // 登録（クレーンのフック・ミニゲームの判定が使う）
  useEffect(() => {
    const b = body.current
    if (!b) return
    const entry: LoadEntry = { ...def, body: b, number }
    craneLoads.list.push(entry)
    return () => {
      const i = craneLoads.list.indexOf(entry)
      if (i >= 0) craneLoads.list.splice(i, 1)
    }
    // 数字が変わっても登録しなおさない（数字は上の effect で書きかえる）
  }, [def])

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      position={[def.home.x, h / 2 + 0.02, def.home.z]}
      rotation={[0, def.home.yaw, 0]}
      linearDamping={0.15}
      angularDamping={0.5}
      ccd
    >
      {def.shape === 'roof' ? (
        <ConvexHullCollider args={[hull]} friction={0.9} restitution={0} />
      ) : (
        <CuboidCollider args={[w / 2, h / 2, d / 2]} friction={0.9} restitution={0} />
      )}
      <mesh geometry={geometry} material={materials} castShadow receiveShadow />
    </RigidBody>
  )
}

/** 荷物を元の場所に戻す（ミニゲームのやりなおし・次の問題）。クレーンが持っている荷物はそのまま */
export function resetLoads(game: LoadDef['game'] | null, rapier: ReturnType<typeof useRapier>['rapier']) {
  for (const load of craneLoads.list) {
    if (game && load.game !== game) continue
    // 屋上のクレーンの鉄骨は、ビルの工事の続き（SkyscraperSite が持つ）なので、はじめからでも動かさない
    if (!game && load.game === 'sky') continue
    if (load.body.isKinematic()) continue
    load.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
    load.body.setTranslation({ x: load.home.x, y: load.size[1] / 2 + 0.02, z: load.home.z }, true)
    load.body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), load.home.yaw), true)
    load.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    load.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }
}

/** クレーンで運ぶ荷物（コンテナ 5 こ・つみき 10 こ）。「はじめから」で元の場所に戻る */
export function CraneLoads() {
  const { rapier } = useRapier()
  const resetToken = useGameStore((s) => s.resetToken)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    resetLoads(null, rapier)
  }, [resetToken, rapier])

  let containerIndex = 0
  return (
    <>
      {ALL_LOADS.map((def) => (
        <Load key={def.id} def={def} index={def.game === 'containers' ? containerIndex++ : 0} />
      ))}
    </>
  )
}
