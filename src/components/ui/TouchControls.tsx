import { nextVehicle, useGameStore } from '../../stores/gameStore'
import type { VehicleId } from '../../vehicles/types'
import { BulldozerControls } from './BulldozerControls'
import { DumpTruckControls } from './DumpTruckControls'
import { ExcavatorControls } from './ExcavatorControls'
import { CraneBoardPrompt, CraneControls } from './CraneControls'
import { BaseEnterPrompt } from './BaseRooms'
import { BulldozerSidePictogram, CraneIcon, ExcavatorSideIcon, SwapBadge, TruckSidePictogram } from './icons'

const PANELS: Record<VehicleId, () => React.JSX.Element> = {
  excavator: ExcavatorControls,
  dumpTruck: DumpTruckControls,
  bulldozer: BulldozerControls,
  crane: CraneControls,
}

const NAMES: Record<VehicleId, string> = { excavator: 'ショベルカー', dumpTruck: 'ダンプカー', bulldozer: 'ブルドーザー', crane: 'クレーン' }

const ICONS: Record<VehicleId, () => React.JSX.Element> = {
  excavator: () => <ExcavatorSideIcon />,
  dumpTruck: () => <TruckSidePictogram bedAngle={0} color="#f2b705" />,
  bulldozer: () => <BulldozerSidePictogram lift={0.3} color="#f2b705" />,
  crane: () => <CraneIcon />,
}

/** 乗っている車両に合わせて操作パネルを切り替える */
export function TouchControls() {
  const vehicle = useGameStore((s) => s.activeVehicle)
  const Panel = PANELS[vehicle]
  return (
    <>
      <Panel />
      {/* クレーンでは「のりかえ」のかわりに「おりる」（CraneControls） */}
      {vehicle !== 'crane' && <VehicleSwitchButton current={vehicle} />}
      <CraneBoardPrompt vehicle={vehicle} />
      <BaseEnterPrompt vehicle={vehicle} />
    </>
  )
}

/** 右上の「のりかえ」ボタン。次に乗る車両の絵を出す */
function VehicleSwitchButton({ current }: { current: VehicleId }) {
  const switchVehicle = useGameStore((s) => s.switchVehicle)
  const next = nextVehicle(current)
  const Icon = ICONS[next]
  return (
    <button type="button" className="switch-button" aria-label={`${NAMES[next]}にのりかえる`} onClick={switchVehicle}>
      <Icon />
      <span className="switch-button__badge">
        <SwapBadge />
      </span>
    </button>
  )
}
