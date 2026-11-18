// Every recorded sound the game can use, with the prompt that makes it. The generator
// (generate.mjs) reads this, and `node tools/audio/generate.mjs --sheet` turns it into
// docs/audio-prompts.md. Names match what the game asks for (src/audio/samples.ts):
// public/assets/audio/<folder>/<name>.ogg, and `variants: N` makes <name>-1 .. <name>-N.
//
// kind: 'sfx' (ElevenLabs Sound Effects), 'voice' (Text to Speech), 'music' (Eleven Music).
// wired: false marks files the game does not play yet; they are listed so the set is complete.
// Narration text must match the game's own text: src/audio/prompts.test.ts checks it.

/** House style added to every sound effect prompt, so the set sounds like one game. */
export const SFX_STYLE = 'Victorian gothic horror game, 1891, dry and close, no music'

export const VOICES = {
  narrator: {
    describe: 'Old English man, low, quiet and weary, unhurried, like reading a parish record by candlelight',
    env: 'ELEVENLABS_VOICE_NARRATOR',
    // ElevenLabs premade "George" (warm, British, older). Replace via the env variable.
    fallbackId: 'JBFqnCBsd6RMkjVDRZzb',
  },
  elias: {
    describe: 'Tired English man in his fifties, hoarse, frightened but careful, half whispering',
    env: 'ELEVENLABS_VOICE_ELIAS',
    // ElevenLabs premade "Daniel" (British, measured). Replace via the env variable.
    fallbackId: 'onwK4e9ZLuTAKqWW03F9',
  },
  dead: {
    describe: 'A dead man speaking from the dark, a dry rasping whisper, slow, breathy, barely voiced',
    env: 'ELEVENLABS_VOICE_DEAD',
    // ElevenLabs premade "Clyde" (gravelly, older). Replace via the env variable with a whisper voice.
    fallbackId: '2EiwWnXFnvU5JabPnv8n',
    // Low stability and high style push the read toward a ragged whisper.
    settings: { stability: 0.25, similarity_boost: 0.6, style: 0.7, speed: 0.75 },
  },
}

const sfx = (name, prompt, seconds, extra = {}) => ({ kind: 'sfx', folder: 'sfx', name, prompt, seconds, wired: true, ...extra })
const amb = (name, prompt, seconds, extra = {}) => ({ kind: 'sfx', folder: 'ambience', name, prompt, seconds, loop: true, ...extra })
const say = (name, voice, text, extra = {}) => ({ kind: 'voice', folder: 'voice', name, voice, text, ...extra })
const song = (name, prompt, seconds, extra = {}) => ({ kind: 'music', folder: 'music', name, prompt, seconds, loop: true, wired: false, ...extra })

