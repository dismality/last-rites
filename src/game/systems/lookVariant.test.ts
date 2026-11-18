import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  fnv1a32,
  lookIndex,
  lookMeshName,
  lookTint,
  resetClipWarnings,
  resolveClip,
  visibleMeshNames,
  type LookIndex,
} from './lookVariant';

const INDEXES: LookIndex[] = [0, 1, 2, 3];

describe('visibleMeshNames', () => {
  it('shows only the chosen look-N and hides the other three', () => {
    const names = ['look-0', 'look-1', 'look-2', 'look-3'];
    for (const i of INDEXES) expect([...visibleMeshNames(names, i)]).toEqual([lookMeshName(i)]);
  });

  it('shows only the base mesh when the chosen variant is missing', () => {
    const names = ['body', 'look-0', 'look-2'];
    expect([...visibleMeshNames(names, 1)]).toEqual(['body']);
  });

  it('draws the base unchanged when the model has no look meshes', () => {
    expect([...visibleMeshNames(['zombie'], 3)]).toEqual(['zombie']);
  });
});

describe('lookTint', () => {
  const variants = [{}, { tint: '#112233' }, {}, {}];
  it('tints only where the variant defines one', () => {
    expect(lookTint({ tint: '#ffffff', variants }, 0)).toBeUndefined();
    expect(lookTint({ tint: '#ffffff', variants }, 1)).toBe('#112233');
  });
  it('keeps the per-type tint for a look without variants', () => {
    expect(lookTint({ tint: '#9aa58a' }, 2)).toBe('#9aa58a');
  });
});

beforeEach(() => resetClipWarnings());

describe('lookIndex', () => {
  it('matches known FNV-1a vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
  });

  // Feature: 11-horror-pass, Property 14: Look variant is deterministic and in range
  // **Validates: Requirements 3.4**
  it('Property 14: Look variant is deterministic and in range', () => {
    fc.assert(
      fc.property(fc.string(), (uid) => {
        const a = lookIndex(uid);
        expect([0, 1, 2, 3]).toContain(a);
        expect(lookIndex(uid)).toBe(a);
      }),
      { numRuns: 100 },
    );
  });

  it('uses every variant across a few hundred uids', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(lookIndex(`zombie-${i}`));
    expect(seen.size).toBe(4);
  });
});

describe('resolveClip', () => {
  // Feature: 11-horror-pass, Property 15: Clip fallback
  // **Validates: Requirements 3.3**
  it('Property 15: Clip fallback', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.string()),
        fc.string(),
        (requested, available, model) => {
          resetClipWarnings();
          const warnings: string[] = [];
          const warn = (m: string) => warnings.push(m);
          const first = resolveClip(requested, available, model, warn);
          resolveClip(requested, available, model, warn);
          resolveClip(requested, available, model, warn);
          if (available.includes(requested)) {
            expect(first).toBe(requested);
            expect(warnings).toHaveLength(0);
          } else {
            expect(first).toBe('Idle');
            expect(warnings).toHaveLength(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('warns separately for different models or clips', () => {
    const warnings: string[] = [];
    const warn = (m: string) => warnings.push(m);
    resolveClip('Walk', [], 'a', warn);
    resolveClip('Walk', [], 'b', warn);
    resolveClip('Run', [], 'a', warn);
    expect(warnings).toHaveLength(3);
  });
});
