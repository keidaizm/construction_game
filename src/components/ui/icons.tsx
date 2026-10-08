import type { Sight } from '../../world/discoveryLayout'

/**
 * 文字を読めなくても分かるように、各レバーの端に「動かすとこうなる」姿勢の絵を描く。
 * 側面図（機械は右向き）で、操作する部位だけに色を付ける。
 */

type Part = 'boom' | 'arm' | 'bucket'
type ArrowKind = 'up' | 'down' | 'left' | 'right' | 'cw' | 'ccw'

interface Pose {
  boom: number // 度。地面からの仰角
  arm: number // 度。ブームに対する角度
  bucket: number // 度。アームに対する角度
}

const INK = '#2b2b2b'
const BODY = '#f2b705'
const MUTED = '#6f6a60'

const PIVOT = { x: 20, y: 42 }
const LEN = { boom: 20, arm: 14, bucket: 7 }

function polar(x: number, y: number, len: number, deg: number) {
  const r = (deg * Math.PI) / 180
  return { x: x + len * Math.cos(r), y: y - len * Math.sin(r) }
}

function Arrow({ kind, x, y, color }: { kind: ArrowKind; x: number; y: number; color: string }) {
  if (kind === 'cw' || kind === 'ccw') {
    // 半径 9 の円弧の矢印
    const sweep = kind === 'cw' ? 1 : 0
    const start = kind === 'cw' ? { x: x - 9, y } : { x: x + 9, y }
    const end = { x, y: y + 9 }
    const head =
      kind === 'cw'
        ? `M ${end.x + 5} ${end.y - 4} L ${end.x - 2} ${end.y} L ${end.x + 5} ${end.y + 5} Z`
        : `M ${end.x - 5} ${end.y - 4} L ${end.x + 2} ${end.y} L ${end.x - 5} ${end.y + 5} Z`
    return (
      <g>
        <path
          d={`M ${start.x} ${start.y} A 9 9 0 0 ${1 - sweep} ${end.x} ${end.y}`}
          fill="none"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        <path d={head} fill={color} />
      </g>
    )
  }
  const rot = { up: 0, right: 90, down: 180, left: 270 }[kind]
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d="M 0 -9 L 8 1 L 3 1 L 3 9 L -3 9 L -3 1 L -8 1 Z" fill={color} stroke="#fff" strokeWidth={1.2} />
    </g>
  )
}

export function ArmPictogram({
  pose,
  highlight,
  color,
  arrow,
}: {
  pose: Pose
  highlight: Part
  color: string
  /** 省略すると矢印なし（乗り換えボタンの絵などに使う） */
  arrow?: { kind: ArrowKind; x: number; y: number }
}) {
  const e1 = pose.boom
  const e2 = e1 + pose.arm
  const e3 = e2 + pose.bucket
  const p1 = polar(PIVOT.x, PIVOT.y, LEN.boom, e1)
  const p2 = polar(p1.x, p1.y, LEN.arm, e2)
  const p3 = polar(p2.x, p2.y, LEN.bucket, e3)
  // バケットの口（先端から少し戻った位置）
  const lip = polar(p3.x, p3.y, 5, e3 + 110)
  const c = (part: Part) => (part === highlight ? color : MUTED)

  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      {/* 履帯と車体 */}
      <rect x={2} y={52} width={26} height={8} rx={4} fill={INK} />
      <rect x={4} y={38} width={20} height={13} rx={2} fill={BODY} stroke={INK} strokeWidth={1.2} />
      <rect x={6} y={30} width={9} height={9} fill="#bfe3ff" stroke={INK} strokeWidth={1.2} />
      {/* ブーム・アーム・バケット */}
      <line x1={PIVOT.x} y1={PIVOT.y} x2={p1.x} y2={p1.y} stroke={c('boom')} strokeWidth={5} strokeLinecap="round" />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={c('arm')} strokeWidth={4} strokeLinecap="round" />
      <path
        d={`M ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${lip.x} ${lip.y}`}
        fill="none"
        stroke={c('bucket')}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {arrow && <Arrow {...arrow} color={color} />}
    </svg>
  )
}

