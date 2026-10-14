import { useEffect, useRef } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useLevel, useProgressStore } from '../../stores/progressStore'
import { LEVELS, nextLevel } from '../../missions/levels'

/** 各レベルでできるようになること（6 才でも分かる言葉で） */
const PERKS: Record<number, { icon: string; lines: string[] }> = {
  1: { icon: '🪨', lines: ['いしを すくって はこぼう', 'いちどに 3こ すくえる', '5こ までの たしざん'] },
  2: { icon: '🪣', lines: ['バケットが おおきく なる（5こ）', '10こ までの たしざん', 'いろの ちがう いしを 2しゅるい'] },
  3: { icon: '🏗️', lines: ['バケットが もっと おおきく（8こ）', '20こ までの たしざん', 'タワークレーンに のれる'] },
  4: { icon: '🔨', lines: ['ゆあつ ブレーカーで おおきな いわを われる', 'クレーンで 2けたの たしざん'] },
  5: { icon: '🚛', lines: ['ショベルと ダンプが おおきく なる', 'ブルドーザーで きを たおせる'] },
  6: { icon: '🏠', lines: ['グラップルで もくざいを つかめる', 'もくざいを はこんで いえを たてよう', 'クレーンで ひきざん'] },
  7: { icon: '🏚️', lines: ['ふるい ビルを ブレーカーで こわせる', 'スケルトンバケットで ふるって てっこつを あつめよう'] },
  8: { icon: '🏢', lines: ['てっこつと いしで ビルを たてよう', 'クレーンで かけざん'] },
  9: { icon: '🗼', lines: ['てっこつと いしで タワーを たてよう', 'よるは ライトアップ'] },
}

/** 左上のレベルの札（押すとレベルの一覧） */
export function ProgressBadge() {
  const stars = useProgressStore((s) => s.stars)
  const level = useLevel()
  const next = nextLevel(level.level)
  const toggle = useGameStore((s) => s.toggleLevels)
  return (
    <button type="button" className="progress-badge" onClick={toggle} aria-label={`レベル ${level.level}（おすと くわしく）`}>
      <span className="progress-badge__level">Lv{level.level}</span>
      <span className="progress-badge__stars">
        ★ <b>{stars}</b>
        {next && <small> / {next.starsRequired}</small>}
      </span>
    </button>
  )
}

/**
 * レベルの一覧（ユーザー要望）：いまのレベル・次のレベルまでの星（バー）と、各レベルでできること。
 * まだのレベルも、何ができるようになるかは見える（鍵の絵）。どこを押しても閉じる。
 */
export function LevelGuide() {
  const open = useGameStore((s) => s.levelsOpen)
  const close = useGameStore((s) => s.toggleLevels)
  const stars = useProgressStore((s) => s.stars)
  const level = useLevel()
  // レベルが増えて一覧がのびたので、開いたら いまのレベルの行が見えるところまで送る
  const nowRow = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (open) nowRow.current?.scrollIntoView({ block: 'nearest' })
  }, [open])
  if (!open) return null
  const next = nextLevel(level.level)
  const ratio = next ? Math.min(1, (stars - level.starsRequired) / (next.starsRequired - level.starsRequired)) : 1
  return (
    <div className="map" onClick={close} role="dialog" aria-label="レベル">
      <div className="levels">
        <div className="levels__head">
          <span className="levels__now">Lv{level.level}</span>
          <div className="levels__progress">
            <div className="levels__bar">
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
            <div className="levels__next">
              {next ? (
                <>
                  ★ <b>{stars}</b> / {next.starsRequired}　あと <b className="is-rest">{next.starsRequired - stars}</b>こで Lv{next.level}
                </>
              ) : (
                <>★ <b>{stars}</b>　さいこう レベル！</>
              )}
            </div>
          </div>
        </div>
        <ol className="levels__list">
          {LEVELS.map((l) => {
            const state = l.level < level.level ? 'done' : l.level === level.level ? 'now' : 'locked'
            const perk = PERKS[l.level]
            return (
              <li key={l.level} ref={state === 'now' ? nowRow : undefined} className={`levels__row is-${state}`}>
                <span className="levels__badge">Lv{l.level}</span>
                <span className="levels__icon" aria-hidden>
                  {state === 'locked' ? '🔒' : perk.icon}
                </span>
                <span className="levels__lines">
                  {/* 項目ごとに「・」で区切る（スペースだけだと区切りが分かりにくい） */}
                  {perk.lines.map((t) => (
                    <span key={t} className="levels__item">
                      {t}
                    </span>
                  ))}
                </span>
                <span className="levels__req">{state === 'done' ? '✓' : `★${l.starsRequired}`}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
