// The Dev_Panel: a parchment panel with every playtest shortcut. Opened with the backquote key,
// only when dev mode is enabled (see installDev). It lives in its own React root, outside App.

import { useState, type ReactNode } from 'react'
import { SCARE_EVENTS, type ScareEventId } from '../data/scares'
import type { WeaponPickupId } from '../data/weaponPickups'
import type { ItemId, MaterialId } from '../game/types'
import {
  completeObjective,
  giveEverything,
  giveKeyItem,
  giveMaterial,
  givePage,
  giveRelic,
  giveWeapon,
  killAll,
  setChapelLevel,
  setTime,
  skipToNight,
  spawnCrane,
  spawnOneOfEach,
  spawnWave,
  teleportTo,
  teleportToObjective,
  triggerEnding,
  triggerScare,
  unlockAllRecipes,
  type TimeTarget,
} from './devActions'
import { refillAll, setCheats, useDevCheatStore, type TimeScale } from './devCheats'
import {
  CRAFTED_GIVE_IDS,
  ENDING_IDS,
  KEY_ITEM_IDS,
  MATERIAL_IDS,
  PAGE_NUMBERS,
  RELIC_IDS,
  TELEPORT_GROUPS,
  TELEPORT_POINTS,
} from './devData'
import { SENSOR_COLOR, SOLID_COLOR, useDebugReadout, useDebugViewStore } from './debugViews'
import { useDevPanelStore } from './devPanelStore'
import './devPanel.css'

const TIMES: readonly TimeTarget[] = ['dawn', 'midday', 'dusk', 'night']
const SCALES: readonly TimeScale[] = [1, 5, 20]
const NIGHTS = [1, 2, 3, 4, 5] as const
const LEVELS = [0, 1, 2, 3] as const
const WEAPONS: readonly WeaponPickupId[] = ['revolver', 'shotgun', 'wood-axe', 'silver-sabre']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details>
      <summary>{title}</summary>
      {children}
    </details>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="dev-panel__row">{children}</div>
}

/** A toggle: filled when on, and the label carries a check mark so colour is not the only cue. */
function Toggle({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onToggle}>
      {on ? '\u2713 ' : ''}
      {label}
    </button>
  )
}

