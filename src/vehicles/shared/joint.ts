import { clamp } from '../../controls/inputMath'

/** 油圧で動く関節（ブーム・アーム・荷台など）の設定 */
export interface JointConfig {
  /** 初期角度 [rad] */
  initial: number
  min: number
  max: number
  /** レバーを最大に倒したときの角速度 [rad/s] */
  maxSpeed: number
  /** 目標速度への追従の速さ。小さいほど油圧らしく「じわっ」と動く */
  response: number
}

export interface Joint {
  angle: number
  vel: number
}

export const createJoint = (cfg: JointConfig): Joint => ({ angle: cfg.initial, vel: 0 })

/** 指数的に目標値へ近づける（フレームレートに依存しない） */
export const approach = (current: number, target: number, response: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-response * dt))

/** 油圧らしく加減速させながら関節を動かし、可動範囲で止める */
export function stepJoint(j: Joint, cfg: JointConfig, input: number, dt: number) {
  j.vel = approach(j.vel, input * cfg.maxSpeed, cfg.response, dt)
  const next = j.angle + j.vel * dt
  if (next > cfg.max || next < cfg.min) {
    j.angle = clamp(next, cfg.min, cfg.max)
    j.vel = 0
  } else {
    j.angle = next
  }
}
