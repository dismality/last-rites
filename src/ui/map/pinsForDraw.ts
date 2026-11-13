import { MAP_CELL_SIZE } from '../../data/mapLandmarks'
import type { Pin, PinSlot } from '../../game/systems/mapPins'
import { isExplored, type MapState } from '../../game/systems/mapReveal'

/** Pins plus whether each sits on ground the player has not explored (drawn with a "?"). */
export function pinsForDraw(
  pins: readonly Pin[],
  map: MapState,
  selected?: PinSlot | null,
): Array<{ pin: Pin; unexplored: boolean; selected: boolean }> {
  return pins.map((pin) => ({
    pin,
    unexplored: !isExplored(map, Math.floor(pin.x / MAP_CELL_SIZE), Math.floor(pin.z / MAP_CELL_SIZE)),
    selected: pin.slot === selected,
  }))
}
