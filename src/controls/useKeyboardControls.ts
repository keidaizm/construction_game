import { useEffect } from 'react'
import { useInputStore, zeroAxes, type AxisName, type Axes } from '../stores/inputStore'
import { useGameStore } from '../stores/gameStore'
import { useCraneStore } from '../stores/craneStore'

/** キー → [軸, 方向]。PC での開発確認用。U/J はショベルのブーム・ダンプの荷台・ブルドーザーの排土板を兼ねる。 */
const KEY_MAP: Record<string, [AxisName, 1 | -1] | [AxisName, 1 | -1][]> = {
  KeyW: ['driveY', 1],
  ArrowUp: ['driveY', 1],
  KeyS: ['driveY', -1],
  ArrowDown: ['driveY', -1],
  KeyA: ['driveX', -1],
  ArrowLeft: ['driveX', -1],
  KeyD: ['driveX', 1],
  ArrowRight: ['driveX', 1],
  KeyQ: ['swing', -1],
  KeyE: ['swing', 1],
  KeyU: [
    ['boom', 1],
    ['bed', 1],
    ['blade', 1],
  ],
  KeyJ: [
    ['boom', -1],
    ['bed', -1],
    ['blade', -1],
  ],
  KeyI: ['arm', 1],
  KeyK: ['arm', -1],
  KeyO: ['bucket', 1],
  KeyL: ['bucket', -1],
}

export function useKeyboardControls() {
  useEffect(() => {
    const pressed = new Set<string>()

    const publish = () => {
      const axes: Axes = zeroAxes()
      for (const code of pressed) {
        const entry = KEY_MAP[code]
        const list = (Array.isArray(entry[0]) ? entry : [entry]) as [AxisName, 1 | -1][]
        for (const [axis, dir] of list) axes[axis] += dir
      }
      useInputStore.getState().setAxes('keyboard', axes)
    }

    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !e.repeat) {
        useGameStore.getState().requestReset()
        return
      }
      if (e.code === 'KeyM' && !e.repeat) {
        useGameStore.getState().toggleMap()
        return
      }
      if (e.code === 'KeyN' && !e.repeat) {
        useGameStore.getState().cycleTimeOfDay()
        return
      }
      if (e.code === 'KeyH' && !e.repeat) {
        useGameStore.getState().toggleHeadlights()
        return
      }
      if (e.code === 'KeyV' && !e.repeat) {
        pressed.clear()
        useInputStore.getState().resetSource('keyboard')
        const game = useGameStore.getState()
        // クレーンに乗っているときは V でおりる
        if (game.activeVehicle === 'crane') game.leaveCrane()
        else game.switchVehicle()
        return
      }
      if (e.code === 'KeyB' && !e.repeat) {
        // ショベル：アタッチメントの切り替え（Lv4 から）
        if (useGameStore.getState().activeVehicle === 'excavator') useGameStore.getState().toggleExcavatorTool()
        return
      }
      if (e.code === 'KeyF' && !e.repeat) {
        // クレーン：つかむ／はなす
        if (useGameStore.getState().activeVehicle === 'crane') useCraneStore.getState().pressGrab()
        return
      }
      if (!(e.code in KEY_MAP)) return
      e.preventDefault()
      if (pressed.has(e.code)) return
      pressed.add(e.code)
      publish()
    }
    const onUp = (e: KeyboardEvent) => {
      if (!pressed.delete(e.code)) return
      publish()
    }
    // フォーカスが外れたらキーが押しっぱなしにならないよう全解除
    const onBlur = () => {
      pressed.clear()
      useInputStore.getState().resetSource('keyboard')
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
