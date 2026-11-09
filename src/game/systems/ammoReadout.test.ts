import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ammoReadout, quantiseReloadSeconds } from './ammoReadout';

const reload = fc.option(fc.double({ min: 0, max: 5, noNaN: true }), { nil: null });

describe('ammoReadout', () => {
  it('shows nothing without a firearm', () => {
    expect(ammoReadout({ firearmEquipped: false, magazine: 3, stack: 3, reloadSecondsLeft: null })).toBeNull();
  });

  it('shows both labels when magazine and stack are empty', () => {
    const r = ammoReadout({ firearmEquipped: true, magazine: 0, stack: 0, reloadSecondsLeft: null });
    expect(r?.count).toBe('0 / 0');
    expect(r?.labels.map((l) => l.text)).toEqual(['Empty', 'No ammo']);
  });

  it('quantises reload seconds to one decimal', () => {
    expect(quantiseReloadSeconds(1.449)).toBe(1.4);
    const r = ammoReadout({ firearmEquipped: true, magazine: 2, stack: 5, reloadSecondsLeft: 1.4 });
    expect(r?.labels[0].text).toBe('Reloading 1.4 s');
  });

  // Property 14: The ammunition readout is complete and not colour-only
  // **Validates: Requirements 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9**
  it('Property 14: readout is complete and not colour-only', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 36 }),
        reload,
        (firearmEquipped, magazine, stack, reloadSecondsLeft) => {
          const r = ammoReadout({ firearmEquipped, magazine, stack, reloadSecondsLeft });
          if (!firearmEquipped) return r === null;
          if (r === null) return false;
          const by = (id: string) => r.labels.find((l) => l.id === id);
          const glyphs = r.labels.map((l) => l.glyph);
          const rel = by('reloading');
          const relOk =
            reloadSecondsLeft === null
              ? rel === undefined
              : rel !== undefined && /^Reloading \d+\.\d s$/.test(rel.text);
          return (
            r.count === `${magazine} / ${stack}` &&
            (by('empty') !== undefined) === (magazine === 0) &&
            (by('no-ammo') !== undefined) === (stack === 0) &&
            relOk &&
            glyphs.every((g) => g.length > 0) &&
            new Set(glyphs).size === glyphs.length
          );
        },
      ),
    );
  });
});
