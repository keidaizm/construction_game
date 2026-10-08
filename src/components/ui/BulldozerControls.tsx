import { PART_COLORS } from '../../vehicles/shared/materials'
import { BulldozerSidePictogram, BulldozerTopIcon } from './icons'
import { GearToggle } from './GearToggle'
import { Joystick } from './Joystick'
import { Lever } from './Lever'

const ARROW_POS = { x: 30, y: 12 }

/**
 * ブルドーザー用のタッチ操作パネル。
 * 左下：運転（ショベルと同じ履帯の動き）・速さの切り替え / 右：排土板の上げ下げ
 */
export function BulldozerControls() {
  return (
    <div className="controls-overlay">
      <div className="drive-zone">
        <Joystick icon={<BulldozerTopIcon />} label="うんてん" />
        <GearToggle />
      </div>

      <div className="work-zone">
        <div className="work-zone__levers">
          <Lever
            axis="blade"
            orientation="vertical"
            color={PART_COLORS.blade}
            label="ブレード"
            positiveIcon={<BulldozerSidePictogram lift={1} color={PART_COLORS.blade} arrow={{ kind: 'up', ...ARROW_POS }} />}
            negativeIcon={<BulldozerSidePictogram lift={0} color={PART_COLORS.blade} arrow={{ kind: 'down', ...ARROW_POS }} />}
          />
        </div>
      </div>
    </div>
  )
}
