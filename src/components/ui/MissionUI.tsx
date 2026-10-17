import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { colorKinds, ignoredCount, overColors, remainingOf, useMissionStore, type ColorCounts } from '../../stores/missionStore'
import { useProgressStore } from '../../stores/progressStore'
import { BREAKER_LEVEL, DEMOLISH_LEVEL, FELL_LEVEL, GRAPPLE_LEVEL, LEVELS, OFFICE_LEVEL, SKYSCRAPER_LEVEL, TOWER_LEVEL, levelForStars, type MissionKind, type MissionPart } from '../../missions/levels'
import { ROCK_COLORS, ROCK_COLOR_ORDER, type RockColor } from '../../cargo/rocks/rockTypes'
import { audio } from '../../audio/AudioManager'
import { CraneBanner } from './CraneControls'
import { useCelebrationStore } from '../../stores/celebrationStore'
import { CRANE } from '../../vehicles/crane/craneConfig'
import { SteelBanner, useSteelMode } from './SteelUI'
import { CityBanner, useCityMode } from './CityUI'
import { useScrapStore } from '../../stores/scrapStore'

/** 岩の絵 1 個。color = 岩の色／filled = 運び終わった／over = 多すぎた分 */
export function RockIcon({ color = 'gray', filled, over = false }: { color?: RockColor; filled: boolean; over?: boolean }) {
  const c = ROCK_COLORS[color]
  const fill = over ? '#ff8a80' : filled ? c.icon : 'rgba(255,255,255,0.6)'
  const stroke = over ? '#e53935' : filled ? c.outline : c.outline + '99'
  return (
    <svg viewBox="0 0 32 32" className={`rock-icon${filled ? ' rock-icon--filled' : ''}`} aria-hidden>
      <path
        d="M 5 21 L 8 11 L 16 6 L 25 9 L 28 19 L 22 26 L 11 27 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={2.2}
        strokeDasharray={filled ? undefined : '4 3'}
        strokeLinejoin="round"
      />
      {filled && <path d="M 10 13 L 16 9 L 21 11" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={2} strokeLinecap="round" />}
    </svg>
  )
}

interface TermValue {
  n: number
  /** その数の岩の色 */
  color?: RockColor
  /** 岩の絵を 1 こずつ色分けするとき（合計の「= 5」を、くろ 3 ＋ あか 2 の色で並べる） */
  dots?: RockColor[]
}

/** 数の下に、その数だけ岩の絵を並べる（数字と量を結び付ける） */
function Term({ n, color, dots }: TermValue) {
  return (
    <span className="term">
      <span className="term__num">{n}</span>
      <span className="term__dots">
        {Array.from({ length: n }, (_, i) => (
          <RockIcon key={i} color={dots?.[i] ?? color} filled />
        ))}
      </span>
    </span>
  )
}

/** 足し算の式（2 + 3 = 5）を、数の下に岩の絵つきで大きく出す */
function BigEquation({ terms, total }: { terms: TermValue[]; total: number }) {
  return (
    <div className="clear__equation">
      {terms.map((t, i) => (
        <span key={i} className="clear__part">
          {i > 0 && <span className="clear__op">+</span>}
          <Term {...t} />
        </span>
      ))}
      {terms.length > 1 && (
        <span className="clear__part">
          <span className="clear__op">=</span>
          <Term n={total} dots={terms.flatMap((t) => Array.from({ length: t.n }, () => t.color ?? 'gray'))} />
        </span>
      )}
    </div>
  )
}

/** ひき算の式（8 − 3 = 5）。とった数の岩はうすく描く */
function SubtractEquation({ start, result }: { start: number; result: number }) {
  return (
    <div className="clear__equation">
      <span className="clear__part">
        <Term n={start} />
      </span>
      <span className="clear__part">
        <span className="clear__op">−</span>
        <span className="term--removed">
          <Term n={start - result} />
        </span>
      </span>
      <span className="clear__part">
        <span className="clear__op">=</span>
        <Term n={result} />
      </span>
    </div>
  )
}

/**
 * 式の数。
 * - はこぼう（2 色以上）・つくろう：色ごとの数（くろ 3 ＋ ふつう 2）
 * - はこぼう（1 色）：運んだ回ごとの数（2 回目 ＋ 3 回目）
 */
