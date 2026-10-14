import { PART_COLORS } from '../../vehicles/shared/materials'
import { ArmPictogram, SwingPictogram } from './icons'
import { Joystick } from './Joystick'
import { Lever } from './Lever'
import { ToolToggle } from './ToolToggle'

const C = PART_COLORS
const ARROW_POS = { x: 52, y: 12 }

/**
 * ショベルカー用のタッチ操作パネル。
 * 左下：走行ジョイスティック / 右：上部旋回（横）＋ブーム・アーム・バケット（縦）
 */
export function ExcavatorControls() {
  return (
    <div className="controls-overlay">
      <div className="drive-zone">
        <Joystick />
        <ToolToggle />
      </div>

      <div className="work-zone">
        <Lever
          axis="swing"
          orientation="horizontal"
          color={C.swing}
          label="まわる"
          negativeIcon={<SwingPictogram direction="left" color={C.swing} />}
          positiveIcon={<SwingPictogram direction="right" color={C.swing} />}
        />
        <div className="work-zone__levers">
          <Lever
            axis="boom"
            orientation="vertical"
            color={C.boom}
            label="ブーム"
            positiveIcon={
              <ArmPictogram
                pose={{ boom: 55, arm: -100, bucket: -40 }}
                highlight="boom"
                color={C.boom}
                arrow={{ kind: 'up', ...ARROW_POS }}
              />
            }
            negativeIcon={
              <ArmPictogram
                pose={{ boom: 5, arm: -95, bucket: -40 }}
                highlight="boom"
                color={C.boom}
                arrow={{ kind: 'down', ...ARROW_POS }}
              />
            }
          />
          <Lever
            axis="arm"
            orientation="vertical"
            color={C.arm}
            label="アーム"
            positiveIcon={
              <ArmPictogram
                pose={{ boom: 35, arm: -45, bucket: -40 }}
                highlight="arm"
                color={C.arm}
                arrow={{ kind: 'right', ...ARROW_POS }}
              />
            }
            negativeIcon={
              <ArmPictogram
                pose={{ boom: 35, arm: -140, bucket: -40 }}
                highlight="arm"
                color={C.arm}
                arrow={{ kind: 'left', ...ARROW_POS }}
              />
            }
          />
          <Lever
            axis="bucket"
            orientation="vertical"
            color={C.bucket}
            label="バケット"
            positiveIcon={
              <ArmPictogram
                pose={{ boom: 30, arm: -95, bucket: 30 }}
                highlight="bucket"
                color={C.bucket}
                arrow={{ kind: 'ccw', ...ARROW_POS }}
              />
            }
            negativeIcon={
              <ArmPictogram
                pose={{ boom: 30, arm: -95, bucket: -110 }}
                highlight="bucket"
                color={C.bucket}
                arrow={{ kind: 'cw', ...ARROW_POS }}
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
