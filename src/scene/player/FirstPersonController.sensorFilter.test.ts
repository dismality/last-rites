// Regression guard for the playtest blocker (spec 09, B1): without EXCLUDE_SENSORS the Rapier
// character controller treats every scare-zone sensor as a wall, so items inside them
// (crypt key, whistle, relics, pages) cannot be reached and the game cannot be finished.
import source from './FirstPersonController.tsx?raw'

describe('FirstPersonController sensor filter', () => {
  it('passes EXCLUDE_SENSORS to computeColliderMovement', () => {
    const call = source.slice(source.indexOf('kcc.computeColliderMovement('))
    const args = call.slice(0, call.indexOf('const m = kcc.computedMovement()'))
    expect(args).toContain('QueryFilterFlags.EXCLUDE_SENSORS')
  })

  it('takes rapier from useRapier so the flag comes from the loaded module', () => {
    expect(source).toMatch(/const \{[^}]*\brapier\b[^}]*\} = useRapier\(\)/)
  })
})
