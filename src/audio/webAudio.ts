import type { AudioManager, SoundId } from './AudioManager'
import type { VehicleId } from '../vehicles/types'

const MUTE_KEY = 'kenki-asobi-muted'

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** エンジンの音色（車両ごと）。base = アイドリングの高さ [Hz]、range = 全開で上がる分 */
const ENGINE_PROFILE: Record<VehicleId, { base: number; range: number; chug: number; volume: number }> = {
  excavator: { base: 36, range: 26, chug: 11, volume: 0.11 },
  dumpTruck: { base: 44, range: 58, chug: 15, volume: 0.1 },
  bulldozer: { base: 30, range: 34, chug: 9, volume: 0.13 },
  // クレーンは電気モーターのうなり（低く、ドコドコしない）
  crane: { base: 55, range: 40, chug: 0, volume: 0.05 },
}

/**
 * Web Audio で音を合成する。
 * - エンジン：のこぎり波＋矩形波をローパスに通し、低い周波数で音量をゆらして「ドドド」というディーゼルらしさを出す
 * - 油圧：ノイズを帯域フィルタに通した「シャー」と、低い「ウィーン」
 * - 効果音：ノイズと正弦波の短い音を、その場で作って鳴らす
 * ブラウザは最初のタッチ／キー操作までは音を出せないので、その時点で AudioContext を作る。
 */
