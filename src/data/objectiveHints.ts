// Near / far hint switch (spec 09 task 11o, design bible §11). A hint that names a key and an
// object only makes sense within reach, so away from it the tracker says where to go instead.

/** The hint turns "near" (key and action) inside this distance, in the same building. */
export const HINT_NEAR_M = 6

/** ...and turns "far" (where to go) again only past this one, so the edge never flickers. */
export const HINT_FAR_M = 8

/** Where a tutorial step's object is. Resolved against world data by `tutorialTarget`. */
export type HintPlace =
  | { readonly kind: 'spawn-point'; readonly id: string }
  | { readonly kind: 'fixed-spawn'; readonly id: string }
  | { readonly kind: 'workbench' }
