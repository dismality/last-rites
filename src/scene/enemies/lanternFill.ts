// Zombie skins carry a faint cold self-fill (zombieMaterial.ts) so the warm lantern does not paint
// them orange. Emissive light ignores the dark, though, so on its own the fill made every zombie
// glow blue-grey with the lantern out. This patch scales the fill by the lantern: full at the
// player, fading to nothing at the edge of the lantern's reach, and none at all while it is out.
// Rendering only; the uniforms are shared by every zombie material and written once a frame.
import * as THREE from 'three'

export const lanternFillUniforms = {
  uFillOrigin: { value: new THREE.Vector3() },
  /** Metres at which the fill reaches zero. */
  uFillReach: { value: 1 },
  /** 1 while the lantern casts light, else 0. */
  uFillOn: { value: 0 },
}

/** Patch a zombie material so its emissive fill follows the lantern. Idempotent per material. */
export function applyLanternFill(m: THREE.Material): void {
  if (m.userData.lanternFill) return
  m.userData.lanternFill = true
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lanternFillUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFillWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvFillWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vFillWorld;\nuniform vec3 uFillOrigin;\nuniform float uFillReach;\nuniform float uFillOn;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uFillOn * clamp(1.0 - distance(vFillWorld, uFillOrigin) / max(uFillReach, 0.001), 0.0, 1.0);',
      )
  }
  m.customProgramCacheKey = () => 'zombie-lantern-fill'
  m.needsUpdate = true
}
