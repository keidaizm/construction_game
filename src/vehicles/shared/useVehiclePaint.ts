import { useEffect, useMemo, type DependencyList, type RefObject } from 'react'
import * as THREE from 'three'
import { paintYellow } from './materials'
import { useCraftStore } from '../../stores/craftStore'
import { PAINTS, type PaintableVehicle } from '../../base/craftRecipes'

/** ペンキの色を材料に当てはめる（操作中に光らせる emissive の色は、部位の材料ではそのまま） */
function applyPaint(m: THREE.MeshStandardMaterial, paintId: string, keepEmissive: boolean) {
  const p = PAINTS.find((x) => x.id === paintId) ?? PAINTS[0]
  m.color.set(p.color)
  m.metalness = p.metalness
  m.roughness = p.roughness
  if (!keepEmissive) {
    m.emissive.set(p.emissive ?? '#000000')
    m.emissiveIntensity = p.emissive ? 1 : 0
  }
}

/**
 * 車庫で選んだ色を、その車両に塗る（ユーザー提案）。
 * 車両の中で共有の黄色（paintYellow）を使っているメッシュを、この車両だけの色の材料に入れかえ、
 * 操作中に光らせる部位の材料（ブーム・荷台など）の色もそろえる。
 * deps：見た目の部品が作り直されたとき（レベル・アタッチメントなど）に塗り直すため
 */
export function useVehiclePaint(
  vehicle: PaintableVehicle,
  root: RefObject<THREE.Object3D | null>,
  partPaints: readonly THREE.MeshStandardMaterial[],
  deps: DependencyList,
) {
  const paintId = useCraftStore((s) => s.vehicleColors[vehicle])
  const body = useMemo(() => paintYellow.clone(), [])
  useEffect(() => () => body.dispose(), [body])

  useEffect(() => {
    applyPaint(body, paintId, false)
    for (const m of partPaints) applyPaint(m, paintId, true)
    root.current?.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      if (mesh.material === paintYellow) mesh.material = body
      else if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => (m === paintYellow ? body : m))
    })
    // deps は呼び出し側が決める（部品が作り直されたら塗り直す）
  }, [paintId, body, root, ...partPaints, ...deps])
}
