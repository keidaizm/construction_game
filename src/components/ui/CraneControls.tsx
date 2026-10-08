import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useCraneStore, type CraneGame } from '../../stores/craneStore'
import { useLevel } from '../../stores/progressStore'
import { PART_COLORS } from '../../vehicles/shared/materials'
import { CRANE } from '../../vehicles/crane/craneConfig'
import { excavatorSensors } from '../../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../../vehicles/bulldozer/bulldozerSensors'
import type { VehicleId } from '../../vehicles/types'
import { Lever } from './Lever'
import { CraneIcon, CraneSidePictogram, CraneSlewPictogram, GrabIcon, LockIcon } from './icons'

const C = PART_COLORS
const SENSORS = { excavator: excavatorSensors, dumpTruck: dumpTruckSensors, bulldozer: bulldozerSensors } as const

/** 乗っている車両が、クレーンの近くにいるか（0.3 秒ごとに調べる） */
function useNearCrane(vehicle: VehicleId) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (vehicle === 'crane') return
    const check = () => {
      const s = SENSORS[vehicle]
      setNear(Math.hypot(s.x - CRANE.x, s.z - CRANE.z) < CRANE.boardRadius)
    }
    check()
    const id = setInterval(check, 300)
    return () => clearInterval(id)
  }, [vehicle])
  return vehicle !== 'crane' && near
}

/**
 * クレーンの近くに来ると出る「クレーンに のる？」ボタン（画面の下のまん中）。
 * Lv3 より前は鍵の絵と「Lv3 で のれるよ」（押せない）。
 */
export function CraneBoardPrompt({ vehicle }: { vehicle: VehicleId }) {
  const near = useNearCrane(vehicle)
  const level = useLevel()
  const board = useGameStore((s) => s.boardCrane)
  if (!near) return null
  const locked = level.level < CRANE.unlockLevel
  return (
    <button type="button" className={`crane-board${locked ? ' is-locked' : ''}`} onClick={locked ? undefined : board} disabled={locked} aria-label="クレーンに のる">
      <span className="crane-board__icon">
        <CraneIcon />
        {locked && (
          <span className="crane-board__lock">
            <LockIcon />
          </span>
        )}
      </span>
      <span className="crane-board__text">{locked ? `Lv${CRANE.unlockLevel} で のれるよ` : 'クレーンに のる？'}</span>
    </button>
  )
}

/** つかむ／はなすボタン（つかめるときは緑に光る） */
function GrabButton() {
  const canGrab = useCraneStore((s) => s.canGrab)
  const holding = useCraneStore((s) => s.holding)
  const press = useCraneStore((s) => s.pressGrab)
  return (
    <button
      type="button"
      className={`grab-button${canGrab ? ' is-ready' : ''}${holding ? ' is-holding' : ''}`}
      aria-label={holding ? 'はなす' : 'つかむ'}
      onClick={press}
    >
      <GrabIcon holding={holding} />
      <span className="grab-button__label">{holding ? 'はなす' : 'つかむ'}</span>
    </button>
  )
}

/** 乗ったときに出る、あそびをえらぶ画面 */
function GameMenu() {
  const setGame = useCraneStore((s) => s.setGame)
  const pick = (g: CraneGame) => () => setGame(g)
  return (
    <div className="crane-menu" role="dialog" aria-label="あそびを えらぶ">
      <button type="button" className="crane-menu__card" onClick={pick('containers')}>
        <span className="crane-menu__art" aria-hidden>
          <span className="crane-menu__box" style={{ background: '#e05a3a' }}>3</span>
          <span className="crane-menu__box" style={{ background: '#2f80ed' }}>5</span>
          <span className="crane-menu__plus">2+3</span>
        </span>
        <span className="crane-menu__title">コンテナ はこび</span>
        <span className="crane-menu__sub">しきに あう かずを はこぼう</span>
      </button>
      <button type="button" className="crane-menu__card" onClick={pick('tower')}>
        <span className="crane-menu__art crane-menu__art--tower" aria-hidden>
          <span style={{ width: '40%', background: '#d64545' }} />
          <span style={{ width: '25%', background: '#17a2a2' }} />
          <span style={{ width: '70%', background: '#ff8a00' }} />
          <span style={{ width: '50%', background: '#2f80ed' }} />
        </span>
        <span className="crane-menu__title">つみき タワー</span>
        <span className="crane-menu__sub">どこまで たかく つめるかな</span>
      </button>
    </div>
  )
}

