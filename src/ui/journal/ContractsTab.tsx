// Journal "Contracts" tab: today's side contracts, as notes in the keeper's ledger.
import { useMemo } from 'react'
import { useProgressionStore } from '../../game/state/progressionStore'
import { contractEntries } from './contractsView'

export function ContractsTab() {
  const contracts = useProgressionStore((s) => s.contracts)
  const entries = useMemo(() => contractEntries(contracts), [contracts])
  return (
    <div className="journal-contracts">
      {entries.length === 0 ? (
        <p className="journal__empty">No contracts today. Silas will have more at dawn.</p>
      ) : (
        <ul className="journal-contracts__list" aria-label="Side contracts">
          {entries.map((c) => (
            <li
              key={c.id}
              className={`journal-contract ${c.done ? 'journal-contract--done' : ''}`}
            >
              <span className="journal-contract__text">{c.text}</span>
              <span className="journal-contract__progress">{c.progressLabel}</span>
              <span className="journal-contract__reward" aria-label={`Reward ${c.rewardLabel.slice(2)} Grave Coins`}>
                {c.rewardLabel}
              </span>
              {c.doneTag && <span className="journal-contract__done">{c.doneTag}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
