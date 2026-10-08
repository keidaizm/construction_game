import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { rockRegistry } from '../cargo/rocks/rockRegistry'
import { logRegistry } from '../cargo/logs/logRegistry'
import { restoreSession, saveSession } from '../stores/sessionSave'

/** 保存する間隔 [s] */
const SAVE_INTERVAL = 2
/** 車両を戻してから、石・木材を置くまでのフレーム数（車両の当たり判定が移るのを待つ） */
const ROCKS_AFTER_FRAMES = 4

/**
 * 遊んでいる途中の様子のセーブ（stores/sessionSave.ts）を、物理の準備ができてから戻し、そのあと定期的に保存する。
 * ほかのアプリに切りかえたとき・閉じるときにも保存する。3D には何も描かない。
 */
export function SessionKeeper() {
  const { rapier } = useRapier()
  const frame = useRef(-1)
  const timer = useRef(0)

  useEffect(() => {
    const save = () => saveSession()
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', save)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', save)
    }
  }, [])

  useFrame((_, dt) => {
    // 石・木材が登録されてから戻しはじめる
    if (frame.current < 0) {
      if (rockRegistry.rocks.length === 0 || logRegistry.logs.length === 0 || !rockRegistry.spawn || !logRegistry.spawn) return
      frame.current = 0
      restoreSession(0, rapier)
      return
    }
    if (frame.current < ROCKS_AFTER_FRAMES) {
      frame.current++
      if (frame.current === ROCKS_AFTER_FRAMES) restoreSession(1, rapier)
      return
    }
    timer.current += dt
    if (timer.current < SAVE_INTERVAL) return
    timer.current = 0
    saveSession()
  })
  return null
}
