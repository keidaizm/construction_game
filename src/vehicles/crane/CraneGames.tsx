import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { answerOf, useCraneStore } from '../../stores/craneStore'
import { useGameStore } from '../../stores/gameStore'
import { useProgressStore } from '../../stores/progressStore'
import { useToastStore } from '../../stores/toastStore'
import { audio } from '../../audio/AudioManager'
import { CONTAINER_PAD, CONTAINER_SIGN, RULER_HEIGHT, TOWER_BASE, TOWER_RULER, craneLoads } from './craneYard'
import { resetLoads } from './CraneLoads'

/** しま模様（黄色と黒）の台の絵 */
function stripeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffd400'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#222222'
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 16, 0)
    ctx.lineTo(i + 16 - 128, 128)
    ctx.lineTo(i - 128, 128)
    ctx.fill()
  }
  // まん中は無地（コンテナを置く所）
  ctx.fillStyle = '#ffe866'
  ctx.fillRect(18, 18, 92, 92)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 看板の絵：式（2 + 3 = ？、45 − 12 = ？ など）。せいかいなら答え。2けたの式でも入るよう、文字の大きさを合わせる */
function drawSign(canvas: HTMLCanvasElement, expression: string, answer: string, correct: boolean) {
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = correct ? '#e9ffe9' : '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = correct ? '#2fbf5b' : '#2f80ed'
  ctx.lineWidth = 16
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
  ctx.fillStyle = '#222222'
  const left = `${expression} = `
  let size = 120
  ctx.font = `900 ${size}px sans-serif`
  const room = canvas.width - 60
  const width = () => ctx.measureText(left).width + ctx.measureText(answer).width
  while (width() > room && size > 50) {
    size -= 6
    ctx.font = `900 ${size}px sans-serif`
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const x = (canvas.width - width()) / 2
  ctx.fillText(left, x, canvas.height / 2 + 6)
  ctx.fillStyle = correct ? '#2fbf5b' : '#e53935'
  ctx.fillText(answer, x + ctx.measureText(left).width, canvas.height / 2 + 6)
}

/** ものさしの絵：1m ごとの目盛りと数字 */
function rulerTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64 * RULER_HEIGHT
  const ctx = c.getContext('2d')!
  for (let m = 0; m < RULER_HEIGHT; m++) {
    const y = c.height - (m + 1) * 64
    ctx.fillStyle = m % 2 === 0 ? '#ffffff' : '#e53935'
    ctx.fillRect(0, y, 64, 64)
    ctx.fillStyle = m % 2 === 0 ? '#e53935' : '#ffffff'
    ctx.font = '900 40px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(m + 1), 32, y + 10)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const padMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8 })
const baseMaterial = new THREE.MeshStandardMaterial({ color: '#c9c4ba', roughness: 0.9 })
const postMaterial = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.7 })
const levelMaterial = new THREE.MeshBasicMaterial({ color: '#2fbf5b', transparent: true, opacity: 0.55, depthWrite: false })
const bestMaterial = new THREE.MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0.7, depthWrite: false })

/** 台にのせたコンテナを判定する間隔 [s] と、のせてから決まるまでの時間 */
const CHECK = 0.25
const SETTLE = 0.6
/** せいかいのあと、次の問題になるまで [s] */
const NEXT_DELAY = 2.6
/** タワーの高さを数える範囲（土台の中心から） [m] */
const TOWER_AREA = 4.5

/** 止まっているか（ほとんど動いていない） */
function isResting(body: (typeof craneLoads.list)[number]['body']) {
  const v = body.linvel()
  const w = body.angvel()
  // 積んだブロックは小さくふるえることがあるので、ゆるめに見る
  return Math.hypot(v.x, v.y, v.z) < 0.4 && Math.hypot(w.x, w.y, w.z) < 0.9
}

/**
 * クレーンのミニゲームの道具（台・看板・土台・ものさし）と判定。
 * - コンテナはこび：台の上に止まったコンテナの数字が答えなら、せいかい（星 +1）→ 少しして次の問題
 * - つみきタワー：土台のまわりで止まっているブロックのいちばん上の高さ。さいこう記録をこえたら記録（1m こえるごとに星 +1）
 */