/** 上から見たショベルカー。上部旋回レバー用。 */
export function SwingPictogram({ direction, color }: { direction: 'left' | 'right'; color: string }) {
  const angle = direction === 'left' ? -35 : 35
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={17} y={18} width={8} height={34} rx={3} fill={INK} />
      <rect x={39} y={18} width={8} height={34} rx={3} fill={INK} />
      <g transform={`rotate(${angle} 32 36)`}>
        <rect x={21} y={28} width={22} height={20} rx={3} fill={color} stroke={INK} strokeWidth={1.2} />
        <rect x={34} y={30} width={7} height={7} fill="#bfe3ff" stroke={INK} strokeWidth={1} />
        <line x1={30} y1={30} x2={30} y2={8} stroke={color} strokeWidth={5} strokeLinecap="round" />
      </g>
      <Arrow kind={direction === 'left' ? 'ccw' : 'cw'} x={direction === 'left' ? 52 : 12} y={6} color={color} />
    </svg>
  )
}

/** 走行ジョイスティックのつまみに描く、上から見た履帯 */
export function CrawlerIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={12} y={10} width={12} height={44} rx={5} fill={INK} />
      <rect x={40} y={10} width={12} height={44} rx={5} fill={INK} />
      {[16, 24, 32, 40, 48].map((y) => (
        <g key={y}>
          <line x1={13} x2={23} y1={y} y2={y} stroke="#777" strokeWidth={2} />
          <line x1={41} x2={51} y1={y} y2={y} stroke="#777" strokeWidth={2} />
        </g>
      ))}
      <rect x={22} y={22} width={20} height={20} rx={3} fill={BODY} stroke={INK} strokeWidth={1.5} />
    </svg>
  )
}

export function ResetIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <path d="M 44 20 A 16 16 0 1 0 48 34" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M 36 12 L 50 18 L 40 30 Z" fill={INK} />
    </svg>
  )
}

export function FullscreenIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      {['M 12 26 V 12 H 26', 'M 38 12 H 52 V 26', 'M 52 38 V 52 H 38', 'M 26 52 H 12 V 38'].map((d) => (
        <path key={d} d={d} fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/**
 * 横から見たダンプカー（右向き）。荷台レバーの両端に使う。
 * bedAngle：荷台の角度（度）。荷台だけに色を付ける。
 */
export function TruckSidePictogram({
  bedAngle,
  color,
  arrow,
}: {
  bedAngle: number
  color: string
  arrow?: { kind: ArrowKind; x: number; y: number }
}) {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={6} y={44} width={52} height={5} fill={INK} />
      <g transform={`rotate(${-bedAngle} 6 44)`}>
        <rect x={6} y={31} width={34} height={13} rx={1.5} fill={color} stroke={INK} strokeWidth={1.4} />
      </g>
      <rect x={44} y={26} width={16} height={20} rx={2} fill="#f1f0ea" stroke={INK} strokeWidth={1.4} />
      <rect x={51} y={29} width={7} height={8} fill="#bfe3ff" stroke={INK} strokeWidth={1} />
      {[15, 27, 51].map((x) => (
        <g key={x}>
          <circle cx={x} cy={52} r={6} fill={INK} />
          <circle cx={x} cy={52} r={2.4} fill="#bbb" />
        </g>
      ))}
      {arrow && <Arrow {...arrow} color={color} />}
    </svg>
  )
}

/** 上から見たダンプカー（上が前）。ジョイスティックのつまみに使う */
export function TruckTopIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      {[
        [14, 12],
        [44, 12],
        [14, 40],
        [44, 40],
        [14, 49],
        [44, 49],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={6} height={8} rx={1.5} fill={INK} />
      ))}
      <rect x={19} y={24} width={26} height={34} rx={2} fill={BODY} stroke={INK} strokeWidth={1.5} />
      <rect x={19} y={6} width={26} height={16} rx={3} fill="#f1f0ea" stroke={INK} strokeWidth={1.5} />
      <rect x={22} y={7} width={20} height={5} fill="#bfe3ff" />
    </svg>
  )
}

/** カメ（ゆっくり）。ダンプの速さ切り替えボタンに使う */
export function TurtleIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <ellipse cx={14} cy={44} rx={5} ry={4} fill="#6fbf4a" stroke={INK} strokeWidth={1.5} />
      <ellipse cx={46} cy={44} rx={5} ry={4} fill="#6fbf4a" stroke={INK} strokeWidth={1.5} />
      <circle cx={54} cy={34} r={6} fill="#6fbf4a" stroke={INK} strokeWidth={1.5} />
      <circle cx={56} cy={32} r={1.3} fill={INK} />
      <path d="M 8 40 Q 12 18 30 17 Q 48 18 50 40 Z" fill="#3f8f3a" stroke={INK} strokeWidth={1.8} />
      <path d="M 18 36 L 22 26 L 30 23 L 38 26 L 42 36" fill="none" stroke="#9ad17a" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

