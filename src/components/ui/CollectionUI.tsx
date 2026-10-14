import { useEffect, useState } from 'react'
import { useCollectionStore } from '../../stores/collectionStore'
import { useGameStore } from '../../stores/gameStore'
import { ORES, type OreType } from '../../cargo/ores/oreTypes'
import { useToastStore } from '../../stores/toastStore'
import { MoonIcon, SightIcon, SteelBeamIcon, SunsetIcon } from './icons'
import { BIOME_INFO, type OuterBiome } from '../../world/biomes'
import { CHESTS, SIGHTS } from '../../world/discoveryLayout'
import { useDiscoveryStore } from '../../stores/discoveryStore'

/** 宝の山だけの鉱石の印（どの地帯か） */
const BIOME_EMOJI: Record<OuterBiome, string> = { snow: '❄️', forest: '🌲', desert: '🌵', rocky: '⛰️' }

/** 宝石の絵（八角形）。found = false なら影だけ */
export function GemIcon({ ore, found = true }: { ore: OreType; found?: boolean }) {
  const fill = found ? ore.color : '#b9b9b9'
  return (
    <svg viewBox="0 0 64 64" className="gem-icon" aria-hidden>
      {found && ore.glow > 0.3 && <circle cx={32} cy={32} r={28} fill={ore.color} opacity={0.18} />}
      <path d="M 32 6 L 54 24 L 32 58 L 10 24 Z" fill={fill} stroke={found ? '#2b2b2b' : '#8a8a8a'} strokeWidth={2.5} strokeLinejoin="round" />
      {found && (
        <>
          <path d="M 10 24 L 54 24 M 32 6 L 22 24 L 32 58 L 42 24 Z" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
          <circle cx={24} cy={16} r={3} fill="#fff" opacity={0.8} />
        </>
      )}
    </svg>
  )
}

const Stars = ({ n }: { n: number }) => <span className="gem-stars">{'★'.repeat(n)}</span>

/** お知らせ（鉱石を見つけた・金色の石など）。2.5 秒で消える */
export function FindToast() {
  const toast = useToastStore((s) => s.toast)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(id)
  }, [toast])
  if (!toast || !visible) return null
  return (
    <div className="find-toast" key={toast.at} role="status">
      {toast.icon === 'star' ? (
        <span className="find-toast__star">★</span>
      ) : toast.icon === 'sight' && toast.sight ? (
        <span className="find-toast__sight">
          <SightIcon sight={SIGHTS.find((s) => s.id === toast.sight)!} />
        </span>
      ) : toast.icon === 'steel' ? (
        <SteelBeamIcon concrete />
      ) : (
        <GemIcon ore={{ id: 'coal', name: '', color: toast.color, glow: 0.5, weight: 0, stars: 0 }} />
      )}
      <div>
        <div className="find-toast__name">
          {toast.title}
          {toast.isNew && <span className="find-toast__new">あたらしい！</span>}
        </div>
        {toast.stars > 0 && <Stars n={toast.stars} />}
      </div>
    </div>
  )
}

/** 左の図鑑ボタン（レベルの下） */
export function ZukanButton() {
  const toggle = useGameStore((s) => s.toggleZukan)
  const found = useCollectionStore((s) => Object.keys(s.counts).length)
  return (
    <button type="button" className="zukan-button" aria-label="ずかん" onClick={toggle}>
      <svg viewBox="0 0 64 64" className="pictogram" aria-hidden>
        <path d="M 8 14 Q 20 8 32 14 Q 44 8 56 14 V 52 Q 44 46 32 52 Q 20 46 8 52 Z" fill="#fff6c2" stroke="#2b2b2b" strokeWidth={3} strokeLinejoin="round" />
        <path d="M 32 14 V 52" stroke="#2b2b2b" strokeWidth={2.5} />
        <path d="M 44 24 L 50 30 L 44 40 L 38 30 Z" fill="#7ff3ff" stroke="#2b2b2b" strokeWidth={1.5} />
        <path d="M 20 24 L 26 30 L 20 40 L 14 30 Z" fill="#ffd23f" stroke="#2b2b2b" strokeWidth={1.5} />
      </svg>
      <span className="zukan-button__count">
        {found}/{ORES.length}
      </span>
    </button>
  )
}