export function DevPanel() {
  const open = useDevPanelStore((s) => s.open)
  const close = useDevPanelStore((s) => s.close)
  const cheats = useDevCheatStore()
  const views = useDebugViewStore()
  const [status, setStatus] = useState('Backquote closes this panel')
  const [material, setMaterial] = useState<MaterialId>(MATERIAL_IDS[0])
  const [qty, setQty] = useState(10)
  const [crafted, setCrafted] = useState<ItemId>(CRAFTED_GIVE_IDS[0])
  const [scare, setScare] = useState<ScareEventId>(SCARE_EVENTS[0].id)

  if (!open) return null
  const run = (fn: () => string) => () => setStatus(fn())

  return (
    // Keys typed here must not reach the game's window-level input listener.
    <aside
      className="dev-panel"
      aria-label="Developer panel"
      onKeyDown={(e) => {
        if (e.code !== 'Backquote') e.stopPropagation()
      }}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div className="dev-panel__head">
        <span>Dev panel</span>
        <button type="button" onClick={close} aria-label="Close developer panel">
          Close
        </button>
      </div>
      <div className="dev-panel__body">
        <Section title="Teleport">
          <Row>
            <button type="button" onClick={run(teleportToObjective)}>
              To current objective
            </button>
          </Row>
          <Row>
            {TELEPORT_POINTS.map((p) => (
              <button key={p.id} type="button" onClick={run(() => teleportTo(p.x, p.z, p.yaw))}>
                {p.label}
              </button>
            ))}
          </Row>
          {TELEPORT_GROUPS.map((g) => (
            <Row key={g.title}>
              <span className="dev-panel__label">{g.title}:</span>
              {g.points.map((p) => (
                <button key={p.id} type="button" onClick={run(() => teleportTo(p.x, p.z, p.yaw))}>
                  {p.label}
                </button>
              ))}
            </Row>
          ))}
        </Section>

        <Section title="Time">
          <Row>
            {TIMES.map((t) => (
              <button key={t} type="button" onClick={run(() => setTime(t))}>
                {t === 'night' ? 'Night start' : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </Row>
          <Row>
            {SCALES.map((s) => (
              <Toggle
                key={s}
                on={cheats.timeScale === s}
                label={`${s}x`}
                onToggle={() => {
                  setCheats({ timeScale: s })
                  setStatus(`Time speed ${s}x`)
                }}
              />
            ))}
          </Row>
          <Row>
            {NIGHTS.map((n) => (
              <button key={n} type="button" onClick={run(() => skipToNight(n))}>
                Night {n}
              </button>
            ))}
          </Row>
        </Section>

        <Section title="Waves and enemies">
          <Row>
            <button type="button" onClick={run(spawnWave)}>
              Spawn wave
            </button>
            <button type="button" onClick={run(killAll)}>
              Kill all
            </button>
            <button type="button" onClick={run(spawnOneOfEach)}>
              One of each (+ elites)
            </button>
            <button type="button" onClick={run(spawnCrane)}>
              Spawn Father Crane
            </button>
          </Row>
        </Section>

        <Section title="Cheats">
          <Row>
            <Toggle on={cheats.god} label="God mode" onToggle={() => setCheats({ god: !cheats.god })} />
            <Toggle
              on={cheats.infiniteOil}
              label="Infinite oil"
              onToggle={() => setCheats({ infiniteOil: !cheats.infiniteOil })}
            />
            <Toggle
              on={cheats.infiniteStamina}
              label="Infinite stamina"
              onToggle={() => setCheats({ infiniteStamina: !cheats.infiniteStamina })}
            />
            <Toggle
              on={cheats.noclip}
              label="Noclip"
              onToggle={() => setCheats({ noclip: !cheats.noclip })}
            />
            <button
              type="button"
              onClick={run(() => {
                refillAll()
                return 'Health, oil and stamina refilled'
              })}
            >
              Refill
            </button>
          </Row>
        </Section>

        <Section title="Give">
          <Row>
            <select
              aria-label="Material"
              value={material}
              onChange={(e) => setMaterial(e.target.value as MaterialId)}
            >
              {MATERIAL_IDS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              aria-label="Amount"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
            <button type="button" onClick={run(() => giveMaterial(material, qty))}>
              Give
            </button>
          </Row>
          <Row>
            <select
              aria-label="Crafted item or ammunition"
              value={crafted}
              onChange={(e) => setCrafted(e.target.value as ItemId)}
            >
              {CRAFTED_GIVE_IDS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button type="button" onClick={run(() => giveMaterial(crafted, qty))}>
              Give
            </button>
          </Row>
          <Row>
            {WEAPONS.map((w) => (
              <button key={w} type="button" onClick={run(() => giveWeapon(w))}>
                {w}
              </button>
            ))}
          </Row>
          <Row>
            {KEY_ITEM_IDS.map((k) => (
              <button key={k} type="button" onClick={run(() => giveKeyItem(k))}>
                {k}
              </button>
            ))}
          </Row>
          <Row>
            {RELIC_IDS.map((r) => (
              <button key={r} type="button" onClick={run(() => giveRelic(r))}>
                {r}
              </button>
            ))}
          </Row>
          <Row>
            {PAGE_NUMBERS.map((n) => (
              <button key={n} type="button" onClick={run(() => givePage(n))}>
                Page {n}
              </button>
            ))}
          </Row>
          <Row>
            <button type="button" onClick={run(giveEverything)}>
              Give everything
            </button>
          </Row>
        </Section>

        <Section title="Progress">
          <Row>
            <button type="button" onClick={run(completeObjective)}>
              Complete objective
            </button>
            <button type="button" onClick={run(unlockAllRecipes)}>
              Unlock all recipes
            </button>
          </Row>
          <Row>
            <span>Chapel repairs</span>
            {LEVELS.map((l) => (
              <button key={l} type="button" onClick={run(() => setChapelLevel(l))}>
                {l}
              </button>
            ))}
          </Row>
          <Row>
            <select
              aria-label="Scare"
              value={scare}
              onChange={(e) => setScare(e.target.value as ScareEventId)}
            >
              {SCARE_EVENTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </select>
            <button type="button" onClick={run(() => triggerScare(scare))}>
              Trigger scare
            </button>
          </Row>
          <Row>
            {ENDING_IDS.map((e) => (
              <button key={e} type="button" onClick={run(() => triggerEnding(e))}>
                Ending: {e}
              </button>
            ))}
          </Row>
        </Section>

        <Section title="Debug views">
          <Row>
            <Toggle
              on={views.colliders}
              label="Collider wireframes"
              onToggle={() => useDebugViewStore.setState({ colliders: !views.colliders })}
            />
            <Toggle
              on={views.stats}
              label="FPS and draw calls"
              onToggle={() => useDebugViewStore.setState({ stats: !views.stats })}
            />
            <Toggle
              on={views.position}
              label="Position and objective"
              onToggle={() => useDebugViewStore.setState({ position: !views.position })}
            />
          </Row>
          <p className="dev-legend">
            <span className="dev-legend__solid" style={{ color: `#${SOLID_COLOR.toString(16)}` }}>
              solid
            </span>{' '}
            <span className="dev-legend__sensor" style={{ color: `#${SENSOR_COLOR.toString(16)}` }}>
              sensor
            </span>
          </p>
        </Section>
      </div>
      <div className="dev-panel__status" role="status" aria-live="polite">
        {status}
      </div>
    </aside>
  )
}

/** Small readout at the top centre, shown while a stats or position view is on. */
export function DebugOverlay() {
  const views = useDebugViewStore()
  const r = useDebugReadout()
  if (!views.stats && !views.position) return null
  const lines: string[] = []
  if (views.stats) lines.push(`FPS ${r.fps}   Draw calls ${r.drawCalls ?? 'n/a'}`)
  if (views.position) {
    const f = r.feet
    lines.push(f ? `Pos ${f[0].toFixed(1)}, ${f[1].toFixed(1)}, ${f[2].toFixed(1)}` : 'Pos n/a')
    lines.push(`Objective ${r.objectiveRule ?? '-'}  ${r.objectiveText}`)
  }
  return <div className="dev-overlay">{lines.join('\n')}</div>
}
