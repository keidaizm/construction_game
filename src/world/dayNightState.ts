import * as THREE from 'three'

/**
 * 昼と夜の進み具合。DayNight が毎フレーム書き、太陽光・ライトなどが読む（React の state ではない）。
 * darkness：0 = 昼 / 1 = 夜（ボタンを押すと夕焼け・朝焼けを通ってゆっくり変わる）
 */
export const dayNight = { darkness: 0 }

/** 昼 → 夕焼け → 夜 の 3 色の間を darkness で補間する */
export function blend3(out: THREE.Color, day: THREE.Color, dusk: THREE.Color, night: THREE.Color, t: number) {
  if (t < 0.5) return out.copy(day).lerp(dusk, t * 2)
  return out.copy(dusk).lerp(night, (t - 0.5) * 2)
}