function equationTerms(kind: MissionKind, parts: readonly MissionPart[], counts: ColorCounts, loads: { count: number }[]): TermValue[] {
  if (kind === 'make') return ROCK_COLOR_ORDER.map((c) => ({ n: counts[c] ?? 0, color: c })).filter((t) => t.n > 0)
  if (parts.length >= 2) return parts.map((p) => ({ n: counts[p.color] ?? 0, color: p.color })).filter((t) => t.n > 0)
  return loads.map((l) => ({ n: l.count, color: parts[0]?.color }))
}

/** 色がまざった行（つくろう・とりのぞこう）：入っている石を色ごとに並べ、残りは空の枠 */
function MixedRow({ counts, target, have }: { counts: ColorCounts; target: number; have: number }) {
  const colors = ROCK_COLOR_ORDER.flatMap((c) => Array.from({ length: counts[c] ?? 0 }, () => c))
  const slots = Math.max(target, have)
  return (
    <div className="mission__progress">
      <span className="mission__slots">
        {Array.from({ length: slots }, (_, i) => (
          <RockIcon key={i + '-' + (colors[i] ?? 'x')} color={colors[i] ?? 'gray'} filled={i < have} over={i >= target} />
        ))}
      </span>
      <span className="mission__count">
        <b>{have}</b> / {target}
      </span>
    </div>
  )
}

/** 1 色ぶんの行：先頭にその色の岩（どの色の行か分かるように）・岩の絵（運ぶたびに埋まる）・「2 / 3」 */
function PartRow({ part, have }: { part: MissionPart; have: number }) {
  const slots = Math.max(part.count, have)
  return (
    <div className="mission__progress">
      <span className="mission__chip">
        <RockIcon color={part.color} filled />
      </span>
      <span className="mission__slots">
        {Array.from({ length: slots }, (_, i) => (
          // 埋まった瞬間に key が変わり、ぽよんとアニメーションする
          <RockIcon key={`${i}-${i < have}`} color={part.color} filled={i < have} over={i >= part.count} />
        ))}
      </span>
      <span className="mission__count">
        <b>{have}</b> / {part.count}
      </span>
    </div>
  )
}

/** 2 色以上のときの、1 色ぶんの小さなチップ：その色の岩・「2/3」・運ぶたびに埋まる小さな丸 */
function PartChip({ part, have }: { part: MissionPart; have: number }) {
  const slots = Math.max(part.count, have)
  const c = ROCK_COLORS[part.color]
  return (
    <span className="mission__part">
      <span className="mission__part-head">
        <RockIcon color={part.color} filled />
        <span className="mission__count">
          <b>{have}</b>/{part.count}
        </span>
      </span>
      <span className="mission__dots">
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={`${i}-${i < have}`}
            className={`mission__dot${i < have ? ' is-filled' : ''}${i >= part.count ? ' is-over' : ''}`}
            style={i < have && i < part.count ? { background: c.icon, borderColor: c.outline } : undefined}
          />
        ))}
      </span>
    </span>
  )
}

/**
 * ミッション表示の枠：左に「あと ◯こ」（多すぎたら「おおい ◯こ」）を大きく、右にお題と進み具合
 * （ユーザー要望：色が多いと上のまん中をとりすぎる。「あと ◯こ」は左に）
 */
export function MissionFrame({ rest, over, unit = 'こ', children }: { rest: number; over: number; unit?: string; children: ReactNode }) {
  return (
    <div className="mission mission--row" aria-live="polite">
      <div className={`mission__side${over > 0 ? ' is-over' : rest === 0 ? ' is-done' : ''}`}>
        {over > 0 ? (
          <>
            <small>おおい</small>
            <b>{over}</b>
            <small>{unit}</small>
          </>
        ) : rest > 0 ? (
          <>
            <small>あと</small>
            <b>{rest}</b>
            <small>{unit}</small>
          </>
        ) : (
          <b>OK</b>
        )}
      </div>
      <div className="mission__main">{children}</div>
    </div>
  )
}

