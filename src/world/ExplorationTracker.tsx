import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useExplorationStore } from '../stores/explorationStore'
import { excavatorSensors } from '../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../vehicles/bulldozer/bulldozerSensors'

const CHECK_INTERVAL = 0.5

/** 車両が走ったまわりを「行った場所」として地図に記録する（3D には何も描かない） */
export function ExplorationTracker() {
  const timer = useRef(0)

  // はじめは基地のまわりだけ見えている
  useEffect(() => {
    useExplorationStore.getState().reveal(0, 10)
  }, [])

  useFrame((_, dt) => {
    timer.current += dt
    if (timer.current < CHECK_INTERVAL) return
    timer.current = 0
    const reveal = useExplorationStore.getState().reveal
    reveal(excavatorSensors.x, excavatorSensors.z)
    reveal(dumpTruckSensors.x, dumpTruckSensors.z)
    reveal(bulldozerSensors.x, bulldozerSensors.z)
  })

  return null
}
