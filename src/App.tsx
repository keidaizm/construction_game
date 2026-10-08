import { GameCanvas } from './components/GameCanvas'
import { TouchControls } from './components/ui/TouchControls'
import { TopBar } from './components/ui/TopBar'
import { FpsMeter } from './components/ui/FpsMeter'
import { ClearOverlay, LevelUpCelebration, MissionBanner } from './components/ui/MissionUI'
import { LevelGuide, ProgressBadge } from './components/ui/LevelGuide'
import { BaseRoomOverlay } from './components/ui/BaseRooms'
import { useKeyboardControls } from './controls/useKeyboardControls'
import { MapOverlay } from './components/ui/MapOverlay'
import { MapCompleteOverlay } from './components/ui/MapComplete'
import { FindToast, ZukanButton, ZukanOverlay } from './components/ui/CollectionUI'

const showFps = new URLSearchParams(location.search).has('fps')

export default function App() {
  useKeyboardControls()
  return (
    <div className="app">
      <GameCanvas />
      <TouchControls />
      <TopBar />
      <ProgressBadge />
      <ZukanButton />
      <FindToast />
      <MissionBanner />
      <ClearOverlay />
      <MapOverlay />
      <ZukanOverlay />
      <BaseRoomOverlay />
      <LevelGuide />
      <MapCompleteOverlay />
      <LevelUpCelebration />
      {showFps && <FpsMeter />}
      <div className="rotate-notice" aria-hidden>
        <div className="rotate-notice__icon">📱↻</div>
        <div>よこにしてね</div>
      </div>
    </div>
  )
}