/** ウサギ（はやい）。ダンプの速さ切り替えボタンに使う */
export function RabbitIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <ellipse cx={40} cy={10} rx={4} ry={10} transform="rotate(20 40 18)" fill="#fff" stroke={INK} strokeWidth={1.5} />
      <ellipse cx={48} cy={12} rx={4} ry={10} transform="rotate(35 48 20)" fill="#fff" stroke={INK} strokeWidth={1.5} />
      <ellipse cx={28} cy={40} rx={18} ry={12} fill="#fff" stroke={INK} strokeWidth={1.8} />
      <circle cx={46} cy={28} r={9} fill="#fff" stroke={INK} strokeWidth={1.8} />
      <circle cx={49} cy={26} r={1.4} fill={INK} />
      <circle cx={10} cy={36} r={4} fill="#fff" stroke={INK} strokeWidth={1.5} />
      {/* 速さの線 */}
      {[26, 34, 42].map((y) => (
        <line key={y} x1={0} x2={6} y1={y + 12} y2={y + 12} stroke="#2f80ed" strokeWidth={2.5} strokeLinecap="round" />
      ))}
    </svg>
  )
}

/** 横から見たショベルカー。乗り換えボタンに使う */
export function ExcavatorSideIcon() {
  return <ArmPictogram pose={{ boom: 45, arm: -110, bucket: -60 }} highlight="boom" color={BODY} />
}

/** 乗り換えボタンの角に付ける「⇄」 */
export function SwapBadge() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <circle cx={32} cy={32} r={30} fill="#2f80ed" />
      <path d="M 16 24 H 44 L 38 17 M 48 40 H 20 L 26 47" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 横から見たブルドーザー（右が前）。lift は排土板の持ち上がり（0〜1） */
export function BulldozerSidePictogram({
  lift,
  color,
  arrow,
}: {
  lift: number
  color: string
  arrow?: { kind: ArrowKind; x: number; y: number }
}) {
  const bladeBottom = 56 - lift * 12
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      {/* 履帯 */}
      <rect x={4} y={44} width={38} height={12} rx={6} fill={INK} />
      {[11, 23, 35].map((x) => (
        <circle key={x} cx={x} cy={50} r={3} fill="#888" />
      ))}
      {/* 運転席・フード */}
      <rect x={8} y={20} width={16} height={24} rx={2} fill={BODY} stroke={INK} strokeWidth={1.4} />
      <rect x={11} y={23} width={10} height={9} fill="#bfe3ff" stroke={INK} strokeWidth={1} />
      <rect x={24} y={31} width={16} height={13} rx={1.5} fill={BODY} stroke={INK} strokeWidth={1.4} />
      {/* 腕と排土板 */}
      <line x1={30} y1={46} x2={50} y2={bladeBottom - 5} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path
        d={`M 50 ${bladeBottom} L 50 ${bladeBottom - 18} Q 55 ${bladeBottom - 18} 57 ${bladeBottom - 15} L 54 ${bladeBottom} Z`}
        fill={color}
        stroke={INK}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {arrow && <Arrow {...arrow} color={color} />}
    </svg>
  )
}

/** 上から見たブルドーザー（上が前）。ジョイスティックのつまみに使う */
export function BulldozerTopIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={14} y={18} width={8} height={40} rx={3} fill={INK} />
      <rect x={42} y={18} width={8} height={40} rx={3} fill={INK} />
      <rect x={21} y={22} width={22} height={34} rx={2} fill={BODY} stroke={INK} strokeWidth={1.5} />
      <rect x={24} y={40} width={16} height={12} rx={1.5} fill="#bfe3ff" stroke={INK} strokeWidth={1} />
      <rect x={8} y={6} width={48} height={8} rx={2} fill={BODY} stroke={INK} strokeWidth={1.5} />
      <line x1={18} y1={14} x2={18} y2={20} stroke={INK} strokeWidth={2.5} />
      <line x1={46} y1={14} x2={46} y2={20} stroke={INK} strokeWidth={2.5} />
    </svg>
  )
}

/** 太陽（昼にもどすボタン） */
export function SunIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4
        return (
          <line key={i} x1={32 + Math.cos(a) * 18} y1={32 + Math.sin(a) * 18} x2={32 + Math.cos(a) * 27} y2={32 + Math.sin(a) * 27} stroke="#f29f05" strokeWidth={5} strokeLinecap="round" />
        )
      })}
      <circle cx={32} cy={32} r={13} fill="#ffcf33" stroke="#f29f05" strokeWidth={3} />
    </svg>
  )
}