export function CraneGames() {
  const { rapier } = useRapier()
  const pad = useMemo(() => stripeTexture(), [])
  const ruler = useMemo(() => rulerTexture(), [])
  const signCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 192
    return c
  }, [])
  const signTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(signCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [signCanvas])
  const rulerMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: ruler, roughness: 0.7 }), [ruler])
  const signMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture }), [signTexture])
  useEffect(() => {
    padMaterial.map = pad
    padMaterial.needsUpdate = true
    return () => {
      pad.dispose()
      ruler.dispose()
      signTexture.dispose()
      rulerMaterial.dispose()
      signMaterial.dispose()
    }
  }, [pad, ruler, signTexture, rulerMaterial, signMaterial])

  const question = useCraneStore((s) => s.question)
  const feedback = useCraneStore((s) => s.feedback)
  useEffect(() => {
    const correct = feedback?.kind === 'correct'
    drawSign(signCanvas, `${question.a} ${question.op} ${question.b}`, correct ? String(answerOf(question)) : '？', correct)
    signTexture.needsUpdate = true
  }, [question, feedback, signCanvas, signTexture])

  const level = useRef<THREE.Mesh>(null)
  const best = useRef<THREE.Mesh>(null)
  const timer = useRef(0)
  const onPadSince = useRef<{ id: string; at: number } | null>(null)
  const clock = useRef(0)
  const nextAt = useRef<number | null>(null)
  const towerStableSince = useRef<{ h: number; at: number } | null>(null)

  useFrame((_, dt) => {
    clock.current += dt
    const store = useCraneStore.getState()
    const onCrane = useGameStore.getState().activeVehicle === 'crane'

    // せいかいのあと：コンテナを元に戻して次の問題
    if (nextAt.current !== null && clock.current >= nextAt.current) {
      nextAt.current = null
      resetLoads('containers', rapier)
      store.nextQuestion()
    }

    timer.current += dt
    if (timer.current < CHECK) return
    timer.current = 0

    // --- コンテナはこび ---
    if (onCrane && store.game === 'containers' && nextAt.current === null) {
      const cos = Math.cos(CONTAINER_PAD.yaw)
      const sin = Math.sin(CONTAINER_PAD.yaw)
      const on = craneLoads.list.find((l) => {
        if (l.game !== 'containers' || l.body.isKinematic()) return false
        const p = l.body.translation()
        const dx = p.x - CONTAINER_PAD.x
        const dz = p.z - CONTAINER_PAD.z
        // 台の向きにそった座標で、台の上に中心があるか
        const lx = dx * cos - dz * sin
        const lz = dx * sin + dz * cos
        return Math.abs(lx) < CONTAINER_PAD.size / 2 && Math.abs(lz) < CONTAINER_PAD.size / 2 && p.y < l.size[1] + 0.2 && isResting(l.body)
      })
      if (!on) {
        onPadSince.current = null
        if (store.feedback?.kind === 'wrong') store.setFeedback(null)
      } else if (onPadSince.current?.id !== on.id) {
        onPadSince.current = { id: on.id, at: clock.current }
      } else if (clock.current - onPadSince.current.at >= SETTLE && !store.feedback) {
        const answer = answerOf(store.question)
        if (on.number === answer) {
          store.setFeedback({ kind: 'correct', number: on.number })
          useProgressStore.getState().addStars(1)
          audio.play('missionClear')
          useToastStore.getState().show({ title: 'せいかい！ ほし +1', icon: 'star', color: '#ffc933', stars: 0, isNew: false })
          nextAt.current = clock.current + NEXT_DELAY
        } else {
          store.setFeedback({ kind: 'wrong', number: on.number })
          audio.play('rockHit')
        }
      }
    }

    // --- つみきタワー ---
    let height = 0
    for (const l of craneLoads.list) {
      if (l.game !== 'tower' || l.body.isKinematic()) continue
      const p = l.body.translation()
      if (Math.hypot(p.x - TOWER_BASE.x, p.z - TOWER_BASE.z) > TOWER_AREA || !isResting(l.body)) continue
      // 箱のいちばん上（回っていても、いちばん長い辺の半分までに収まる）
      const r = l.body.rotation()
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w)
      const e = new THREE.Matrix4().makeRotationFromQuaternion(q).elements
      const half = (Math.abs(e[1]) * l.size[0] + Math.abs(e[5]) * l.size[1] + Math.abs(e[9]) * l.size[2]) / 2
      height = Math.max(height, p.y + half)
    }
    height = Math.round(height * 10) / 10
    if (Math.abs(height - store.towerHeight) >= 0.1) store.setTowerHeight(height)
    if (level.current) {
      level.current.visible = height > 0.05
      level.current.position.y = height
    }
    if (best.current) {
      best.current.visible = store.towerBest > 0.05
      best.current.position.y = store.towerBest
    }
    // さいこう記録：同じ高さで 1.5 秒止まっていたら記録する
    if (onCrane && store.game === 'tower' && !store.holding) {
      const st = towerStableSince.current
      if (!st || Math.abs(st.h - height) > 0.05) towerStableSince.current = { h: height, at: clock.current }
      else if (clock.current - st.at > 1.5 && height > store.towerBest + 0.05) {
        const before = store.towerBest
        store.setTowerBest(height)
        audio.play('levelUp')
        const star = Math.floor(height) > Math.floor(before)
        if (star) useProgressStore.getState().addStars(1)
        useToastStore.getState().show({ title: `さいこう きろく！ ${height.toFixed(1)}m${star ? ' ほし +1' : ''}`, icon: 'star', color: '#ffc933', stars: 0, isNew: true })
      }
    }
  })

  return (
    <>
      {/* コンテナをのせる台と、式の看板 */}
      <mesh position={[CONTAINER_PAD.x, 0.03, CONTAINER_PAD.z]} rotation={[-Math.PI / 2, 0, CONTAINER_PAD.yaw]} material={padMaterial} receiveShadow>
        <planeGeometry args={[CONTAINER_PAD.size, CONTAINER_PAD.size]} />
      </mesh>
      <group position={[CONTAINER_SIGN.x, 0, CONTAINER_SIGN.z]} rotation-y={Math.atan2(-Math.cos(CONTAINER_SIGN.yaw), Math.sin(CONTAINER_SIGN.yaw))}>
        {[-2.2, 2.2].map((x) => (
          <mesh key={x} position={[x, 2, -0.05]} material={postMaterial}>
            <boxGeometry args={[0.18, 4, 0.18]} />
          </mesh>
        ))}
        <mesh position={[0, 3.3, 0.05]} material={signMaterial}>
          <planeGeometry args={[5.2, 1.95]} />
        </mesh>
        <mesh position={[0, 3.3, -0.02]} material={postMaterial}>
          <boxGeometry args={[5.4, 2.15, 0.08]} />
        </mesh>
      </group>

      {/* つみきタワーの土台と、高さのものさし（いまの高さ＝緑の線、さいこう記録＝オレンジの線） */}
      <mesh position={[TOWER_BASE.x, 0.04, TOWER_BASE.z]} rotation={[-Math.PI / 2, 0, TOWER_BASE.yaw]} material={baseMaterial} receiveShadow>
        <planeGeometry args={[TOWER_BASE.size, TOWER_BASE.size]} />
      </mesh>
      <group position={[TOWER_RULER.x, 0, TOWER_RULER.z]} rotation-y={TOWER_RULER.yaw}>
        <mesh position-y={RULER_HEIGHT / 2} material={rulerMaterial} castShadow>
          <boxGeometry args={[0.35, RULER_HEIGHT, 0.35]} />
        </mesh>
        <mesh ref={level} material={levelMaterial} visible={false}>
          <boxGeometry args={[1.4, 0.08, 1.4]} />
        </mesh>
        <mesh ref={best} material={bestMaterial} visible={false}>
          <boxGeometry args={[1.2, 0.06, 1.2]} />
        </mesh>
      </group>
    </>
  )
}