/**
 * 画面上部のミッション表示（種類ごと）
 * - はこぼう：「くろい いしを 3こ ぴったり はこぼう！」・色ごとの行・あと 3こ／1こ おおい・足し算の式
 * - つくろう：「すきな いろの いしを あわせて ぴったり 10こ！」・入っている石・あと／おおい・色ごとの式
 * - とりのぞこう：「おきばの いしを とりのぞいて 5こに しよう！」・入っている石・あと ◯こ とりのぞく・ひき算の式
 */
export function MissionBanner() {
  const { kind, parts, colorCounts, loads, target, delivered, startCount } = useMissionStore()
  // クレーンに乗っている間は、クレーンのミニゲームのお題を出す（CraneBanner）
  const onCrane = useGameStore((s) => s.activeVehicle === 'crane')
  // Lv7：ビル・リサイクル場の近くや、がれきを運んでいる間は、てっこつ集めのお題を出す
  const steelMode = useSteelMode()
  // Lv8・9：工事現場の近くでは、ビル・タワーづくりの様子を出す
  const cityMode = useCityMode()
  if (onCrane) return <CraneBanner />
  if (steelMode) return <SteelBanner />
  if (cityMode) return <CityBanner kind={cityMode} />
  if (kind === 'make') {
    const terms = equationTerms(kind, parts, colorCounts, loads)
    const oneColorOnly = delivered === target && colorKinds(colorCounts) < 2
    return (
      <MissionFrame rest={Math.max(0, target - delivered)} over={Math.max(0, delivered - target)}>
        <div className="mission__title">
          すきな いろの いしを あわせて ぴったり <b>{target}</b>こ！
        </div>
        <MixedRow counts={colorCounts} target={target} have={delivered} />
        <div className="mission__sub">
          {delivered < target && <span className="mission__note">2しゅるい いじょうの いろで</span>}
          {delivered > target && <span className="mission__over">ショベルで とりのぞこう</span>}
          {oneColorOnly && <span className="mission__over">ちがう いろも まぜてね！</span>}
          {terms.length > 1 && (
            <span className="mission__equation">
              {terms.map((t) => t.n).join(' + ')} = {delivered}
            </span>
          )}
        </div>
      </MissionFrame>
    )
  }
  if (kind === 'remove') {
    const removed = startCount - delivered
    return (
      <MissionFrame rest={Math.max(0, delivered - target)} over={0}>
        <div className="mission__title">
          おきばの いしを とりのぞいて ぴったり <b>{target}</b>こに しよう！
        </div>
        <MixedRow counts={colorCounts} target={target} have={delivered} />
        <div className="mission__sub">
          {delivered < target && (
            <span className="mission__over">
              とりすぎ！ <b>{target - delivered}</b>こ もどそう
            </span>
          )}
          {removed > 0 && removed <= startCount && (
            <span className="mission__equation">
              {startCount} − {removed} = {delivered}
            </span>
          )}
        </div>
      </MissionFrame>
    )
  }

  const rest = parts.reduce((n, p) => n + Math.max(0, remainingOf(parts, colorCounts, p.color)), 0)
  const over = overColors(parts, colorCounts)
  const firstOver = over[0]
  const overCount = firstOver ? -remainingOf(parts, colorCounts, firstOver) : 0
  const terms = equationTerms(kind, parts, colorCounts, loads)
  const single = parts.length === 1 ? parts[0] : null
  return (
    <MissionFrame rest={over.length === 0 ? rest : 0} over={overCount}>
      <div className="mission__title">
        {single ? (
          <>
            {ROCK_COLORS[single.color].label} いしを <b>{single.count}</b>こ ぴったり はこぼう！
          </>
        ) : (
          <>いしを ぴったり はこぼう！</>
        )}
      </div>
      {single ? (
        <PartRow part={single} have={colorCounts[single.color] ?? 0} />
      ) : (
        // 2 色以上は、色ごとのチップを横に並べる（縦に行を重ねると画面の上をとりすぎる）
        <div className="mission__parts">
          {parts.map((p) => (
            <PartChip key={p.color} part={p} have={colorCounts[p.color] ?? 0} />
          ))}
        </div>
      )}
      <div className="mission__sub">
        {firstOver && (
          <span className="mission__over">
            {ROCK_COLORS[firstOver].label} いしを とりのぞこう
          </span>
        )}
        {terms.length > 1 && (
          <span className="mission__equation">
            {terms.map((t) => t.n).join(' + ')} = {terms.reduce((n, t) => n + t.n, 0)}
          </span>
        )}
        {ignoredCount(parts, colorCounts) > 0 && <span className="mission__note">（ほかの いろは かぞえないよ）</span>}
      </div>
    </MissionFrame>
  )
}

