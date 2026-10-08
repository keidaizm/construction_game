import { useState } from 'react'
import { useGameStore, type TimeOfDay } from '../../stores/gameStore'
import { audio } from '../../audio/AudioManager'
import { FullscreenIcon, HeadlightIcon, MoonIcon, ResetIcon, SunIcon, SunsetIcon } from './icons'
import { MapButton } from './MapOverlay'

type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> }

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen()
    // Android Chrome では全画面中のみ横向き固定ができる
    await (screen.orientation as LockableOrientation).lock?.('landscape')
  } catch {
    // 非対応ブラウザでは何もしない
  }
}

/** 音のオン／オフ（保存される） */
function SoundButton() {
  const [muted, setMuted] = useState(audio.muted)
  const toggle = () => {
    audio.setMuted(!muted)
    setMuted(!muted)
  }
  return (
    <button type="button" className="round-button" aria-label={muted ? 'おと なし' : 'おと あり'} onClick={toggle}>
      <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
        <path d="M 10 24 H 22 L 36 12 V 52 L 22 40 H 10 Z" fill="#2b2b2b" strokeLinejoin="round" />
        {muted ? (
          <path d="M 44 24 L 58 40 M 58 24 L 44 40" stroke="#e53935" strokeWidth={5} strokeLinecap="round" />
        ) : (
          <>
            <path d="M 44 24 Q 50 32 44 40" fill="none" stroke="#2b2b2b" strokeWidth={4} strokeLinecap="round" />
            <path d="M 50 18 Q 60 32 50 46" fill="none" stroke="#2b2b2b" strokeWidth={4} strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  )
}

/** 時間帯のボタンに出す「次になる時間帯」の絵と名前 */
const NEXT_TIME: Record<TimeOfDay, { label: string; icon: () => React.JSX.Element }> = {
  day: { label: 'ゆうがたに する', icon: () => <SunsetIcon /> },
  dusk: { label: 'よるに する', icon: () => <MoonIcon /> },
  night: { label: 'ひるに する', icon: () => <SunIcon /> },
}

/** 昼 → 夕焼け → 夜 → 昼…（次になる時間帯の絵を出す） */
function TimeOfDayButton() {
  const time = useGameStore((s) => s.timeOfDay)
  const cycle = useGameStore((s) => s.cycleTimeOfDay)
  const next = NEXT_TIME[time]
  return (
    <button type="button" className="round-button" aria-label={next.label} onClick={cycle}>
      <next.icon />
    </button>
  )
}

/** 夕焼けと夜に出る、車のライトのボタン */
function HeadlightButton() {
  const on = useGameStore((s) => s.headlights)
  const toggle = useGameStore((s) => s.toggleHeadlights)
  return (
    <button
      type="button"
      className={`round-button${on ? ' is-on' : ''}`}
      aria-label={on ? 'ライトを けす' : 'ライトを つける'}
      aria-pressed={on}
      onClick={toggle}
    >
      <HeadlightIcon on={on} />
    </button>
  )
}

/** 左上の大きなボタン：はじめから / 地図 / 音 / 全画面。右上（のりかえボタンの左）：時間帯 / ライト（夕焼け・夜だけ） */
export function TopBar() {
  const requestReset = useGameStore((s) => s.requestReset)
  const dark = useGameStore((s) => s.timeOfDay !== 'day')
  return (
    <>
      <div className="top-bar">
        <button type="button" className="round-button" aria-label="はじめから" onClick={requestReset}>
          <ResetIcon />
        </button>
        <MapButton />
        <SoundButton />
        {document.fullscreenEnabled && (
          <button type="button" className="round-button" aria-label="ぜんがめん" onClick={toggleFullscreen}>
            <FullscreenIcon />
          </button>
        )}
      </div>
      <div className="sky-bar">
        {dark && <HeadlightButton />}
        <TimeOfDayButton />
      </div>
    </>
  )
}