/** 上のまん中：いまのミニゲームのお題（ミッションの表示のかわり） */
export function CraneBanner() {
  const game = useCraneStore((s) => s.game)
  const question = useCraneStore((s) => s.question)
  const feedback = useCraneStore((s) => s.feedback)
  const solved = useCraneStore((s) => s.solved)
  const height = useCraneStore((s) => s.towerHeight)
  const best = useCraneStore((s) => s.towerBest)
  const setGame = useCraneStore((s) => s.setGame)
  if (!game) return null
  return (
    <div className="mission crane-banner" aria-live="polite">
      {game === 'containers' ? (
        <>
          <div className="crane-banner__eq">
            {question.a} + {question.b} = <b className={feedback?.kind === 'correct' ? 'is-correct' : ''}>{feedback?.kind === 'correct' ? question.a + question.b : '？'}</b>
          </div>
          <div className="mission__title">
            {feedback?.kind === 'correct'
              ? 'せいかい！'
              : feedback?.kind === 'wrong'
                ? `${feedback.number} じゃないよ。もう いちど！`
                : 'こたえの コンテナを きいろい だいに のせよう'}
          </div>
          {solved > 0 && <div className="mission__sub">せいかい {solved}かい</div>}
        </>
      ) : (
        <>
          <div className="crane-banner__eq">
            たかさ <b>{height.toFixed(1)}</b>m
          </div>
          <div className="mission__title">ブロックを どだいに たかく つもう！</div>
          <div className="mission__sub">さいこう {best.toFixed(1)}m</div>
        </>
      )}
      <button type="button" className="crane-banner__change" onClick={() => setGame(null)}>
        あそびを かえる
      </button>
    </div>
  )
}

/**
 * クレーン用のタッチ操作パネル。
 * 左下：旋回（腕を左右に回す）/ 右：トロリー（横）・フックの上げ下げ（縦）・つかむ／はなす / 右上：おりる
 * 横から見る画面では、トロリーの「外へ」が画面の右になる。
 */
export function CraneControls() {
  const leave = useGameStore((s) => s.leaveCrane)
  const game = useCraneStore((s) => s.game)
  return (
    <div className="controls-overlay">
      <div className="drive-zone crane-slew">
        <Lever
          axis="swing"
          orientation="horizontal"
          color={C.swing}
          label="まわす"
          negativeIcon={<CraneSlewPictogram direction="left" color={C.swing} />}
          positiveIcon={<CraneSlewPictogram direction="right" color={C.swing} />}
        />
      </div>

      <div className="work-zone">
        <Lever
          axis="arm"
          orientation="horizontal"
          color={C.arm}
          label="トロリー"
          negativeIcon={<CraneSidePictogram part="trolley" color={C.arm} trolleyX={22} arrow={{ kind: 'left', x: 40, y: 32 }} />}
          positiveIcon={<CraneSidePictogram part="trolley" color={C.arm} trolleyX={52} arrow={{ kind: 'right', x: 30, y: 32 }} />}
        />
        <div className="work-zone__levers">
          <Lever
            axis="boom"
            orientation="vertical"
            color={C.boom}
            label="フック"
            positiveIcon={<CraneSidePictogram part="hook" color={C.boom} hookY={24} arrow={{ kind: 'up', x: 54, y: 40 }} />}
            negativeIcon={<CraneSidePictogram part="hook" color={C.boom} hookY={46} arrow={{ kind: 'down', x: 54, y: 30 }} />}
          />
          <GrabButton />
        </div>
      </div>

      <button type="button" className="switch-button crane-leave" aria-label="クレーンから おりる" onClick={leave}>
        <CraneIcon />
        <span className="crane-leave__label">おりる</span>
      </button>
      {!game && <GameMenu />}
    </div>
  )
}