export const AUDIO = [
  // ── First batch: the biggest jump in atmosphere ──────────────────────────────
  sfx('step-grass', 'single footstep on wet grass and soft mud, leather boot, close', 0.6, { variants: 4, batch: 'first' }),
  sfx('zombie-groan', 'rotting zombie groan, low wet throat rattle, slow, hungry, close', 3, { variants: 3, batch: 'first' }),
  sfx('melee-hit', 'heavy wooden shovel striking a rotting body, wet thud with bone crunch', 0.8, { batch: 'first' }),
  sfx('revolver-shot', 'single 1880s black powder revolver gunshot, sharp crack with short outdoor echo', 1.5, { batch: 'first' }),
  amb('rain', 'steady light rain on grass and gravestones, distant drips, seamless loop', 30, { wired: true, batch: 'first' }),
  say('intro-1', 'narrator', 'Hollowmere, October 1891.', { wired: true, batch: 'first' }),
  say('intro-2', 'narrator', 'The parish wrote: the keeper, Elias Thorne, has not been seen in three weeks.', { wired: true, batch: 'first' }),
  say('intro-3', 'narrator', 'They need someone to tend the dead.', { wired: true, batch: 'first' }),
  say('intro-4', 'narrator', 'The graves here are opening. From the inside.', { wired: true, batch: 'first' }),
  say('intro-5', 'narrator', 'Elias left a page on the table.', { wired: true, batch: 'first' }),

  // ── Footsteps ────────────────────────────────────────────────────────────────
  sfx('step-stone', 'single footstep on old flagstone floor in a stone chapel, leather boot, slight echo', 0.6, { variants: 4 }),
  sfx('step-wood', 'single footstep on creaky wooden floorboards in a small hut, leather boot', 0.6, { variants: 4 }),
  sfx('stair-footsteps', 'slow footsteps going down worn stone stairs into a crypt, echo', 2),

  // ── Weapons and combat ───────────────────────────────────────────────────────
  sfx('shotgun-blast', 'single 1890s double barrel shotgun blast, deep boom, outdoor echo', 1.8),
  sfx('dry-click', 'empty revolver hammer click, dry metallic click, close', 0.4),
  sfx('reload', 'loading brass cartridges into an old revolver cylinder, metallic clicks, cylinder snaps shut', 1.6),
  sfx('heavy-swing', 'heavy wooden tool swung hard through the air, whoosh', 0.6),
  sfx('kick', 'boot kicking a body hard, dull thud and grunt of air', 0.6),
  sfx('dodge', 'quick sidestep on grass, clothing rustle and scuff', 0.5),
  sfx('weapon-crack', 'wooden handle cracking under strain, sharp splintering crack', 0.7),
  sfx('weapon-break', 'wooden tool handle snapping in two, splinters falling', 1),
  sfx('throw', 'small glass bottle thrown, short whoosh', 0.5),
  sfx('flask-shatter', 'glass flask shattering on stone, liquid splash', 1),
  sfx('bomb-fuse', 'short black powder fuse hissing and sparking', 1.5),
  sfx('bomb-blast', 'small black powder bomb explosion, dirt and debris falling, outdoor', 2.5),
  sfx('trap-spring', 'iron bear trap snapping shut, heavy metal clang', 0.8),
  sfx('salt-place', 'handful of coarse salt poured onto stone in a circle, grainy hiss', 1.2),

  // ── Enemies ──────────────────────────────────────────────────────────────────
  sfx('bloater-gurgle', 'bloated corpse gurgling, wet bubbling stomach, disgusting, slow', 2.5, { batch: 'scares' }),
  sfx('bloater-hiss', 'swollen corpse hissing gas as it swells, wet hiss', 1.2),
  sfx('bloater-burst', 'bloated corpse bursting, wet splatter and gas pop', 1.2),
  sfx('brute-grunt', 'huge undead man grunting, deep angry growl, close', 1.2, { batch: 'scares' }),
  sfx('brute-step', 'very heavy undead footstep thudding on earth, low', 0.7, { batch: 'scares' }),
  sfx('lurker-breath', 'something crouched in the dark breathing slowly, wet rasping breath', 2.5, { batch: 'scares' }),
  sfx('wailer-wail', 'ghostly undead woman wailing, distant, long reverb, chilling', 3.5, { batch: 'scares' }),
  // Spec 11 creatures: named by their cue id, so the file plays in place of the synth tell.
  sfx('crawler-shiver', 'grave soil shivering and a wet clicking from just under the ground, something crawling up', 2, { batch: 'scares' }),
  sfx('bride-hum', 'a dead woman faintly humming a slow lullaby in the dark, cold breath, distant and close at once', 3, { batch: 'scares' }),
  sfx('hound-growl', 'low wet growl of a starved rotting dog in the dark, close, threatening', 2, { batch: 'scares' }),
  sfx('elite-arrival', 'horror sting, low brass swell and a deep hit, something powerful has arrived', 2.5),
  sfx('boss-rise', 'undead priest rising from a crypt, stone cracking, deep choir drone, rumble', 4),
  sfx('crane-censer', 'iron censer swinging on a chain, creak and clink, smoky', 1.5),
  sfx('censer-chain', 'heavy iron chain rattling and swinging', 1),
  sfx('boss-death', 'undead priest collapsing to dust, long fading moan and falling stone', 4),
  sfx('hand-grab', 'rotting hand bursting out of grave soil and grabbing, dirt crumbling, wet', 1.2, { batch: 'scares' }),

  // ── Scares ───────────────────────────────────────────────────────────────────
  sfx('grab-stinger', 'sudden horror jump scare sting, violin screech and low impact', 1.5, { batch: 'scares' }),
  sfx('grab-stinger-soft', 'soft horror sting, muted string swell, unsettling', 1.5, { batch: 'scares' }),
  sfx('screen-scare-sting', 'sudden horror jump scare, sharp noise burst, a low body thud and a falling human scream, very close', 1.5, { batch: 'scares' }),
  sfx('door-creak', 'old wooden door creaking open slowly, rusty hinges', 2.5, { batch: 'scares' }),
  sfx('door-slam', 'heavy wooden door slamming shut in a stone building, echo', 1.2, { batch: 'scares' }),
  sfx('stone-grind', 'heavy stone slab grinding and scraping open', 2.5, { batch: 'scares' }),
  sfx('soil-crumble', 'grave soil shifting and crumbling, dirt trickling', 1.5, { batch: 'scares' }),
  sfx('wind-gust', 'cold wind gust through dead trees, sudden, whistling', 3, { batch: 'scares' }),
  sfx('breath-behind', 'slow raspy breath right behind the listener, very close, intimate', 2, { batch: 'scares' }),
  // The whisper-name scare: a dead voice saying the word, matching its subtitle '"...keeper..."'.
  say('whisper-keeper', 'dead', '...keeeper...', { wired: true, batch: 'scares' }),
  sfx('heartbeat', 'single heavy heartbeat thump, low, muffled', 0.8, { batch: 'scares' }),
  sfx('thunder-close', 'close thunder crack and long rumble', 4),
  sfx('thunder-far', 'distant rolling thunder', 4),
  sfx('toll', 'single deep church bell toll, long ring', 5),
  sfx('congregation', 'murmuring congregation of ghostly voices in a chapel, indistinct, eerie', 4),

  // ── World and interface ──────────────────────────────────────────────────────
  sfx('dig', 'shovel digging into wet grave soil, scrape and dirt thrown', 1.5, { wired: false }),
  sfx('board-nail', 'hammering a nail into a wooden board, three strikes', 1.2),
  sfx('board-break', 'wooden plank torn off a door and splintering', 1),
  sfx('crafting-tick', 'small tool tapping wood at a workbench, single tap', 0.4),
  sfx('crafting-complete', 'wooden knock then a soft small bell chime, success', 1),
  sfx('crafting-cancel', 'tools dropped onto a wooden bench, clatter', 0.8),
  sfx('satchel-open', 'old leather satchel opened, buckle and leather creak', 0.8),
  sfx('satchel-close', 'leather satchel flap closed, short creak and soft thump', 0.5),
  sfx('page-turn', 'old parchment page picked up and turned, dry paper rustle', 0.8),
  sfx('pin-reached', 'soft small chime, gentle, single note', 0.8),
  sfx('effect-apply', 'drinking from a glass tonic bottle, gulp and a soft breath', 1.2),
  sfx('vending-coin', 'single old coin dropped into a metal slot, clink', 0.6),
  sfx('vending-handle', 'heavy brass lever pulled on an old machine, clunk and spring', 0.8),
  sfx('vending-tray', 'small glass bottle dropping into a metal tray', 0.8),
  sfx('vending-refuse', 'old machine refusing, coin rattling back out, dull buzz', 0.8),
  sfx('altar-solved', 'soft holy chime and a warm low choir note, relief', 2.5),
  sfx('altar-wrong', 'low dissonant organ note and a stone knock, wrong', 1.5),
  sfx('altar-locked', 'dull stone thud, heavy and final', 0.8),
  sfx('relic-placed', 'small metal object set on a stone altar, resonant clink', 1),
  sfx('merchant-arrive', 'horse drawn cart creaking to a stop, harness jingle', 3),
  sfx('merchant-leave', 'horse drawn cart rolling away on gravel, fading', 3),

  // ── All Hallows' Eve (design bible §15) ──────────────────────────────────────
  sfx('crow-caw', 'single crow cawing from a bare tree, harsh and hoarse, outdoors at a distance, autumn', 1.5, { variants: 3, batch: 'halloween' }),
  sfx('bell-all-souls', 'single toll of a small village church bell far away across fields at night, muffled by distance and mist, long fading ring', 5, { batch: 'halloween' }),

  // ── Strange distant noises (src/data/strangeNoises.ts): atmosphere only ──────
  sfx('strange-train', 'a steam train passing far away across open fields at night, rails clattering, one long mournful whistle, slowly fading out', 9, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-music-box', 'a small old music box playing a few slow notes of a lullaby, slightly out of tune, winding down and stopping', 6, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-child-laugh', 'a single small child giggling far away in the dark, echoing faintly', 2.5, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-organ', 'one low church organ chord played inside an empty stone chapel, long echo dying away', 6, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-knocks', 'three slow knocks on a heavy wooden door, distant, then silence', 3, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-dog-howl', 'a lone farm dog howling far away across the moor at night, long and mournful', 4, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-hand-bell', 'a small hand bell rung slowly three times far away, like a funeral procession', 4, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-chains', 'heavy iron chains dragged slowly across stone somewhere distant', 4, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-piano', 'one out of tune piano key struck in an empty house far away, long decay', 4, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-whistling', 'a man whistling a slow old folk tune far away in the dark, then stopping suddenly mid-note', 5, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-pocket-watch', 'an old pocket watch ticking loudly very close to the ear, then stopping', 4, { folder: 'ambience', batch: 'strange' }),
  sfx('strange-owl', 'a barn owl screeching once in dark trees, harsh and close', 2, { folder: 'ambience', batch: 'strange' }),

  // ── Ambience loops ───────────────────────────────────────────────────────────
  amb('wind-night', 'cold autumn wind through bare branches over an open graveyard, low and steady, dry leaves stirring, seamless loop', 30, { wired: true, batch: 'halloween' }),
  amb('day-birds-crows', 'grey morning in a country graveyard, distant crows, faint wind, seamless loop', 30, { wired: false }),
  amb('hut-interior', 'inside a small wooden hut, iron stove crackling, roof creaks, rain outside, seamless loop', 30, { wired: false }),
  amb('catacombs-drip', 'stone catacombs, slow water drips, low room tone, distant settling stone, seamless loop', 30, { wired: false }),

  // ── Music (all in D minor at 60 bpm so the four layers blend) ────────────────
  song('stem-drone', 'dark ambient drone for a horror game, low cello and organ pedal, D minor, 60 bpm, no drums, calm, seamless loop', 60),
  song('stem-unease', 'unsettling horror layer, sparse detuned violin harmonics and soft piano notes, D minor, 60 bpm, seamless loop', 60),
  song('stem-tension', 'tense horror layer, pulsing low strings and ticking percussion, D minor, 60 bpm, seamless loop', 60),
  song('stem-danger', 'urgent horror layer, frantic tremolo strings and heavy timpani hits, D minor, 60 bpm, seamless loop', 60),
  song('title-theme', 'slow mournful Victorian gothic theme, solo cello and music box over organ, D minor, sparse', 90),
  song('ending-rest', 'gentle hopeful dawn theme, warm strings and soft choir, D major, peaceful, release', 60, { loop: false }),
  song('ending-taken', 'bleak funeral dirge, low organ and a single tolling bell, D minor, hopeless', 60, { loop: false }),

  // ── Elias's journal pages (not played by the game yet) ───────────────────────
  say('page-1', 'elias', "Third night at Hollowmere and I have stopped pretending it is the foxes. The graves along the north row were not dug from above. The soil is pushed up and outward, as though something had been trying to leave. I checked the dates against the parish ledger and they do not agree. Someone has been tidying the truth. I will keep the lantern lit.", { wired: false, source: 'page:1' }),
  say('page-2', 'elias', 'Found this beneath the Marsh family stone, wrapped in oilcloth. The ledger records thirty-one burials in a single week of 1849, and not one death certificate among them. Thirty-one graves, and I have dug beside half of them. They are empty. Whoever was laid here did not stay, or was never laid here at all.', { wired: false, source: 'page:2' }),
  say('page-3', 'elias', 'The Crane crypt gave up a fragment in the priest’s own hand. "They were not dead. God forgive me, they were not yet dead, and I could not bear the fever to spread." He sealed them below the chapel and wrote them into the ledger as buried. At the foot of the page is a ring of salt and a note: grave salt and holy water, drawn as a circle, and nothing foul will cross it. I have copied it out. Further down, smudged: "What I hid, I hid beneath the Word." He prayed first, then rang the bell, then named the smallest of them, then covered the rest, and last he sealed the heart away.', { wired: false, source: 'page:3' }),
  say('page-4', 'elias', 'Scratches on every stone, low down, where a seated man could reach. Names, hundreds of small marks, and the same names again and again. Beside the sealed door, five relics are listed for the Rite of Rest, in the order Crane confessed it: the rosary, the clapper, the locket, the shroud, the heart. Crane meant to lay them on the altar in that order and finish what guilt began. He died with the words half said. I mean to say the rest.', { wired: false, source: 'page:4' }),
  say('page-5', 'elias', 'The rite did not take. I did not have all five, and I did not hold the words long enough. I can hear them in the chapel walls now, and I can hear myself among them. Finish it, whoever you are. Do not let me out.', { wired: false, source: 'page:5' }),

  // ── Endings and walk-out (not played by the game yet) ────────────────────────
  say('ending-rest-1', 'narrator', 'The last name is spoken. The altar candle does not gutter.', { wired: false, source: 'ending:rest:0' }),
  say('ending-rest-2', 'narrator', 'Under the grass, thirty-one breaths let go at once.', { wired: false, source: 'ending:rest:1' }),
  say('ending-rest-3', 'elias', '"Thank you, keeper," says a voice with Elias in it.', { wired: false, source: 'ending:rest:2', note: 'Elias voice; you may want only the quoted words spoken' }),
  say('ending-rest-4', 'narrator', 'Dawn comes over Hollowmere, and the dead lie down.', { wired: false, source: 'ending:rest:3' }),
  say('ending-taken-1', 'narrator', 'Dawn finds the cemetery quiet and the rite undone.', { wired: false, source: 'ending:taken:0' }),
  say('ending-taken-2', 'narrator', 'The ledger has a new line, in a hand you almost know.', { wired: false, source: 'ending:taken:1' }),
  say('ending-taken-3', 'narrator', 'Your name. Today\'s date. "Buried."', { wired: false, source: 'ending:taken:2' }),
  say('ending-taken-4', 'narrator', 'Somewhere above, the bell begins to ring for someone else.', { wired: false, source: 'ending:taken:3' }),
  say('walkout-1', 'narrator', 'The fog thins as the sun climbs over Hollowmere.', { wired: false, source: 'walkout:0' }),
  say('walkout-2', 'narrator', 'Behind you, the graves are only graves again.', { wired: false, source: 'walkout:1' }),
  say('walkout-3', 'narrator', 'The lane is empty. You do not look back.', { wired: false, source: 'walkout:2' }),
]

/** Batches the generator understands: --batch first, halloween, sfx, voice, ambience, music, all. */
export function inBatch(entry, batch) {
  if (batch === 'all') return true
  if (batch === 'first') return entry.batch === 'first'
  if (batch === 'halloween') return entry.batch === 'halloween'
  if (batch === 'scares') return entry.batch === 'scares'
  if (batch === 'played') return entry.wired === true
  if (batch === 'strange') return entry.batch === 'strange'
  if (batch === 'voice') return entry.kind === 'voice'
  if (batch === 'music') return entry.kind === 'music'
  if (batch === 'ambience') return entry.folder === 'ambience'
  if (batch === 'sfx') return entry.folder === 'sfx'
  return false
}

/** The file names an entry produces (without folder or extension). */
export function fileNames(entry) {
  if (!entry.variants) return [entry.name]
  return Array.from({ length: entry.variants }, (_, i) => `${entry.name}-${i + 1}`)
}