/** 月（夜にするボタン・図鑑の「夜だけ」の印） */
export function MoonIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <path d="M 40 8 A 25 25 0 1 0 56 44 A 20 20 0 1 1 40 8 Z" fill="#ffe27a" stroke="#c9a227" strokeWidth={3} strokeLinejoin="round" />
      <circle cx={50} cy={16} r={2.5} fill="#ffe27a" />
      <circle cx={57} cy={27} r={1.8} fill="#ffe27a" />
    </svg>
  )
}

/** 車のライト（on なら光の線が出る） */
export function HeadlightIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <path d="M 26 14 Q 6 14 6 32 Q 6 50 26 50 Z" fill={on ? '#ffe27a' : '#cfcfcf'} stroke="#2b2b2b" strokeWidth={3} strokeLinejoin="round" />
      {[18, 32, 46].map((y) => (
        <line key={y} x1={34} y1={y} x2={58} y2={y + (y - 32) * 0.35} stroke={on ? '#f2b705' : '#9a9a9a'} strokeWidth={5} strokeLinecap="round" strokeDasharray={on ? undefined : '4 6'} />
      ))}
    </svg>
  )
}

/** 夕焼け（地平線に沈む太陽） */
export function SunsetIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      {[-60, -30, 0, 30, 60].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180
        return (
          <line key={deg} x1={32 + Math.cos(a) * 18} y1={40 + Math.sin(a) * 18} x2={32 + Math.cos(a) * 26} y2={40 + Math.sin(a) * 26} stroke="#e8590c" strokeWidth={4.5} strokeLinecap="round" />
        )
      })}
      <path d="M 18 40 A 14 14 0 0 1 46 40 Z" fill="#ff8a3d" stroke="#e8590c" strokeWidth={3} strokeLinejoin="round" />
      <line x1={6} y1={42} x2={58} y2={42} stroke="#8a4b2a" strokeWidth={4} strokeLinecap="round" />
      <line x1={14} y1={50} x2={50} y2={50} stroke="#8a4b2a" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
    </svg>
  )
}

/** 名所の絵（絵文字。かざぐるまの塔だけは合う絵文字がないので絵を描く） */
export function SightIcon({ sight }: { sight: Sight }) {
  if (sight.id !== 'windmill') return <span className="sight-icon">{sight.emoji}</span>
  return (
    <svg viewBox="0 0 64 64" className="sight-icon sight-icon--svg" aria-hidden>
      <path d="M 24 60 L 27 24 L 37 24 L 40 60 Z" fill="#e9e2d4" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M 24 26 L 32 14 L 40 26 Z" fill="#b5453a" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <rect x={29} y={48} width={6} height={12} fill="#b5453a" />
      <g transform="translate(32 22)">
        {[20, 110, 200, 290].map((deg) => (
          <rect key={deg} x={-3} y={-24} width={6} height={22} rx={1} fill="#f4efe4" stroke={INK} strokeWidth={2} transform={`rotate(${deg})`} />
        ))}
        <circle r={3.5} fill={INK} />
      </g>
    </svg>
  )
}

/**
 * 横から見たクレーン（塔が左、腕が右へ）。トロリー・フックのレバーの端に描く。
 * part の部位（トロリー＝台車、hook＝フック）だけに色を付け、trolleyX でトロリーの位置、hookY でフックの高さを変える。
 */
export function CraneSidePictogram({
  part,
  color,
  trolleyX = 40,
  hookY = 40,
  arrow,
}: {
  part?: 'trolley' | 'hook'
  color: string
  trolleyX?: number
  hookY?: number
  arrow?: { kind: ArrowKind; x: number; y: number }
}) {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={10} y={10} width={6} height={50} fill={BODY} stroke={INK} strokeWidth={1.2} />
      <rect x={4} y={9} width={56} height={5} fill={BODY} stroke={INK} strokeWidth={1.2} />
      <rect x={4} y={14} width={6} height={6} fill={INK} />
      <rect x={trolleyX - 5} y={14} width={10} height={4} fill={part === 'trolley' ? color : MUTED} stroke={INK} strokeWidth={0.8} />
      <line x1={trolleyX} y1={18} x2={trolleyX} y2={hookY} stroke={INK} strokeWidth={1.5} />
      <path
        d={`M ${trolleyX - 3} ${hookY} h 6 v 3 q 0 5 -4 5 q -3 0 -3 -3`}
        fill="none"
        stroke={part === 'hook' ? color : MUTED}
        strokeWidth={part === 'hook' ? 3 : 2}
        strokeLinecap="round"
      />
      <rect x={2} y={58} width={60} height={3} fill={MUTED} />
      {arrow && <Arrow {...arrow} color={color} />}
    </svg>
  )
}

