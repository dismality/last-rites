// Mounts the three new creatures and listens for gunshots (they scatter hound packs).
// Mount inside <GameLoop>, next to EnemyDirector.
import { useEffect } from 'react'
import { installCreatureShotListener } from '../../game/state/creatureStep'
import { Bride } from './Bride'
import { Crawlers } from './Crawler'
import { Hounds } from './Hound'

export function Creatures() {
  useEffect(() => installCreatureShotListener(), [])
  return (
    <>
      <Crawlers />
      <Bride />
      <Hounds />
    </>
  )
}
