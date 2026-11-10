// Spec 09 task 1b: the lantern's lights must never be hidden. three.js builds its light state from
// visible lights, so toggling `visible` changes the light count and recompiles every lit material,
// a hitch each time the lantern is switched or runs dry. Off and empty use intensity 0 instead.
import source from './Lantern.tsx?raw'

describe('Lantern light count stays fixed', () => {
  it('never assigns .visible on its lights', () => {
    expect(source).not.toMatch(/\.visible\s*=/)
  })

  it('turns the beam off with intensity 0 and skips the shadow redraw while dark', () => {
    expect(source).toMatch(/spot\.current\.intensity = beam \? SPOT_PEAK \* k : 0/)
    expect(source).toMatch(/fill\.current\.intensity = beam \? FILL_PEAK \* k : 0/)
    expect(source).toMatch(/ember\.current\.intensity = on && empty \? EMBER_INTENSITY \* wave : 0/)
    expect(source).toMatch(/spot\.current\.shadow\.autoUpdate = beam/)
  })
})
