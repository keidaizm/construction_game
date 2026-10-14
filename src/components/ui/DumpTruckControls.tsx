import { PART_COLORS } from '../../vehicles/shared/materials'
import { TruckSidePictogram, TruckTopIcon } from './icons'
import { Joystick } from './Joystick'
import { Lever } from './Lever'

const ARROW_POS = { x: 54, y: 12 }

/**
 * ダンプカー用のタッチ操作パネル。
 * 左下：運転（上 = 進む、下 = バック、左右 = ハンドル） / 右：荷台の上げ下げ
 */
export function DumpTruckControls() {
  return (
    <div className="controls-overlay">
      <div className="drive-zone">
        <Joystick icon={<TruckTopIcon />} label="うんてん" />
      </div>

      <div className="work-zone">
        <div className="work-zone__levers">
          <Lever
            axis="bed"
            orientation="vertical"
            color={PART_COLORS.bed}
            label="にだい"
            positiveIcon={<TruckSidePictogram bedAngle={35} color={PART_COLORS.bed} arrow={{ kind: 'up', ...ARROW_POS }} />}
            negativeIcon={<TruckSidePictogram bedAngle={0} color={PART_COLORS.bed} arrow={{ kind: 'down', ...ARROW_POS }} />}
          />
        </div>
      </div>
    </div>
  )
}
