import { useEffect, useRef } from 'react'

export interface Orbit {
  /** 車両のまわりを回り込む角度 [rad]（0 = いつもの斜め後ろ） */
  yaw: number
  /** 見下ろす角度の変化 [rad]（+ で高くなる） */
  pitch: number
  /** 指でなぞっている最中か（その間はカメラをキビキビ追従させる） */
  dragging: boolean
}

const YAW_PER_PX = 0.006
const PITCH_PER_PX = 0.004
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 30

/**
 * 3D 画面（レバーやボタン以外の場所）を指でなぞって、カメラを回す。
 * - 左右：車両のまわりを回り込む / 上下：高さ（見下ろす角度）
 * - 2 回タップ：いつもの斜め後ろに戻す
 * レバーは自分の指を pointer capture しているので、レバー操作とは干渉しない。
 */
export function useOrbitDrag(element: HTMLElement) {
  const orbit = useRef<Orbit>({ yaw: 0, pitch: 0, dragging: false })

  useEffect(() => {
    let pointer: number | null = null
    let lastX = 0
    let lastY = 0
    let lastTap = { time: 0, x: 0, y: 0 }

    const down = (e: PointerEvent) => {
      if (pointer !== null) return
      // 2 回タップで元に戻す
      const now = performance.now()
      if (now - lastTap.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX) {
        orbit.current.yaw = 0
        orbit.current.pitch = 0
        lastTap = { time: 0, x: 0, y: 0 }
        return
      }
      lastTap = { time: now, x: e.clientX, y: e.clientY }
      pointer = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      element.setPointerCapture(e.pointerId)
      orbit.current.dragging = true
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return
      orbit.current.yaw -= (e.clientX - lastX) * YAW_PER_PX
      orbit.current.pitch += (e.clientY - lastY) * PITCH_PER_PX
      lastX = e.clientX
      lastY = e.clientY
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return
      pointer = null
      orbit.current.dragging = false
    }

    element.addEventListener('pointerdown', down)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', up)
    element.addEventListener('lostpointercapture', up)
    return () => {
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointercancel', up)
      element.removeEventListener('lostpointercapture', up)
    }
  }, [element])

  return orbit
}
