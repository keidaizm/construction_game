import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useLevel } from '../../stores/progressStore'
import { useScrapStore } from '../../stores/scrapStore'
import { DEMOLISH_LEVEL } from '../../missions/levels'
import { DEMOLITION_SITE, RECYCLE_YARD, STEEL_STARS } from '../../world/demolitionLayout'
import { building } from '../../world/demolition'
import { scrapRegistry } from '../../cargo/scrap/scrapRegistry'
import { excavatorSensors } from '../../vehicles/excavator/excavatorSensors'
import { dumpTruckSensors } from '../../vehicles/dumpTruck/dumpTruckSensors'
import { bulldozerSensors } from '../../vehicles/bulldozer/bulldozerSensors'
import { MissionFrame, Overlay } from './MissionUI'
import { SteelBeamIcon } from './icons'

/** ビルからこの距離 [m] までと、リサイクル場からこの距離までは、てっこつ集めのお題を出す */
const NEAR_SITE = 40
const NEAR_YARD = 22

/** いまの手順（何をすればよいか） */
type Step = 'break' | 'sift' | 'carry'

function vehiclePos() {
  const v = useGameStore.getState().activeVehicle
  if (v === 'dumpTruck') return dumpTruckSensors
  if (v === 'bulldozer') return bulldozerSensors
  return excavatorSensors
}

/** つぎにすること：ふるう前のがれきがあれば「ふるう」、鉄骨があれば「はこぶ」、なければ「こわす」 */
function currentStep(): Step {
  let mixed = 0
  let steel = 0
  for (const p of scrapRegistry.pieces) {
    if (p.state === 'pooled') continue
    if (p.kind === 'mixed') mixed++
    else steel++
  }
  if (steel > 0 && mixed === 0) return 'carry'
  if (mixed > 0) return 'sift'
  return building.floors > 0 ? 'break' : 'sift'
}

/**
 * てっこつ集めのお題を出すか（Lv7 から）：ビル・リサイクル場の近くにいるか、がれきを積んだダンプに乗っているとき。
 * 毎フレームではなく、ときどき調べる
 */
export function useSteelMode() {
  const level = useLevel()
  const [state, setState] = useState<{ on: boolean; step: Step }>({ on: false, step: 'break' })
  const enabled = level.level >= DEMOLISH_LEVEL
  useEffect(() => {
    if (!enabled) {
      setState({ on: false, step: 'break' })
      return
    }
    const check = () => {
      const p = vehiclePos()
      const active = useGameStore.getState().activeVehicle
      const on =
        active !== 'crane' &&
        (Math.hypot(p.x - DEMOLITION_SITE.x, p.z - DEMOLITION_SITE.z) < NEAR_SITE ||
          Math.hypot(p.x - RECYCLE_YARD.x, p.z - RECYCLE_YARD.z) < NEAR_YARD ||
          (active === 'dumpTruck' && dumpTruckSensors.loadedScrap > 0))
      const step = currentStep()
      setState((s) => (s.on === on && s.step === step ? s : { on, step }))
    }
    check()
    const id = setInterval(check, 500)
    return () => clearInterval(id)
  }, [enabled])
  return state.on ? state : null
}

const STEP_TEXT: Record<Step, string> = {
  break: 'ブレーカーで ビルを こわそう',
  sift: 'スケルトンバケットで すくって、レバーで ゆらして ふるおう',
  carry: 'てっこつを ダンプで みどりの ばしょへ',
}

/** 画面上のお題：「てっこつを 5ほん あつめよう！」・鉄骨の絵（集めるたびに色がつく）・いまの手順・足し算の式 */
export function SteelBanner() {
  const mode = useSteelMode()
  const target = useScrapStore((s) => s.target)
  const loads = useScrapStore((s) => s.loads)
  const have = loads.reduce((n, k) => n + k, 0)
  return (
    <MissionFrame rest={Math.max(0, target - have)} over={0} unit="ほん">
      <div className="mission__title">
        てっこつを <b>{target}</b>ほん あつめよう！
      </div>
      <div className="mission__progress">
        <span className="mission__slots steel-slots">
          {Array.from({ length: target }, (_, i) => (
            <SteelBeamIcon key={`${i}-${i < have}`} faded={i >= have} />
          ))}
        </span>
        <span className="mission__count">
          <b>{have}</b> / {target}
        </span>
      </div>
      <div className="mission__sub">
        {mode && <span className="mission__note">{STEP_TEXT[mode.step]}</span>}
        {loads.length > 1 && (
          <span className="mission__equation">
            {loads.join(' + ')} = {have}
          </span>
        )}
      </div>
    </MissionFrame>
  )
}

/** てっこつ集めのクリア：もらった星・運んだ回ごとの足し算（鉄骨の絵つき）・持っている てっこつの数 */
export function SteelClearOverlay() {
  const cleared = useScrapStore((s) => s.cleared)
  const steel = useScrapStore((s) => s.steel)
  const next = useScrapStore((s) => s.nextQuest)
  if (!cleared) return null
  const total = cleared.loads.reduce((n, k) => n + k, 0)
  const terms = cleared.loads.length > 1 ? [...cleared.loads, total] : [total]
  return (
    <Overlay confetti>
      <div className="clear__stars" aria-label={`ほし ${STEEL_STARS}こ`}>
        {Array.from({ length: STEEL_STARS }, (_, i) => (
          <span key={i}>★</span>
        ))}
      </div>
      <div className="clear__title">てっこつ あつまった！</div>
      <div className="clear__equation">
        {terms.map((n, i) => (
          <span key={i} className="clear__part">
            {i > 0 && <span className="clear__op">{i === terms.length - 1 ? '=' : '+'}</span>}
            <span className="term">
              <span className="term__num">{n}</span>
              <span className="term__dots steel-dots">
                {Array.from({ length: n }, (_, k) => (
                  <SteelBeamIcon key={k} />
                ))}
              </span>
            </span>
          </span>
        ))}
      </div>
      <ul className="clear__hints">
        <li className="is-got">もっている てっこつ：{steel}ほん</li>
      </ul>
      <button type="button" className="clear__next" onClick={next}>
        つぎへ ▶
      </button>
    </Overlay>
  )
}
