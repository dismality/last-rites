// World dim for screen jumpscares (spec 11 H1): multiplies the image by a brightness the overlay
// writes into `screenScareRuntime` each frame (1 = untouched, 0.3 during the hold of a Full scare).
// It sits on the post-processing stack after tone mapping, so it dims the finished picture.
import { Effect } from 'postprocessing'
import { Uniform } from 'three'
import { wrapEffect } from '@react-three/postprocessing'
import { screenScareRuntime } from '../../game/state/screenScareStore'

const fragmentShader = /* glsl */ `
uniform float uBrightness;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * uBrightness, inputColor.a);
}
`

export class WorldDimEffect extends Effect {
  constructor() {
    super('WorldDimEffect', fragmentShader, { uniforms: new Map([['uBrightness', new Uniform(1)]]) })
  }

  update(): void {
    const u = this.uniforms.get('uBrightness')
    if (u) u.value = screenScareRuntime.brightness
  }
}

export const WorldDim = wrapEffect(WorldDimEffect)
