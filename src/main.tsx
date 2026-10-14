import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './stores/sessionSave'
import './styles/global.css'
import { rockRegistry } from './cargo/rocks/rockRegistry'
import { excavatorSensors } from './vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from './vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from './vehicles/bulldozer/bulldozerSensors'
import { useGameStore } from './stores/gameStore'
import { useMissionStore } from './stores/missionStore'
import { useProgressStore } from './stores/progressStore'
import { useCollectionStore } from './stores/collectionStore'
import { dirtRegistry } from './cargo/dirt/dirtRegistry'
import { useExplorationStore } from './stores/explorationStore'
import { requestTeleport } from './vehicles/shared/devTeleport'
import { craneSensors } from './vehicles/crane/craneSensors'
import { craneLoads } from './vehicles/crane/craneYard'
import { useCraneStore } from './stores/craneStore'
import { logRegistry } from './cargo/logs/logRegistry'
import { forest } from './world/forest'
import { useHouseStore } from './stores/houseStore'
import { boulderDirty, boulderStates } from './world/boulders'
import { useInputStore } from './stores/inputStore'
import { scrapRegistry } from './cargo/scrap/scrapRegistry'
import { useScrapStore } from './stores/scrapStore'
import { building } from './world/demolition'
import { useCityStore } from './stores/cityStore'
import { useCraftStore } from './stores/craftStore'

// 開発時のみ：ブラウザのコンソールや自動テストから状態を確認できるようにする
if (import.meta.env.DEV) Object.assign(window, { __game: { rockRegistry, excavatorSensors, dumpTruckSensors, bulldozerSensors, game: useGameStore, mission: useMissionStore, progress: useProgressStore, collection: useCollectionStore, dirt: dirtRegistry, exploration: useExplorationStore, teleport: requestTeleport, craneSensors, crane: useCraneStore, craneLoads, logs: logRegistry, forest, houses: useHouseStore, boulders: { states: boulderStates, dirty: boulderDirty }, craft: useCraftStore, input: useInputStore, scrap: scrapRegistry, scrapStore: useScrapStore, building, city: useCityStore } })

// 長押しメニューやダブルタップ拡大で操作が途切れないようにする
window.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 公開した版では、オフラインでも遊べるようにサービスワーカーを登録する（public/sw.js）。開発中は使わない
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 登録できなくても、ネットにつながっていれば遊べる
    })
  })
}
