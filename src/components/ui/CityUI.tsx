import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useLevel } from '../../stores/progressStore'
import { useCityStore } from '../../stores/cityStore'
import { useScrapStore } from '../../stores/scrapStore'
import { OFFICE_LEVEL, TOWER_LEVEL } from '../../missions/levels'
import { OFFICE, OFFICE_FLOOR_COST, OFFICE_PLOTS, TOWER_RING, TOWER_STAGES, TOWER_STAGE_COST, officeRing } from '../../world/cityLayout'
import { excavatorSensors } from '../../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../../vehicles/bulldozer/bulldozerSensors'
import { MissionFrame, RockIcon } from './MissionUI'
import { SteelBeamIcon } from './icons'

/** 資材置き場からこの距離 [m] までは、ビル・タワーづくりの様子を出す */
const NEAR = 26

export type CityKind = 'office' | 'tower'

function vehiclePos() {
  const v = useGameStore.getState().activeVehicle
  if (v === 'dumpTruck') return dumpTruckSensors
  if (v === 'bulldozer') return bulldozerSensors
  return excavatorSensors
}

/** 工事現場の近くにいるか（近い方の資材置き場）。ときどき調べる */
export function useCityMode(): CityKind | null {
  const level = useLevel().level
  const [kind, setKind] = useState<CityKind | null>(null)
  useEffect(() => {
    if (level < OFFICE_LEVEL) {
      setKind(null)
      return
    }
    const check = () => {
      if (useGameStore.getState().activeVehicle === 'crane') return setKind(null)
      const p = vehiclePos()
      const city = useCityStore.getState()
      let best: CityKind | null = null
      let bestD = NEAR
      if (city.offices < OFFICE_PLOTS.length) {
        const r = officeRing(city.offices)
        const d = Math.hypot(p.x - r.x, p.z - r.z)
        if (d < bestD) {
          bestD = d
          best = 'office'
        }
      }
      if (level >= TOWER_LEVEL && city.towerStage < TOWER_STAGES.length) {
        const d = Math.hypot(p.x - TOWER_RING.x, p.z - TOWER_RING.z)
        if (d < bestD) best = 'tower'
      }
      setKind(best)
    }
    check()
    const id = setInterval(check, 500)
    return () => clearInterval(id)
  }, [level])
  return kind
}

/** 画面上の表示：「ビルを たてよう！ 2かいめ」・石（置くたびに色がつく）・てっこつ（持っている数で足りるか） */
export function CityBanner({ kind }: { kind: CityKind }) {
  const city = useCityStore()
  const steel = useScrapStore((s) => s.steel)
  const cost = kind === 'office' ? OFFICE_FLOOR_COST : TOWER_STAGE_COST
  const stones = kind === 'office' ? city.officeStones : city.towerStones
  const enoughSteel = steel >= cost.steel
  return (
    <MissionFrame rest={Math.max(0, cost.stones - stones)} over={0}>
      <div className="mission__title">
        {kind === 'office' ? (
          <>
            ビルを たてよう！ <b>{city.officeFloors + 1}</b>かいめ / {OFFICE.floors}
          </>
        ) : (
          <>
            タワーを たてよう！ <b>{city.towerStage + 1}</b>だんめ / {TOWER_STAGES.length}
          </>
        )}
      </div>
      <div className="mission__parts">
        <span className="mission__progress">
          <span className="mission__slots">
            {Array.from({ length: cost.stones }, (_, i) => (
              <RockIcon key={`${i}-${i < stones}`} filled={i < stones} />
            ))}
          </span>
          <span className="mission__count">
            <b>{stones}</b> / {cost.stones}
          </span>
        </span>
        <span className="mission__progress">
          <span className="mission__slots steel-slots">
            {Array.from({ length: cost.steel }, (_, i) => (
              <SteelBeamIcon key={i} faded={i >= steel} />
            ))}
          </span>
          <span className="mission__count">
            <b>{Math.min(steel, cost.steel)}</b> / {cost.steel}
          </span>
        </span>
      </div>
      <div className="mission__sub">
        {enoughSteel ? (
          <span className="mission__note">きいろい わに いしを おこう（もっている てっこつ {steel}ほん）</span>
        ) : (
          <span className="mission__over">てっこつが たりない！ ふるい ビルを こわして あつめよう</span>
        )}
      </div>
    </MissionFrame>
  )
}