/** 上から見たクレーン（旋回レバーの端）。腕がまわる向きの矢印つき */
export function CraneSlewPictogram({ direction, color }: { direction: 'left' | 'right'; color: string }) {
  const angle = direction === 'left' ? -30 : 30
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={26} y={34} width={12} height={12} fill={MUTED} stroke={INK} strokeWidth={1.2} />
      <g transform={`rotate(${angle} 32 40)`}>
        <rect x={29} y={8} width={6} height={36} fill={color} stroke={INK} strokeWidth={1.2} />
        <rect x={28} y={44} width={8} height={8} fill={INK} />
      </g>
      <Arrow kind={direction === 'left' ? 'ccw' : 'cw'} x={direction === 'left' ? 52 : 12} y={8} color={color} />
    </svg>
  )
}

/** クレーンの絵（乗るボタン・おりるボタン） */
export function CraneIcon() {
  return <CraneSidePictogram color={BODY} trolleyX={42} hookY={34} />
}

/** つかむ／はなすボタンの絵（フックと荷物） */
export function GrabIcon({ holding }: { holding: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <line x1={32} y1={2} x2={32} y2={14} stroke={INK} strokeWidth={3} />
      <rect x={24} y={12} width={16} height={8} rx={2} fill={BODY} stroke={INK} strokeWidth={1.5} />
      <path d="M 32 20 v 6 q 0 7 -6 7 q -5 0 -5 -5" fill="none" stroke="#d33" strokeWidth={4} strokeLinecap="round" />
      <rect
        x={14}
        y={holding ? 34 : 44}
        width={36}
        height={18}
        rx={2}
        fill={holding ? '#2f80ed' : '#9aa3ae'}
        stroke={INK}
        strokeWidth={1.5}
      />
      {holding && <line x1={26} y1={30} x2={26} y2={34} stroke={INK} strokeWidth={2} />}
    </svg>
  )
}

/** 鍵（まだ乗れない） */
export function LockIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <path d="M 20 30 V 22 a 12 12 0 0 1 24 0 V 30" fill="none" stroke={INK} strokeWidth={5} />
      <rect x={14} y={30} width={36} height={26} rx={4} fill="#ffc933" stroke={INK} strokeWidth={2} />
      <circle cx={32} cy={42} r={4} fill={INK} />
    </svg>
  )
}

/** アタッチメントの絵：バケット */
export function BucketToolIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={28} y={4} width={8} height={18} fill={BODY} stroke={INK} strokeWidth={1.5} />
      <path d="M 14 24 L 50 24 L 46 48 Q 32 58 18 48 Z" fill={BODY} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {[20, 28, 36, 44].map((x) => (
        <path key={x} d={`M ${x - 3} 50 l 3 7 l 3 -7`} fill="#cfcfcf" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** アタッチメントの絵：油圧ブレーカー（とがったのみ） */
export function BreakerToolIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={24} y={4} width={16} height={8} fill="#3b3d40" />
      <rect x={22} y={12} width={20} height={26} rx={2} fill="#d64545" stroke={INK} strokeWidth={2} />
      <rect x={29} y={38} width={6} height={14} fill="#d9dde2" stroke={INK} strokeWidth={1.2} />
      <path d="M 29 52 L 32 61 L 35 52 Z" fill="#d9dde2" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M 14 46 l -6 -3 M 14 52 l -7 1 M 50 46 l 6 -3 M 50 52 l 7 1" stroke="#ffb000" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}

/** アタッチメントの絵：グラップル（木材をつかむはさみ） */
export function GrappleToolIcon() {
  return (
    <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
      <rect x={26} y={3} width={12} height={8} fill="#3b3d40" />
      <rect x={20} y={11} width={24} height={10} rx={2} fill="#9b51e0" stroke={INK} strokeWidth={2} />
      <path d="M 24 21 Q 10 32 18 50 L 23 48 Q 18 34 28 24 Z" fill="#9b51e0" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M 40 21 Q 54 32 46 50 L 41 48 Q 46 34 36 24 Z" fill="#9b51e0" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <rect x={16} y={40} width={32} height={9} rx={4.5} fill="#7a4f2a" stroke={INK} strokeWidth={1.5} />
      <circle cx={46} cy={44.5} r={3} fill="#e2c08a" stroke={INK} strokeWidth={1} />
    </svg>
  )
}
