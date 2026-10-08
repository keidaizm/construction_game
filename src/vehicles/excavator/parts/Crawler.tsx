import type { RefObject } from 'react'
import { EXCAVATOR } from '../excavatorConfig'
import { darkSteel } from '../../shared/materials'
import { TrackPair, type TrackTravel } from '../../shared/Tracks'

export type { TrackTravel }

const { trackGauge, trackLength, trackRadius, trackWidth } = EXCAVATOR.geometry
const SIZE = { gauge: trackGauge, length: trackLength, radius: trackRadius, width: trackWidth }

/** ショベルの下部走行体：左右の履帯＋センターフレーム＋旋回ベアリング */
export function Crawler({ travel }: { travel: RefObject<TrackTravel> }) {
  return (
    <group>
      <TrackPair travel={travel} size={SIZE} />
      <mesh position-y={0.62} material={darkSteel}>
        <boxGeometry args={[trackGauge * 2 - trackWidth * 0.8, 0.45, 2.1]} />
      </mesh>
      <mesh position-y={0.93} material={darkSteel}>
        <cylinderGeometry args={[0.85, 0.85, 0.16, 20]} />
      </mesh>
    </group>
  )
}
