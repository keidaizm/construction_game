import * as THREE from 'three'

/** 簡単な疑似乱数（毎回同じ見た目にするため） */
export function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** 地面の細かい模様の明るさの平均（リニア）。地面の色はこれで割って、模様を掛けたときにちょうどの色になるようにする */
export const GROUND_DETAIL_LEVEL = 0.855

/**
 * 地帯で色を変える地面用の、色のない（灰色の）模様テクスチャ。Canvas で生成する
 * （画像ファイルを持たずに済み、ライセンスの心配もない）。
 * 地面の頂点カラー（地帯の色）と掛け合わせて使う。
 */
export function createGroundDetailTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rand = seededRandom(7)

  ctx.fillStyle = '#eeeeee'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 40; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 10 + rand() * 40
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const shade = rand() < 0.5 ? '170,170,170' : '255,255,255'
    g.addColorStop(0, 'rgba(' + shade + ',0.35)')
    g.addColorStop(1, 'rgba(' + shade + ',0)')
    ctx.fillStyle = g
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.save()
        ctx.translate(dx, dy)
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
        ctx.restore()
      }
    }
  }
  for (let i = 0; i < 1800; i++) {
    const v = 150 + Math.floor(rand() * 105)
    ctx.fillStyle = `rgba(${v},${v},${v},${(0.3 + rand() * 0.5).toFixed(2)})`
    const s = 1 + rand() * 2
    ctx.fillRect(rand() * size, rand() * size, s, s)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
