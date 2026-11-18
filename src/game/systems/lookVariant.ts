export type LookIndex = 0 | 1 | 2 | 3;

export const FALLBACK_CLIP = 'Idle';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit. A stable string hash, so a zombie keeps its look across saves and reloads. */
export function fnv1a32(text: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

export function lookIndex(uid: string): LookIndex {
  return (fnv1a32(uid) % 4) as LookIndex;
}

const LOOK_PREFIX = 'look-'

export function lookMeshName(index: LookIndex): string {
  return `${LOOK_PREFIX}${index}`
}

/**
 * Which of a model's meshes to draw for a look. The chosen `look-N` alone when the file has it;
 * otherwise the base meshes (every mesh that is not a `look-*`), never a look-* mesh, so a creature
 * shows exactly one body. A model with no look-* meshes at all draws its base unchanged.
 */
export function visibleMeshNames(meshNames: readonly string[], index: LookIndex): ReadonlySet<string> {
  const chosen = lookMeshName(index)
  if (meshNames.includes(chosen)) return new Set([chosen])
  return new Set(meshNames.filter((n) => !n.startsWith(LOOK_PREFIX)))
}

/**
 * The tint to apply, or undefined to keep the file's own materials.
 * A look with variants tints only where the chosen variant defines one; a look without variants
 * keeps its single per-type tint.
 */
export function lookTint(
  look: { tint: string; variants?: readonly { tint?: string }[] },
  index: LookIndex,
): string | undefined {
  return look.variants ? look.variants[index]?.tint : look.tint
}

const warned = new Set<string>();

/** Test hook: forget which (model, clip) pairs have already warned. */
export function resetClipWarnings(): void {
  warned.clear();
}

/**
 * Returns the requested clip if the model has it, otherwise `Idle`.
 * A missing clip warns once per (model, clip) pair so a per-frame call cannot flood the console.
 */
export function resolveClip(
  requested: string,
  available: readonly string[],
  model = '',
  warn: (message: string) => void = (m) => console.warn(m),
): string {
  if (available.includes(requested)) return requested;
  const key = `${model}\u0000${requested}`;
  if (!warned.has(key)) {
    warned.add(key);
    warn(`Model "${model}" has no clip "${requested}"; using ${FALLBACK_CLIP}`);
  }
  return FALLBACK_CLIP;
}
