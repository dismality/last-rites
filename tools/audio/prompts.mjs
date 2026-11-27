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
  keeper: {
    describe: 'The new keeper thinking aloud as he works it out, a plain English man, clear and steady, quietly uneasy',
    env: 'ELEVENLABS_VOICE_KEEPER',
    // The voice chosen for the keeper (2026-11-23). Replace via the env variable.
    fallbackId: 'pn8ABB5WQQBNyhFA5uEG',
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
  say('intro-2', 'narrator', 'Three weeks ago, the keeper Elias Thorne walked out into these graves.', { wired: true, batch: 'first' }),
  say('intro-3', 'narrator', 'He never came back. Now the keeping falls to you.', { wired: true, batch: 'first' }),
  say('intro-4', 'narrator', 'Find what happened to him. And when night falls, keep the dead in the ground.', { wired: true, batch: 'first' }),
  say('intro-5', 'narrator', 'Whatever he knew, he wrote it down.', { wired: true, batch: 'first' }),

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
  say('page-1', 'elias', "Whoever finds this: you should know how the dead are kept here. Doctors cannot always tell a deep sleep from death, and people have been buried alive. So every grave at Hollowmere has a safety bell. A cord runs from the dead man’s hand, up a pipe through the soil, to a little bell on a post above him. If he wakes below, he pulls the cord, the bell rings, and the watchman digs him out. Now listen. One of three graves here is wrong, and someone has changed the parish ledger on the hut shelf to hide it. Read the stones of John Pell, Esther Ames and Tobias Hale, and check each one against its entry. If I am not back, do not trust the ink. Trust the stones.", { wired: false, source: 'page:1' }),
  say('page-2', 'elias', 'Vane’s men are taking the dead too. Watch the fresh graves. They are being emptied, and the lodge keeper sees everything and says nothing.', { wired: false, source: 'page:2' }),
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
  // ── The keeper thinking aloud, Cases 1 and 2 (src/data/case1Narration.ts, case2Narration.ts, word for word) ──
  say("keeper-page-1", 'keeper', "Elias says one of three graves is wrong, and that someone changed the parish ledger to hide it.", { wired: true, batch: 'keeper' }),
  say("keeper-page-2", 'keeper', "I’ll read the stones of John Pell, Esther Ames and Tobias Hale, then check each one against the ledger in the hut.", { wired: true, batch: 'keeper' }),
  say("keeper-stone-pell", 'keeper', "John Pell’s stone: died the 12th of March 1862, north row, plot 3, struck down by apoplexy. I’ll check that against his entry in the ledger.", { wired: true, batch: 'keeper' }),
  say("keeper-stone-ames", 'keeper', "Esther Ames: died the 7th of November 1849, east row, plot 1, taken by fever. Now to see what the ledger says about her.", { wired: true, batch: 'keeper' }),
  say("keeper-stone-hale", 'keeper', "Tobias Hale: died the 5th of November 1849, west row, plot 1, taken by cholera. I’ll compare it with his ledger entry.", { wired: true, batch: 'keeper' }),
  say("keeper-stones-done", 'keeper', "That’s all three stones. Now the ledger on the hut shelf.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-open-1", 'keeper', "Three names marked here: John Pell, Esther Ames and Tobias Hale.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-open-2", 'keeper', "For each one I’ll check the stone, then mark whether the ledger agrees with it.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-right-pell-1", 'keeper', "John Pell’s stone says he died on the 12th of March. The ledger says the 11th.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-right-pell-2", 'keeper', "The ledger has him dead a day before his own gravestone does.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-right-ames-1", 'keeper', "Esther Ames. Her stone says fever took her. The ledger says a fall.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-right-ames-2", 'keeper', "Someone wrote over the cause of death.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-right-hale-1", 'keeper', "Tobias Hale. His stone stands in the west row, plot 1. The ledger puts him in the east row, plot 4.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-right-hale-2", 'keeper', "Someone moved him, on paper.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-not-agree", 'keeper', "Look again. Something on this line doesn’t match the stone.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-wrong-kind-date", 'keeper', "No, the dates agree. Something else is wrong.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-wrong-kind-plot", 'keeper', "No, the plot agrees. Something else is wrong.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-wrong-kind-cause", 'keeper', "No, the cause of death agrees. Something else is wrong.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-solved-1", 'keeper', "So that’s three entries changed: John Pell, Esther Ames and Tobias Hale.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-solved-2", 'keeper', "The same fresh ink on each, and each one initialled J.V. in the margin. Someone rewrote these after the burials.", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-solved-3", 'keeper', "Pell’s is the strangest. If the ledger has him dead a day early, was he buried before he was dead?", { wired: true, batch: 'keeper' }),
  say("keeper-ledger-solved-4", 'keeper', "This is strange. Every grave here has a safety bell. Let me check the bells on these three graves and see if anything’s wrong.", { wired: true, batch: 'keeper' }),
  say("keeper-bell-ames", 'keeper', "I pull Esther Ames’s cord. The bell rings clear. If she had woken, the watchman would have heard.", { wired: true, batch: 'keeper' }),
  say("keeper-bell-hale", 'keeper', "Tobias Hale’s bell rings too. Nothing wrong with this one.", { wired: true, batch: 'keeper' }),
  say("keeper-bell-pell-1", 'keeper', "Nothing. John Pell’s cord hangs loose. It’s been cut clean, with a knife, not rotted through.", { wired: true, batch: 'keeper' }),
  say("keeper-bell-pell-2", 'keeper', "His is the only bell here that could never ring.", { wired: true, batch: 'keeper' }),
  say("keeper-bell-again-ames", 'keeper', "Esther Ames’s bell still rings.", { wired: true, batch: 'keeper' }),
  say("keeper-bell-again-hale", 'keeper', "Tobias Hale’s bell still rings.", { wired: true, batch: 'keeper' }),
  say("keeper-bell-again-pell", 'keeper', "John Pell’s cord is still cut. Nothing rings.", { wired: true, batch: 'keeper' }),
  say("keeper-bells-done", 'keeper', "Two bells ring and one doesn’t. I’ll write it down in my journal: which bell was cut?", { wired: true, batch: 'keeper' }),
  say("keeper-cut-wrong-ames", 'keeper', "No. Esther Ames’s bell rang when I pulled it.", { wired: true, batch: 'keeper' }),
  say("keeper-cut-wrong-hale", 'keeper', "No. Tobias Hale’s bell rang when I pulled it.", { wired: true, batch: 'keeper' }),
  say("keeper-cut-right-1", 'keeper', "John Pell’s. Someone cut his cord, so no one would ever hear him ring.", { wired: true, batch: 'keeper' }),
  say("keeper-cut-right-2", 'keeper', "There’s a tag tied to the cut end: his death certificate, signed on the 11th of March by J. Vane, Undertaker.", { wired: true, batch: 'keeper' }),
  say("keeper-cut-right-3", 'keeper', "The 11th. The same false date as the ledger. He was signed dead a day before his stone says he died.", { wired: true, batch: 'keeper' }),
  say("keeper-cut-right-4", 'keeper', "J.V. The same initials as in the ledger margin. J. Vane, the undertaker: Josiah Vane.", { wired: true, batch: 'keeper' }),
  say("keeper-cut-right-5", 'keeper', "Someone must have wanted him buried. When night falls, I’ll name him at the chapel altar.", { wired: true, batch: 'keeper' }),
  say("keeper-seal", 'keeper', "Pressed into the tag is a red wax seal: a raven standing on a coffin, inside a shield. The Vane family crest. I’ll remember that.", { wired: true, batch: 'keeper' }),
  say("keeper-solved-1", 'keeper', "Josiah Vane. He signed John Pell dead a day early, changed the ledger to cover it, and cut his bell cord so no one would hear him.", { wired: true, batch: 'keeper' }),
  say("keeper-solved-2", 'keeper', "Elias worked this out before me. That must be why he went missing.", { wired: true, batch: 'keeper' }),
  say("keeper2-page-1", 'keeper', "Elias’s next note: “Vane’s men are taking the dead too. Watch the fresh graves.”", { wired: true, batch: 'keeper' }),
  say("keeper2-page-2", 'keeper', "He thought bodies were being stolen from new graves. Surgeons pay for bodies to cut up and study, and the men who dig them up are called resurrection men.", { wired: true, batch: 'keeper' }),
  say("keeper2-page-3", 'keeper', "There are three fresh graves by the lodge. I’ll look at each one, then check them against the burial register on the lodge table.", { wired: true, batch: 'keeper' }),
  say("keeper2-grave-cobb", 'keeper', "Ellen Cobb, buried the 9th of October. The soil’s settled and the grass is coming through. Nobody’s touched it.", { wired: true, batch: 'keeper' }),
  say("keeper2-grave-reade", 'keeper', "Thomas Reade, buried the 11th. Settled and firm. Nobody’s touched this one either.", { wired: true, batch: 'keeper' }),
  say("keeper2-grave-finch", 'keeper', "Arthur Finch, buried the 14th. The soil’s loose, there’s yellow clay all over the grass, and I can see the coffin lid.", { wired: true, batch: 'keeper' }),
  say("keeper2-graves-done", 'keeper', "That’s all three fresh graves. Now the burial register on the lodge table.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-open-1", 'keeper', "The burial register: Ellen Cobb, Thomas Reade and Arthur Finch.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-open-2", 'keeper', "For each one I’ll mark whether the grave agrees with what’s written here.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-right-cobb", 'keeper', "Ellen Cobb’s grave matches the register. Buried the 9th, and nobody’s touched it.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-right-reade", 'keeper', "Thomas Reade’s grave matches too.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-right-finch-1", 'keeper', "This doesn’t match. The register says Arthur Finch was buried on the 14th, filled and settled.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-right-finch-2", 'keeper', "But the soil’s loose and there’s yellow clay all over the grass. Someone dug it up and filled it back in. The coffin’s empty. The body’s gone.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-not-agree", 'keeper', "Look again. The register says settled, but that grave isn’t.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-not-disturbed", 'keeper', "No. That grave’s settled. Nobody’s touched it.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-solved-1", 'keeper', "So Arthur Finch’s grave was robbed on the night of the 14th, or after.", { wired: true, batch: 'keeper' }),
  say("keeper2-register-solved-2", 'keeper', "The lodge keeper, Kerr, writes down every night’s rounds. I’ll read his watch log for the 14th.", { wired: true, batch: 'keeper' }),
  say("keeper2-watch-open", 'keeper', "The watch log for the night of the 14th. Kerr walks the rounds, and Dale, the night porter, countersigns each one.", { wired: true, batch: 'keeper' }),
  say("keeper2-watch-signed", 'keeper', "Dale signed that one. He was with Kerr at that hour.", { wired: true, batch: 'keeper' }),
  say("keeper2-watch-solved-1", 'keeper', "Midnight and two o’clock: Kerr says “all quiet”, but nobody countersigned. Dale wasn’t with him.", { wired: true, batch: 'keeper' }),
  say("keeper2-watch-solved-2", 'keeper', "Kerr was out alone for those rounds, on the night Arthur Finch’s grave was emptied. And Kerr is the lodge keeper.", { wired: true, batch: 'keeper' }),
  say("keeper2-watch-solved-3", 'keeper', "There was a boot print at the robbed grave. I’ll take it, then compare it with the boots by the lodge table.", { wired: true, batch: 'keeper' }),
  say("keeper2-print-1", 'keeper', "A boot print in the mud at the foot of Arthur Finch’s grave: hobnails, a square heel, and a crack straight across the sole.", { wired: true, batch: 'keeper' }),
  say("keeper2-print-2", 'keeper', "I’ve sketched it in my journal. Now the boots by the lodge table.", { wired: true, batch: 'keeper' }),
  say("keeper2-boots-no-print", 'keeper', "I need the print from the robbed grave to hold these against.", { wired: true, batch: 'keeper' }),
  say("keeper2-boot-right-1", 'keeper', "Kerr’s boots. Same hobnails, same crack across the sole, and the same yellow clay from the grave. Kerr dug it up himself.", { wired: true, batch: 'keeper' }),
  say("keeper2-boot-right-2", 'keeper', "There’s a key in his boot. It’s for a locker, but the lock on it isn’t an ordinary one.", { wired: true, batch: 'keeper' }),
  say("keeper2-boot-wrong-visitor", 'keeper', "No. That’s a narrow heel and no nails. Not these.", { wired: true, batch: 'keeper' }),
  say("keeper2-boot-wrong-dale", 'keeper', "No. A broad, low heel, hardly any nails, and no crack. Not Dale’s.", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-no-key", 'keeper', "Kerr’s locker, from Vane & Sons. It’s locked, and I don’t have the key.", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-first-1", 'keeper', "A crest lock. Vane & Sons lockers have them: the key turns only once the dial is set to the right family crest.", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-first-2", 'keeper', "I’ve seen one of these crests before: the wax seal on John Pell’s tag, the raven on the coffin. That was the Vane crest.", { wired: true, batch: 'keeper' }),
  say("keeper2-crest-wrong", 'keeper', "Won’t turn. It wants a particular crest.", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-open-1", 'keeper', "It opens. There’s a bone whistle in here, and a receipt.", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-open-2", 'keeper', "“Received of Vane & Sons, for three subjects delivered to Dr. Hollis, surgeon: twelve pounds. Paid to Kerr.”", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-open-3", 'keeper', "Subjects means bodies. Vane & Sons paid Kerr to dig up the dead and sell them to a surgeon.", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-open-4", 'keeper', "And this neat, sloping hand is the same as the changed entries in the parish ledger.", { wired: true, batch: 'keeper' }),
  say("keeper2-locker-open-5", 'keeper', "When night falls, I’ll name who paid at the chapel altar.", { wired: true, batch: 'keeper' }),
  say("keeper2-solved-1", 'keeper', "Vane & Sons. Kerr digs, and the Vanes pay.", { wired: true, batch: 'keeper' }),
  say("keeper2-solved-2", 'keeper', "First John Pell, now this. Elias was getting too close to them.", { wired: true, batch: 'keeper' }),
  say("keeper3-page-1", 'keeper', "Elias’s last page: “I’m going below the chapel tonight. If I don’t come back, look for the Crane crypt.”", { wired: true, batch: 'keeper' }),
  say("keeper3-page-2", 'keeper', "There must be a way down below the chapel. The hymn board in the chapel has been changed. I’ll start there.", { wired: true, batch: 'keeper' }),
  say("keeper3-hymn-solved-1", 'keeper', "These hymn numbers make no sense for a service. Take the first letter of each hymn: B, E, L, O, W. Below. Elias set this. The catacombs are under the chapel.", { wired: true, batch: 'keeper' }),
  say("keeper3-hymn-solved-2", 'keeper', "There it is. The stair behind the altar.", { wired: true, batch: 'keeper' }),
  say("keeper3-hymn-solved-3", 'keeper', "But his page named the Crane crypt, at the far end of the Row. There are cart ruts at the Row gate. I’ll follow them first.", { wired: true, batch: 'keeper' }),
  say("keeper3-ruts", 'keeper', "Wheel ruts, deep ones. A heavy cart came down the Row and went back out. A hearse cart. I’ll follow them.", { wired: true, batch: 'keeper' }),
  say("keeper3-oil", 'keeper', "Spilled lantern oil at the Lowe crypt, still wet. Someone was here, but there are no cart ruts. Nobody brought a cart to this door. It’s not this one. I’ll keep following the ruts.", { wired: true, batch: 'keeper' }),
  say("keeper3-door-1", 'keeper', "The ruts stop at the Crane crypt. This is the door Elias wrote about.", { wired: true, batch: 'keeper' }),
  say("keeper3-door-2", 'keeper', "The door’s pinned shut from the outside. You can’t open that from inside. Someone shut this on purpose.", { wired: true, batch: 'keeper' }),
  say("keeper3-door-3", 'keeper', "This pin’s off a hearse cart, and it has the Vane raven on it. The ruts outside were a hearse cart. The Vanes’ cart.", { wired: true, batch: 'keeper' }),
  say("keeper3-door-4", 'keeper', "Elias. He’s here. There are fingernail marks all over the inside of the door. He was alive when they shut him in, and he tried to claw his way out.", { wired: true, batch: 'keeper' }),
  say("keeper3-elias-shut", 'keeper', "The door’s pinned shut. I have to pull the pin first.", { wired: true, batch: 'keeper' }),
  say("keeper3-elias-1", 'keeper', "There’s a letter in his coat that he never sent, and a note. He came here to meet someone: the man who wrote asking to meet him at the Crane crypt.", { wired: true, batch: 'keeper' }),
  say("keeper3-elias-2", 'keeper', "I’ll lay the note beside the other papers in my journal and compare the hands.", { wired: true, batch: 'keeper' }),
  say("keeper3-hand-open", 'keeper', "Four hands side by side: the changed ledger entry, the receipt from Kerr’s locker, the note that called Elias here, and Josiah Vane’s signature on John Pell’s tag.", { wired: true, batch: 'keeper' }),
  say("keeper3-hand-solved-1", 'keeper', "The ledger, the receipt, and the note that brought Elias here: all the same hand, with the looped V and the long s.", { wired: true, batch: 'keeper' }),
  say("keeper3-hand-solved-2", 'keeper', "But Josiah’s signature on Pell’s tag is plain and shaky. This isn’t the father’s writing. It’s the son’s.", { wired: true, batch: 'keeper' }),
  say("keeper3-hand-solved-3", 'keeper', "Silas Vane keeps the books for Vane & Sons. He changed the ledger for his father, he paid Kerr for the bodies, and he wrote the note that lured Elias to the crypt.", { wired: true, batch: 'keeper' }),
  say("keeper3-hand-solved-4", 'keeper', "Silas Vane sealed Elias in this crypt. Tonight I’ll name him at the altar, then lay the relics for the rite.", { wired: true, batch: 'keeper' }),
  say("keeper3-named", 'keeper', "Silas Vane. Elias, I found you. You can rest now.", { wired: true, batch: 'keeper' }),
]

/** Batches the generator understands: --batch first, halloween, scares, strange, keeper, played, sfx, voice, ambience, music, all. */
export function inBatch(entry, batch) {
  if (batch === 'all') return true
  if (batch === 'first') return entry.batch === 'first'
  if (batch === 'halloween') return entry.batch === 'halloween'
  if (batch === 'scares') return entry.batch === 'scares'
  if (batch === 'played') return entry.wired === true
  if (batch === 'strange') return entry.batch === 'strange'
  if (batch === 'keeper') return entry.batch === 'keeper'
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
