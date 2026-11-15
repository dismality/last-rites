# Kiro prompt: clue models, clue reveal text and journal entries (11q)

Paste everything below the line into Kiro.

---

A follow-up from the user's playtest. Add it to `.kiro/specs/09-playtest-fixes/tasks.md` as **11q**. Finish the step you're on and commit it first, then do 11q, then carry on where you were. Same rules: design bible first (§11 for the HUD, the journal section for the Clues tab), a kiro-log entry, lint, build and unit tests pass, commit locally, never push.

The user's words: when a clue is found, the clue should have a design of its own (today it's a blank object), its text should appear a bit below the middle of the screen as fading text, and it should be logged in the journal.

## 1. Each clue spot shows its own model

`ClueSpots.tsx` still draws three plain boxes (`parchment`, `coat`, `marks`). Claude built one model per clue in Blender, so swap them in now. This is the clue row of 11n-d, done early; skip it there if it's already done.

- Load `public/assets/models/props/<clueId>.glb` for each spot in `CLUE_SPOTS` (all 9 exist: `clue-hut-boots`, `clue-empty-graves`, `clue-west-hill-glint`, `clue-ledger-week`, `clue-row-statues`, `clue-elias-body`, `clue-cat-scratches`, `clue-cat-names`, `clue-cat-ledger-seal`). Use `useGLTF(url, DRACO_PATH)` with `<Clone>`, and add them to `preloadModels`.
- **Facing:** models face +Z unless noted.
  - `clue-cat-scratches` faces +X: it sits against the catacombs' west wall.
  - `clue-cat-names` faces −X: it sits against the east bone wall.
  - Rotate each one so its front faces the path the player arrives from, and check every spot in the browser. Where a model would clip into the new scenery (the hut cot, catacomb ledges, the bier), move the spot a little and log the change.
- **Colliders:** where a clue has a `.json` next to it (the notice post, the sealed-entry stone, the statue plinth, the bench), add its boxes.
- **Highlight:** keep the `Interactable`, the rune and the hug-the-model outline from 11o, now fitted to the real model.
- Delete the old `Prop` boxes, and the `prop` field if nothing else uses it.

## 2. The clue text fades in below the centre of the screen

Today a found clue only gives the toast "Added to your journal (J)". Replace that, for clues only, with a **clue reveal**:

- **Where:** centred horizontally, with its top edge at about 58% of the screen height. That's a little below the crosshair, and clear of the crosshair, the interaction prompt, the captions, the toasts, the hotbar and the health bar at 1920x1080, 1280x720 and 800x600. At most 640 px wide (90% of the width on small screens).
- **What it shows, top to bottom:**
  1. **Picture:** the clue's picture, `public/assets/icons/clues/<clueId>.png` (Claude rendered all 9 from the models), about 96 px, with a soft dark vignette behind it. Clues with no picture (headstone and plaque clues such as `clue-marsh-stone`, the wrong-grave clues and `clue-crane-plaque`) show no image; don't draw a placeholder.
  2. **Title:** the spot's `label` (e.g. "Elias's boots"), or a short title from `clues.ts` for clues without a spot. Small caps, IM Fell English SC.
  3. **Text:** the clue's `text` from `clues.ts`, in the HUD's ink-on-dark style, 18 px or more, with a dark text shadow so it reads on fog and on lantern-lit walls.
  4. **Journal line:** one small line, "Noted in your journal (J)", with the key read from the player's binding (reuse `journalAddedText`'s key logic).
- **How it moves:**
  - **In:** fades in over 0.5 s with a 6 px rise, with ink spreading: the letters start slightly blurred and sharpen.
  - **Hold:** 3.5 s plus 45 ms per character, capped at 10 s.
  - **Out:** fades out over 1.2 s.
  - With reduced motion: a plain fade, no rise and no blur.
  - The player can keep moving the whole time; it never takes focus or blocks input.
- **Queue:** if two clues are found close together, show them one after another, never stacked. A clue found while a menu, the journal, the workbench, the big map, examine or a cutscene is open waits until it closes. One that has waited over 30 s is dropped, since it's already in the journal.
- **Sound:** a quiet page-turn and quill-scratch, on the SFX bus, with a caption "[quill scratches]".
- **Trigger it for every clue discovery:** examined spots, headstones read with the ledger, the Crane plaque, and the stage clues from spec 10. One place, listening to the mystery store's discovery (or its event), not each caller. Don't fire on Continue or a Retry restore.
- **Ledger refusal:** "The entries mean nothing without the parish ledger to compare." should use the same position and fade, but with no picture, no title and no journal line, so it isn't mistaken for a found clue.
- **Code:** the timing and queue logic is pure, in `src/game/systems/clueReveal.ts`, unit-tested. The component goes in `src/ui/hud/ClueReveal.tsx`, and titles in data.

## 3. Logged in the journal

The Clues tab already lists found clue text. Make each entry match the reveal:
- **Entries:** the picture (48 px, or nothing if the clue has none), the title, then the text. Show entries in the order found, oldest at the top, with the newest marked by a small red ink dot until the journal has been opened once.
- **Tab badge:** the Clues tab label shows a count of unread clues, e.g. "Clues ·2".
- **Saving:** found order and read state are saved, and restored on Continue and both Retries. Old saves with no order use the `CLUES` order.
- **Case board:** clues still pin to the case board as today; check that the reveal doesn't double up with the case board's own message.

## Tests

**Unit:**
- the queue (two clues in a row, waiting through a menu, dropping after 30 s);
- the hold time from the text length, with its cap;
- every `CLUE_SPOTS` id has a model and a picture;
- clues with no picture render without an image;
- unread count and order saved and restored.

**Browser** (screenshots at 1280x720 and 800x600):
1. walk up to the hut boots and examine them: the model is visible, the reveal fades in below the crosshair, holds and fades out;
2. find two clues quickly and see them play one after another;
3. try a ledger clue without the ledger and see the plain refusal line;
4. open the journal and see the entries with pictures, the red dot and the badge clear;
5. check every clue spot's model in place, with no clipping into walls, the cot or the ledges;
6. check reduced motion.
