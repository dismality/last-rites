// Enemies spawned by the scare stager carry this uid prefix so combat can treat their blows as non-lethal.
export const SCARE_ENEMY_PREFIX = 'scare-'

export function isScareEnemy(uid: string): boolean {
  return uid.startsWith(SCARE_ENEMY_PREFIX)
}
