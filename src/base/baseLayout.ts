import { LANDMARKS } from '../world/fieldLayout'

/**
 * 基地の事務所（ユーザー提案）。車両で近づくと「じむしょに はいる？」が出て、中のメニューからえらぶ：
 * - きろく：ずかん・レベル・ちず・家などの記録
 * - こうぼう：鉱石でペンキ・かざりをつくる
 * - しゃこ：車の色をかえる
 * - てんじだな：見つけた鉱石と、つくったかざりを見る
 * （フィールドには建物を増やさない＝ユーザー判断）
 */
export type BaseRoom = 'office' | 'garage' | 'workshop' | 'showcase'

export const OFFICE = { x: LANDMARKS.hut.x, z: LANDMARKS.hut.z, r: LANDMARKS.hut.r }

/** 事務所のかべからこの距離 [m] まで車両で近づくと「じむしょに はいる？」が出る */
export const ENTER_RADIUS = 7