const CONFETTI_COLORS = ['#ff5a5f', '#ffd400', '#2fbf5b', '#2f80ed', '#9b51e0', '#ff8a00']

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 2.2 + Math.random() * 1.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    [],
  )
  return (
    <div className="clear__confetti" aria-hidden>
      {pieces.map((c, i) => (
        <span
          key={i}
          style={{
            left: `${c.left}%`,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${c.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

/** status が変わってから少し待って出す（最後の岩が落ちるのを見せる） */
function useDelayedFlag(on: boolean, ms = 700) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!on) {
      setVisible(false)
      return
    }
    const id = setTimeout(() => setVisible(true), ms)
    return () => clearTimeout(id)
  }, [on, ms])
  return visible
}

export function Overlay({ children, confetti = false }: { children: ReactNode; confetti?: boolean }) {
  return (
    <div className="clear">
      {confetti && <Confetti />}
      <div className="clear__card">{children}</div>
    </div>
  )
}

/** グレードアップのお知らせ（新しいレベルでできるようになったこと）。ボタンを押したら「見た」ことにする（shownLevel） */
function LevelUpCard({ level, onNext, label = 'つぎへ ▶' }: { level: number; onNext: () => void; label?: string }) {
  const lv = LEVELS.find((l) => l.level === level)!
  useEffect(() => {
    audio.play('levelUp')
  }, [level])
  const close = () => {
    useProgressStore.getState().markLevelShown(level)
    onNext()
  }
  return (
    <Overlay confetti>
      <div className="levelup__title">グレードアップ！</div>
      <div className="levelup__badge">Lv{lv.level}</div>
      {lv.level === SKYSCRAPER_LEVEL ? (
        <div className="levelup__text">
          こうじげんばの きたに <b>たかく なる ビル</b>が できたよ！ ちかくで <b>おくじょうの クレーン</b>に のろう
          <br />
          じめんの <b>てっこつ</b>を つりあげて、おくじょうの きいろい わくに 2ほん おくと 1かい たかく なって、クレーンも のびるよ
        </div>
      ) : lv.level === TOWER_LEVEL ? (
        <div className="levelup__text">
          こうじげんばに <b>タワー</b>を たてられるよ！
          <br />
          きいろい わに <b>いし</b>を 3こ おくと、<b>てっこつ</b> 2ほんで 1だん たつよ。6だんで できあがり（よるは ライトアップ）
        </div>
      ) : lv.level === OFFICE_LEVEL ? (
        <div className="levelup__text">
          ちずの みぎの <b>こうじげんば</b>で <b>ビル</b>を たてられるよ！
          <br />
          きいろい わに <b>いし</b>を 4こ おくと、もっている <b>てっこつ</b> 1ほんで 1かい たつよ。4かいで できあがり
        </div>
      ) : lv.level === DEMOLISH_LEVEL ? (
        <div className="levelup__text">
          ちずの したの ほうに <b>ふるい ビル</b> が でたよ！ <b>ブレーカー</b>で こわそう
          <br />
          でてきた がれきを <b>スケルトンバケット</b>で すくって、レバーで ゆらして ふるうと <b>てっこつ</b>に なるよ。
          <br />
          ダンプで <b>みどりの ばしょ</b>へ はこんで あつめよう
        </div>
      ) : lv.level === GRAPPLE_LEVEL ? (
        <div className="levelup__text">
          ショベルに <b>グラップル</b> が つけられるよ！
          <br />
          もくざいを つかんで ダンプで はこび、きいろい わの ところに おいて <b>いえ</b>を たてよう
        </div>
      ) : lv.level === FELL_LEVEL ? (
        <div className="levelup__text">
          <b>ショベル</b>と <b>ダンプ</b>が おおきく なった！
          <br />
          <b>ブルドーザー</b>で そとがわの <b>き</b>を おして たおせるよ（もくざいが でてくる）
        </div>
      ) : lv.level === BREAKER_LEVEL ? (
        <div className="levelup__text">
          ショベルに <b>ゆあつ ブレーカー</b> が つけられるよ！
          <br />
          おおきな いわを わって、いしと めずらしい こうせきを みつけよう
        </div>
      ) : (
        <>
          <div className="levelup__text">
            バケットが おおきく なった！
            <br />
            いちどに <b>{lv.bucketCapacity}</b>こ すくえるよ
          </div>
          <div className="levelup__text">
            こんどは <b>{lv.targetRange[1]}</b>こ までの たしざん
            {lv.colorRange[1] > 1 && (
              <>
                <br />
                いろの ちがう いしを <b>{lv.colorRange[1]}</b>しゅるい あつめるよ
              </>
            )}
          </div>
          {lv.level === CRANE.unlockLevel && (
            <div className="levelup__text">
              <b>タワークレーン</b>に のれるよ！ ちかくへ いってみよう
            </div>
          )}
        </>
      )}
      <button type="button" className="clear__next" onClick={close}>
        {label}
      </button>
    </Overlay>
  )
}

/**
 * どこで星をもらってレベルが上がっても、グレードアップのお祝いを出す（ユーザー指摘：クレーンなどで Lv4 になっても何も出なかった）。
 * ミッションのクリア画面（そちらでお祝いを出す）や、地図コンプリートの画面が出ている間は、閉じてから出す。
 */
export function LevelUpCelebration() {
  const stars = useProgressStore((s) => s.stars)
  const shownLevel = useProgressStore((s) => s.shownLevel)
  const missionCleared = useMissionStore((s) => s.status === 'cleared')
  const mapCelebrating = useCelebrationStore((s) => s.mapComplete)
  const steelCleared = useScrapStore((s) => s.cleared !== null)
  const level = levelForStars(stars).level
  if (level <= shownLevel || missionCleared || mapCelebrating || steelCleared) return null
  return <LevelUpCard level={level} onNext={() => {}} label="やったね！" />
}

/** クリア画面：もらった星（最大 3 つ）・大きな式・グレードアップ・「つぎへ」 */
export function ClearOverlay() {
  const { status, kind, parts, colorCounts, loads, delivered, startCount, stars, levelUp, next } = useMissionStore()
  const visible = useDelayedFlag(status === 'cleared')
  // グレードアップのお知らせは「つぎへ」の前に 1 枚はさむ
  const [showLevelUp, setShowLevelUp] = useState(false)
  useEffect(() => setShowLevelUp(false), [status])
  if (!visible || !stars) return null

  if (showLevelUp && levelUp) {
    return <LevelUpCard level={levelUp} onNext={next} />
  }

  const got = [stars.clear, stars.neverOver, stars.equation]
  return (
    <Overlay confetti>
      <div className="clear__stars" aria-label={`ほし ${got.filter(Boolean).length}こ`}>
        {got.map((g, i) => (
          <span key={i} className={g ? '' : 'clear__star--empty'}>
            ★
          </span>
        ))}
      </div>
      <div className="clear__title">ぴったり！</div>
      {kind === 'remove' ? (
        <SubtractEquation start={startCount} result={delivered} />
      ) : (
        <BigEquation terms={equationTerms(kind, parts, colorCounts, loads)} total={delivered} />
      )}
      <ul className="clear__hints">
        <li className={stars.neverOver ? 'is-got' : ''}>★ {kind === 'remove' ? 'とりすぎずに できた' : 'おおすぎずに できた'}</li>
        <li className={stars.equation ? 'is-got' : ''}>★ {kind === 'remove' ? 'ひきざんが できた' : '2かい いじょう はこんだ'}</li>
      </ul>
      <button type="button" className="clear__next" onClick={() => (levelUp ? setShowLevelUp(true) : next())}>
        つぎへ ▶
      </button>
    </Overlay>
  )
}
