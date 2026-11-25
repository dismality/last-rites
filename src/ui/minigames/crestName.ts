// The words for a crest on Kerr's locker dial, kept apart from the drawings so fast refresh works.

/** "raven on a coffin". */
export const crestName = (c: { beast: string; object: string }): string => `${c.beast} on a ${c.object}`