/** 図鑑の「はっけん」：見つけた名所と、開けた宝箱の数 */
function FindsPage() {
  const sights = useDiscoveryStore((s) => s.sights)
  const opened = useDiscoveryStore((s) => s.openedChests.length)
  const round = useDiscoveryStore((s) => s.chestRound)
  return (
    <>
      <div className="zukan__grid zukan__grid--finds">
        {SIGHTS.map((s) => {
          const found = sights.includes(s.id)
          return (
            <div key={s.id} className={`zukan__card${found ? ' is-found' : ''}`}>
              <span className="zukan__emoji">{found ? <SightIcon sight={s} /> : '？'}</span>
              <div className="zukan__name">{found ? s.name : '？？？'}</div>
              <div className="zukan__where">{BIOME_INFO[s.biome].name}</div>
            </div>
          )
        })}
        <div className="zukan__card is-found">
          <span className="zukan__emoji">🎁</span>
          <div className="zukan__name">
            たからばこ {opened} / {CHESTS.length}
          </div>
          <div className="zukan__where">{round > 0 ? `ぜんぶ あけた： ${round}かい` : 'のりもので さわると ひらく'}</div>
        </div>
      </div>
      <div className="zukan__hint">とおくまで たんけんして、めいしょと たからばこを さがそう！</div>
    </>
  )
}

/** 図鑑：見つけた鉱石のカード（まだのものは影と「？？？」）と、「はっけん」（名所・宝箱）のページ */
export function ZukanOverlay() {
  const open = useGameStore((s) => s.zukanOpen)
  const close = useGameStore((s) => s.toggleZukan)
  const counts = useCollectionStore((s) => s.counts)
  const sightsFound = useDiscoveryStore((s) => s.sights.length)
  const [page, setPage] = useState<'ores' | 'finds'>('ores')
  if (!open) return null
  const found = ORES.filter((o) => (counts[o.id] ?? 0) > 0).length
  // タブを押しても図鑑が閉じないように
  const tab = (p: 'ores' | 'finds') => (e: React.MouseEvent) => {
    e.stopPropagation()
    setPage(p)
  }
  return (
    <div className="map" onClick={close} role="dialog" aria-label="ずかん">
      <div className="zukan">
        <div className="zukan__tabs">
          <button type="button" className={`zukan__tab${page === 'ores' ? ' is-active' : ''}`} onClick={tab('ores')}>
            💎 こうせき{' '}
            <small>
              {found} / {ORES.length}
            </small>
          </button>
          <button type="button" className={`zukan__tab${page === 'finds' ? ' is-active' : ''}`} onClick={tab('finds')}>
            🧭 はっけん{' '}
            <small>
              {sightsFound} / {SIGHTS.length}
            </small>
          </button>
        </div>
        {page === 'finds' ? (
          <FindsPage />
        ) : (
          <>
            <div className="zukan__grid">
              {ORES.map((ore) => {
                const n = counts[ore.id] ?? 0
                return (
                  <div key={ore.id} className={`zukan__card${n > 0 ? ' is-found' : ''}`}>
                    <GemIcon ore={ore} found={n > 0} />
                    {ore.fromBoulder && (
                  <span className="zukan__time is-boulder" title="おおきな いわを わると でる">
                    🪨
                  </span>
                )}
                {ore.onlyIn && (
                      <span className={`zukan__time is-${ore.onlyIn}`} title={`${BIOME_INFO[ore.onlyIn].name}の たからの やま`}>
                        {BIOME_EMOJI[ore.onlyIn]}
                      </span>
                    )}
                    {ore.onlyAt && (
                      <span className={`zukan__time is-${ore.onlyAt}`} title={ore.onlyAt === 'night' ? 'よるだけ' : 'ゆうがただけ'}>
                        {ore.onlyAt === 'night' ? <MoonIcon /> : <SunsetIcon />}
                      </span>
                    )}
                    <div className="zukan__name">{n > 0 ? ore.name : '？？？'}</div>
                    <Stars n={ore.stars} />
                    {n > 0 && <div className="zukan__count">× {n}</div>}
                  </div>
                )
              })}
            </div>
            <div className="zukan__hint">つちの やまを ほってみよう！ 🌇🌙＝ゆうがた・よる ／ ❄️🌲🌵⛰️＝とおくの たからの やま ／ 🪨＝おおきな いわを わる</div>
          </>
        )}
      </div>
      <div className="map__close" aria-hidden>
        ✕
      </div>
    </div>
  )
}