export function createWebAudioManager(): AudioManager {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null

  // エンジン
  let engineOsc1: OscillatorNode | null = null
  let engineOsc2: OscillatorNode | null = null
  let engineFilter: BiquadFilterNode | null = null
  let engineGain: GainNode | null = null
  let chugOsc: OscillatorNode | null = null
  let chugDepth: GainNode | null = null
  // 油圧
  let hydraulicGain: GainNode | null = null
  let hydraulicWhine: OscillatorNode | null = null
  // バックの警告音
  let alarmGain: GainNode | null = null
  let alarmTimer: number | null = null

  let muted = loadMuted()
  let engineVehicle: VehicleId = 'excavator'
  let engineLoad = 0

  const now = () => ctx!.currentTime

  function makeNoise(c: AudioContext) {
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
    noise = makeNoise(ctx)
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)

    // --- エンジン ---
    engineFilter = ctx.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 380
    engineGain = ctx.createGain()
    engineGain.gain.value = 0
    engineOsc1 = ctx.createOscillator()
    engineOsc1.type = 'sawtooth'
    engineOsc2 = ctx.createOscillator()
    engineOsc2.type = 'square'
    const osc2Gain = ctx.createGain()
    osc2Gain.gain.value = 0.5
    engineOsc1.connect(engineFilter)
    engineOsc2.connect(osc2Gain).connect(engineFilter)
    // 「ドドド」：低い周波数で音量をゆらす
    const chugGain = ctx.createGain()
    chugGain.gain.value = 1
    chugOsc = ctx.createOscillator()
    chugOsc.type = 'sine'
    chugDepth = ctx.createGain()
    chugDepth.gain.value = 0.35
    chugOsc.connect(chugDepth).connect(chugGain.gain)
    engineFilter.connect(chugGain).connect(engineGain).connect(master)
    engineOsc1.start()
    engineOsc2.start()
    chugOsc.start()

    // --- 油圧 ---
    hydraulicGain = ctx.createGain()
    hydraulicGain.gain.value = 0
    const hiss = ctx.createBufferSource()
    hiss.buffer = noise
    hiss.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1100
    band.Q.value = 1.2
    const hissGain = ctx.createGain()
    hissGain.gain.value = 0.5
    hiss.connect(band).connect(hissGain).connect(hydraulicGain)
    hydraulicWhine = ctx.createOscillator()
    hydraulicWhine.type = 'triangle'
    hydraulicWhine.frequency.value = 180
    const whineGain = ctx.createGain()
    whineGain.gain.value = 0.35
    hydraulicWhine.connect(whineGain).connect(hydraulicGain)
    hydraulicGain.connect(master)
    hiss.start()
    hydraulicWhine.start()

    // --- バックの警告音 ---
    alarmGain = ctx.createGain()
    alarmGain.gain.value = 0
    const alarm = ctx.createOscillator()
    alarm.type = 'square'
    alarm.frequency.value = 1150
    const alarmVolume = ctx.createGain()
    alarmVolume.gain.value = 0.045
    alarm.connect(alarmVolume).connect(alarmGain).connect(master)
    alarm.start()

    applyEngine()
  }

  // 最初の操作で音を出せるようにする
  const unlock = () => start()
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)

  // ほかのアプリ・タブ・ウィンドウに切りかえたら音を止め、戻ってきたら再開する（ユーザー要望）。
  // AudioContext ごと止めるので、エンジン音などの鳴りっぱなしの音も消える
  const pause = () => {
    if (ctx && ctx.state === 'running') void ctx.suspend()
  }
  const resume = () => {
    if (ctx && ctx.state === 'suspended' && document.visibilityState === 'visible' && document.hasFocus()) void ctx.resume()
  }
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? pause() : resume()))
  window.addEventListener('blur', pause)
  window.addEventListener('focus', resume)
  window.addEventListener('pagehide', pause)

  function applyEngine() {
    if (!ctx || !engineOsc1 || !engineOsc2 || !engineGain || !engineFilter || !chugOsc) return
    const p = ENGINE_PROFILE[engineVehicle]
    const f = p.base + p.range * engineLoad
    const t = now()
    engineOsc1.frequency.setTargetAtTime(f, t, 0.15)
    engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.15)
    chugOsc.frequency.setTargetAtTime(p.chug + engineLoad * 10, t, 0.15)
    engineFilter.frequency.setTargetAtTime(320 + engineLoad * 700, t, 0.15)
    engineGain.gain.setTargetAtTime(p.volume * (0.55 + engineLoad * 0.6), t, 0.2)
  }

  /** 短い音の包絡（すぐ大きくなって、なめらかに消える） */
  function envelope(gain: GainNode, peak: number, attack: number, decay: number, delay = 0) {
    const t = now() + delay
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  /** 石の音：ノイズの「ザッ」と、低い正弦波の「ドン」 */
  function thud(pitch: number, volume: number, length: number, delay = 0) {
    if (!ctx || !master || !noise) return
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.playbackRate.value = 0.6 + Math.random() * 0.3
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500 + pitch * 4
    const g = ctx.createGain()
    src.connect(lp).connect(g).connect(master)
    envelope(g, volume, 0.005, length, delay)
    src.start(now() + delay, Math.random())
    src.stop(now() + delay + length + 0.05)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(pitch, now() + delay)
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now() + delay + length)
    const og = ctx.createGain()
    osc.connect(og).connect(master)
    envelope(og, volume * 1.2, 0.004, length, delay)
    osc.start(now() + delay)
    osc.stop(now() + delay + length + 0.05)
  }

  /** 楽器のような音（ファンファーレ用） */
  function note(freq: number, delay: number, length: number, volume = 0.12, type: OscillatorType = 'triangle') {
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    osc.connect(g).connect(master)
    envelope(g, volume, 0.01, length, delay)
    osc.start(now() + delay)
    osc.stop(now() + delay + length + 0.05)
  }

  /** 高さが変わる短い音（ポコッ など） */
  function blip(from: number, to: number, length: number, volume: number) {
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(from, now())
    osc.frequency.exponentialRampToValueAtTime(to, now() + length)
    const g = ctx.createGain()
    osc.connect(g).connect(master)
    envelope(g, volume, 0.005, length)
    osc.start()
    osc.stop(now() + length + 0.05)
  }

  const sounds: Record<SoundId, () => void> = {
    rockHit: () => thud(110 + Math.random() * 30, 0.35, 0.16),
    rockDrop: () => {
      thud(80 + Math.random() * 30, 0.4, 0.22)
      thud(95 + Math.random() * 30, 0.2, 0.15, 0.09)
    },
    rockLoad: () => thud(70 + Math.random() * 20, 0.45, 0.25),
    count: () => blip(620, 980, 0.12, 0.16),
    missionClear: () => {
      // ド・ミ・ソ・ド〜（最後は和音）
      ;[523, 659, 784].forEach((f, i) => note(f, i * 0.13, 0.18))
      ;[1047, 784, 659].forEach((f) => note(f, 0.42, 0.9, 0.1))
    },
    levelUp: () => {
      ;[392, 523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.08, 0.25, 0.1, 'square'))
    },
    switch: () => blip(500, 750, 0.08, 0.1),
    dig: () => {
      thud(60 + Math.random() * 20, 0.3, 0.2)
      thud(140 + Math.random() * 40, 0.15, 0.12, 0.05)
    },
    find: () => {
      ;[1319, 1760, 2093].forEach((f, i) => note(f, i * 0.07, 0.3, 0.08, 'sine'))
    },
    hammer: () => {
      // かたい物を叩く「ガッ」：高めのノイズと短い金属音
      thud(220 + Math.random() * 60, 0.22, 0.06)
      blip(1400 + Math.random() * 200, 900, 0.04, 0.05)
    },
    crack: () => {
      thud(55, 0.5, 0.35)
      ;[0.06, 0.13, 0.21, 0.3].forEach((d) => thud(90 + Math.random() * 60, 0.28, 0.18, d))
    },
    findNew: () => {
      ;[1047, 1319, 1568, 2093, 2637].forEach((f, i) => note(f, i * 0.08, 0.45, 0.09, 'sine'))
      ;[523, 659, 784].forEach((f) => note(f, 0.45, 0.8, 0.07))
    },
  }

  return {
    get muted() {
      return muted
    },
    setMuted(value) {
      muted = value
      try {
        localStorage.setItem(MUTE_KEY, value ? '1' : '0')
      } catch {
        // 保存できなくても、この回だけは反映される
      }
      if (ctx && master) master.gain.setTargetAtTime(value ? 0 : 1, now(), 0.05)
    },
    play(id) {
      if (!ctx || muted) return
      sounds[id]()
    },
    setEngine(vehicle, load) {
      const l = Math.max(0, Math.min(1, load))
      if (vehicle === engineVehicle && Math.abs(l - engineLoad) < 0.02) return
      engineVehicle = vehicle
      engineLoad = l
      applyEngine()
    },
    setHydraulicLoad(load) {
      if (!ctx || !hydraulicGain || !hydraulicWhine) return
      const l = Math.max(0, Math.min(1, load))
      hydraulicGain.gain.setTargetAtTime(l * 0.09, now(), 0.08)
      hydraulicWhine.frequency.setTargetAtTime(150 + l * 140, now(), 0.1)
    },
    setReversing(on) {
      if (!ctx || !alarmGain) return
      if (on && alarmTimer === null) {
        let beep = true
        const tick = () => {
          if (!ctx || !alarmGain) return
          alarmGain.gain.setTargetAtTime(beep ? 1 : 0, now(), 0.01)
          beep = !beep
        }
        tick()
        alarmTimer = window.setInterval(tick, 380)
      } else if (!on && alarmTimer !== null) {
        clearInterval(alarmTimer)
        alarmTimer = null
        alarmGain.gain.setTargetAtTime(0, now(), 0.02)
      }
    },
  }
}
