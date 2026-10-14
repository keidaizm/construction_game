import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { Ground } from '../world/Ground'
import { Environment } from '../world/Environment'
import { SunLight } from '../world/SunLight'
import { FollowCamera } from '../camera/FollowCamera'
import { PhysicsWorld } from '../physics/PhysicsWorld'
import { RockField } from '../cargo/rocks/RockField'
import { DirtMound } from '../cargo/dirt/DirtMound'
import { ALL_MOUNDS } from '../cargo/dirt/dirtConfig'
import { DigEffects } from '../effects/DigEffects'
import { GoldBeacon } from '../missions/GoldBeacon'
import { Excavator } from '../vehicles/excavator/Excavator'
import { DumpTruck } from '../vehicles/dumpTruck/DumpTruck'
import { Bulldozer } from '../vehicles/bulldozer/Bulldozer'
import { Crane } from '../vehicles/crane/Crane'
import { CraneLoads } from '../vehicles/crane/CraneLoads'
import { CraneGames } from '../vehicles/crane/CraneGames'
import { useGameStore } from '../stores/gameStore'
import { DeliveryZone } from '../missions/DeliveryZone'
import { GuideArrow } from '../missions/GuideArrow'
import { TruckCargoBadge } from '../missions/TruckCargoBadge'
import { CompassArrows } from '../missions/CompassArrows'
import { ExplorationTracker } from '../world/ExplorationTracker'
import { DayNight } from '../world/DayNight'
import { Water } from '../world/Water'
import { BoulderField } from '../world/BoulderField'
import { BuildSite } from '../world/BuildSite'
import { TreeField } from '../world/TreeField'
import { LogField } from '../cargo/logs/LogField'
import { SessionKeeper } from '../world/SessionKeeper'
import { Discoveries } from '../world/Discoveries'
import { Headlights } from '../world/Headlights'
import { DemolitionSite } from '../world/DemolitionSite'
import { ScrapField } from '../cargo/scrap/ScrapField'
import { useLevel } from '../stores/progressStore'
import { DEMOLISH_LEVEL, OFFICE_LEVEL } from '../missions/levels'
import { CitySite } from '../world/CitySite'

/** URL に ?physics を付けると当たり判定の形を表示する（開発用） */
const physicsDebug = new URLSearchParams(location.search).has('physics')

/** 開発時のみ：描画の負荷（ドローコール数など）をコンソールや自動テストから見られるようにする */
function DevRendererInfo() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign((window as unknown as { __game: object }).__game ?? {}, { renderer: gl })
  }, [gl])
  return null
}

function Scene() {
  const excavator = useRef<THREE.Group>(null)
  const dumpTruck = useRef<THREE.Group>(null)
  const bulldozer = useRef<THREE.Group>(null)
  const crane = useRef<THREE.Object3D>(null)
  const targets = useMemo(() => ({ excavator, dumpTruck, bulldozer, crane }), [])
  const active = useGameStore((s) => s.activeVehicle)
  // Lv7 から：古いビルとリサイクル場、がれき
  const level = useLevel().level
  const demolish = level >= DEMOLISH_LEVEL

  return (
    <>
      <DayNight />
      <Headlights />
      <SunLight target={targets[active]} />
      <Ground />
      <Environment />
      <Water />
      <BoulderField />
      <BuildSite />
      {/* Lv8 からビル、Lv9 からタワー */}
      {level >= OFFICE_LEVEL && <CitySite />}
      <Discoveries />
      <PhysicsWorld debug={physicsDebug}>
        <RockField />
        {ALL_MOUNDS.map((m) => (
          <DirtMound key={m.id} config={m} />
        ))}
        <Excavator rootRef={excavator} />
        <DumpTruck rootRef={dumpTruck} />
        <Bulldozer rootRef={bulldozer} />
        <Crane anchorRef={crane} />
        <CraneLoads />
        <LogField />
        {demolish && (
          <>
            <ScrapField />
            <DemolitionSite />
          </>
        )}
        <TreeField />
        <SessionKeeper />
        <CraneGames />
      </PhysicsWorld>
      <DeliveryZone />
      <GuideArrow targets={targets} />
      <TruckCargoBadge truck={dumpTruck} />
      <CompassArrows targets={targets} />
      <ExplorationTracker />
      <DevRendererInfo />
      <DigEffects />
      <GoldBeacon />
      <FollowCamera targets={targets} />
    </>
  )
}

export function GameCanvas() {
  return (
    <Canvas
      className="game-canvas"
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 50, near: 0.3, far: 420, position: [-5, 7, -10] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Scene />
    </Canvas>
  )
}
