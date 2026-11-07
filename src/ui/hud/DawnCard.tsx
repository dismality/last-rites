export interface DawnCardProps {
  zombiesBanished: number
  itemsFound: number
  recipeUnlocked: string | null
  journalPageAvailable: boolean
}

/** Stub dawn summary card; later specs wire real data and show/hide logic. */
export function DawnCard({ zombiesBanished, itemsFound, recipeUnlocked, journalPageAvailable }: DawnCardProps) {
  return (
    <section className="hud-dawn" aria-label="Dawn summary">
      <h2 className="hud-dawn__title">Dawn</h2>
      <ul className="hud-dawn__list">
        <li>Zombies banished: {zombiesBanished}</li>
        <li>Items found: {itemsFound}</li>
        <li>New recipe: {recipeUnlocked ?? 'none'}</li>
        <li>Journal page: {journalPageAvailable ? 'available' : 'none'}</li>
      </ul>
    </section>
  )
}
