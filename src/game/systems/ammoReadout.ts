/** Pure text builder for the HUD ammunition readout (spec 07, requirement 7). */

export type AmmoLabelId = 'reloading' | 'empty' | 'no-ammo';

export interface AmmoLabel {
  id: AmmoLabelId;
  /** A distinct shape per state so the readout never relies on colour alone. */
  glyph: string;
  text: string;
}

export interface AmmoReadout {
  /** "M / S" */
  count: string;
  labels: AmmoLabel[];
}

export interface AmmoReadoutInput {
  /** False when no firearm is in hand: no readout at all. */
  firearmEquipped: boolean;
  magazine: number;
  stack: number;
  /** Seconds left on a running reload, or null when not reloading. */
  reloadSecondsLeft: number | null;
}

export const AMMO_GLYPHS = { reloading: '\u27F3', empty: '\u25CB', 'no-ammo': '\u2715' } as const;

/** Quantise to 0.1 s so the HUD only needs to refresh every 100 ms. */
export function quantiseReloadSeconds(seconds: number): number {
  return Math.round(Math.max(0, seconds) * 10) / 10;
}

export function ammoReadout(input: AmmoReadoutInput): AmmoReadout | null {
  if (!input.firearmEquipped) return null;
  const labels: AmmoLabel[] = [];
  if (input.reloadSecondsLeft !== null) {
    labels.push({
      id: 'reloading',
      glyph: AMMO_GLYPHS.reloading,
      text: `Reloading ${quantiseReloadSeconds(input.reloadSecondsLeft).toFixed(1)} s`,
    });
  }
  if (input.magazine <= 0) labels.push({ id: 'empty', glyph: AMMO_GLYPHS.empty, text: 'Empty' });
  if (input.stack <= 0) labels.push({ id: 'no-ammo', glyph: AMMO_GLYPHS['no-ammo'], text: 'No ammo' });
  return { count: `${input.magazine} / ${input.stack}`, labels };
}
