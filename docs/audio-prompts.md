# Audio prompts

Generated from `tools/audio/prompts.mjs` by `node tools/audio/generate.mjs --sheet`. Edit the
.mjs file, not this one. Each file goes in `public/assets/audio/<folder>/<name>.ogg`; a
"×N" entry is N files named `<name>-1` to `<name>-N`, and the game picks one at random.

To make them by hand on elevenlabs.io instead of with the script: paste the prompt into
Sound Effects (with the house style below), Text to Speech (with the voice below) or Music,
download, put the file in `tools/audio/raw/<folder>/<name>.mp3`, and run
`node tools/audio/convert.mjs`.

**Sound effect house style** (added to every effect prompt): Victorian gothic horror game, 1891, dry and close, no music.

**Narrator voice:** Old English man, low, quiet and weary, unhurried, like reading a parish record by candlelight.

**Elias's voice:** Tired English man in his fifties, hoarse, frightened but careful, half whispering.

"Not played yet" files are listed so the set is complete; the game does not use them yet.

## First batch

| File | Kind | Prompt or line | Length | Played |
|---|---|---|---|---|
| `sfx/step-grass.ogg ×4` | sfx | single footstep on wet grass and soft mud, leather boot, close | 0.6 s | yes |
| `sfx/zombie-groan.ogg ×3` | sfx | rotting zombie groan, low wet throat rattle, slow, hungry, close | 3 s | yes |
| `sfx/melee-hit.ogg` | sfx | heavy wooden shovel striking a rotting body, wet thud with bone crunch | 0.8 s | yes |
| `sfx/revolver-shot.ogg` | sfx | single 1880s black powder revolver gunshot, sharp crack with short outdoor echo | 1.5 s | yes |
| `ambience/rain.ogg` | sfx | steady light rain on grass and gravestones, distant drips, seamless loop (loop) | 30 s | yes |
| `voice/intro-1.ogg` | voice | *narrator:* Hollowmere, October 1891. |  | yes |
| `voice/intro-2.ogg` | voice | *narrator:* The parish wrote: the keeper, Elias Thorne, has not been seen in three weeks. |  | yes |
| `voice/intro-3.ogg` | voice | *narrator:* They need someone to tend the dead. |  | yes |
| `voice/intro-4.ogg` | voice | *narrator:* The graves here are opening. From the inside. |  | yes |
| `voice/intro-5.ogg` | voice | *narrator:* Elias left a page on the table. |  | yes |

## Sound effects

| File | Kind | Prompt or line | Length | Played |
|---|---|---|---|---|
| `sfx/step-stone.ogg ×4` | sfx | single footstep on old flagstone floor in a stone chapel, leather boot, slight echo | 0.6 s | yes |
| `sfx/step-wood.ogg ×4` | sfx | single footstep on creaky wooden floorboards in a small hut, leather boot | 0.6 s | yes |
| `sfx/stair-footsteps.ogg` | sfx | slow footsteps going down worn stone stairs into a crypt, echo | 2 s | yes |
| `sfx/shotgun-blast.ogg` | sfx | single 1890s double barrel shotgun blast, deep boom, outdoor echo | 1.8 s | yes |
| `sfx/dry-click.ogg` | sfx | empty revolver hammer click, dry metallic click, close | 0.4 s | yes |
| `sfx/reload.ogg` | sfx | loading brass cartridges into an old revolver cylinder, metallic clicks, cylinder snaps shut | 1.6 s | yes |
| `sfx/heavy-swing.ogg` | sfx | heavy wooden tool swung hard through the air, whoosh | 0.6 s | yes |
| `sfx/kick.ogg` | sfx | boot kicking a body hard, dull thud and grunt of air | 0.6 s | yes |
| `sfx/dodge.ogg` | sfx | quick sidestep on grass, clothing rustle and scuff | 0.5 s | yes |
| `sfx/weapon-crack.ogg` | sfx | wooden handle cracking under strain, sharp splintering crack | 0.7 s | yes |
| `sfx/weapon-break.ogg` | sfx | wooden tool handle snapping in two, splinters falling | 1 s | yes |
| `sfx/throw.ogg` | sfx | small glass bottle thrown, short whoosh | 0.5 s | yes |
| `sfx/flask-shatter.ogg` | sfx | glass flask shattering on stone, liquid splash | 1 s | yes |
| `sfx/bomb-fuse.ogg` | sfx | short black powder fuse hissing and sparking | 1.5 s | yes |
| `sfx/bomb-blast.ogg` | sfx | small black powder bomb explosion, dirt and debris falling, outdoor | 2.5 s | yes |
| `sfx/trap-spring.ogg` | sfx | iron bear trap snapping shut, heavy metal clang | 0.8 s | yes |
| `sfx/salt-place.ogg` | sfx | handful of coarse salt poured onto stone in a circle, grainy hiss | 1.2 s | yes |
| `sfx/bloater-gurgle.ogg` | sfx | bloated corpse gurgling, wet bubbling stomach, disgusting, slow | 2.5 s | yes |
| `sfx/bloater-hiss.ogg` | sfx | swollen corpse hissing gas as it swells, wet hiss | 1.2 s | yes |
| `sfx/bloater-burst.ogg` | sfx | bloated corpse bursting, wet splatter and gas pop | 1.2 s | yes |
| `sfx/brute-grunt.ogg` | sfx | huge undead man grunting, deep angry growl, close | 1.2 s | yes |
| `sfx/brute-step.ogg` | sfx | very heavy undead footstep thudding on earth, low | 0.7 s | yes |
| `sfx/lurker-breath.ogg` | sfx | something crouched in the dark breathing slowly, wet rasping breath | 2.5 s | yes |
| `sfx/wailer-wail.ogg` | sfx | ghostly undead woman wailing, distant, long reverb, chilling | 3.5 s | yes |
| `sfx/elite-arrival.ogg` | sfx | horror sting, low brass swell and a deep hit, something powerful has arrived | 2.5 s | yes |
| `sfx/boss-rise.ogg` | sfx | undead priest rising from a crypt, stone cracking, deep choir drone, rumble | 4 s | yes |
| `sfx/crane-censer.ogg` | sfx | iron censer swinging on a chain, creak and clink, smoky | 1.5 s | yes |
| `sfx/censer-chain.ogg` | sfx | heavy iron chain rattling and swinging | 1 s | yes |
| `sfx/boss-death.ogg` | sfx | undead priest collapsing to dust, long fading moan and falling stone | 4 s | yes |
| `sfx/hand-grab.ogg` | sfx | rotting hand bursting out of grave soil and grabbing, dirt crumbling, wet | 1.2 s | yes |
| `sfx/grab-stinger.ogg` | sfx | sudden horror jump scare sting, violin screech and low impact | 1.5 s | yes |
| `sfx/grab-stinger-soft.ogg` | sfx | soft horror sting, muted string swell, unsettling | 1.5 s | yes |
| `sfx/door-creak.ogg` | sfx | old wooden door creaking open slowly, rusty hinges | 2.5 s | yes |
| `sfx/door-slam.ogg` | sfx | heavy wooden door slamming shut in a stone building, echo | 1.2 s | yes |
| `sfx/stone-grind.ogg` | sfx | heavy stone slab grinding and scraping open | 2.5 s | yes |
| `sfx/soil-crumble.ogg` | sfx | grave soil shifting and crumbling, dirt trickling | 1.5 s | yes |
| `sfx/wind-gust.ogg` | sfx | cold wind gust through dead trees, sudden, whistling | 3 s | yes |
| `sfx/breath-behind.ogg` | sfx | slow raspy breath right behind the listener, very close, intimate | 2 s | yes |
| `sfx/whisper-keeper.ogg` | sfx | unintelligible ghostly whispers of several voices, close, left and right | 3 s | yes |
| `sfx/heartbeat.ogg` | sfx | single heavy heartbeat thump, low, muffled | 0.8 s | yes |
| `sfx/thunder-close.ogg` | sfx | close thunder crack and long rumble | 4 s | yes |
| `sfx/thunder-far.ogg` | sfx | distant rolling thunder | 4 s | yes |
| `sfx/toll.ogg` | sfx | single deep church bell toll, long ring | 5 s | yes |
| `sfx/congregation.ogg` | sfx | murmuring congregation of ghostly voices in a chapel, indistinct, eerie | 4 s | yes |
| `sfx/dig.ogg` | sfx | shovel digging into wet grave soil, scrape and dirt thrown | 1.5 s | not yet |
| `sfx/board-nail.ogg` | sfx | hammering a nail into a wooden board, three strikes | 1.2 s | yes |
| `sfx/board-break.ogg` | sfx | wooden plank torn off a door and splintering | 1 s | yes |
| `sfx/crafting-tick.ogg` | sfx | small tool tapping wood at a workbench, single tap | 0.4 s | yes |
| `sfx/crafting-complete.ogg` | sfx | wooden knock then a soft small bell chime, success | 1 s | yes |
| `sfx/crafting-cancel.ogg` | sfx | tools dropped onto a wooden bench, clatter | 0.8 s | yes |
| `sfx/satchel-open.ogg` | sfx | old leather satchel opened, buckle and leather creak | 0.8 s | yes |
| `sfx/satchel-close.ogg` | sfx | leather satchel flap closed, short creak and soft thump | 0.5 s | yes |
| `sfx/page-turn.ogg` | sfx | old parchment page picked up and turned, dry paper rustle | 0.8 s | yes |
| `sfx/pin-reached.ogg` | sfx | soft small chime, gentle, single note | 0.8 s | yes |
| `sfx/effect-apply.ogg` | sfx | drinking from a glass tonic bottle, gulp and a soft breath | 1.2 s | yes |
| `sfx/vending-coin.ogg` | sfx | single old coin dropped into a metal slot, clink | 0.6 s | yes |
| `sfx/vending-handle.ogg` | sfx | heavy brass lever pulled on an old machine, clunk and spring | 0.8 s | yes |
| `sfx/vending-tray.ogg` | sfx | small glass bottle dropping into a metal tray | 0.8 s | yes |
| `sfx/vending-refuse.ogg` | sfx | old machine refusing, coin rattling back out, dull buzz | 0.8 s | yes |
| `sfx/altar-solved.ogg` | sfx | soft holy chime and a warm low choir note, relief | 2.5 s | yes |
| `sfx/altar-wrong.ogg` | sfx | low dissonant organ note and a stone knock, wrong | 1.5 s | yes |
| `sfx/altar-locked.ogg` | sfx | dull stone thud, heavy and final | 0.8 s | yes |
| `sfx/relic-placed.ogg` | sfx | small metal object set on a stone altar, resonant clink | 1 s | yes |
| `sfx/merchant-arrive.ogg` | sfx | horse drawn cart creaking to a stop, harness jingle | 3 s | yes |
| `sfx/merchant-leave.ogg` | sfx | horse drawn cart rolling away on gravel, fading | 3 s | yes |

## Ambience loops

| File | Kind | Prompt or line | Length | Played |
|---|---|---|---|---|
| `ambience/wind-night.ogg` | sfx | cold night wind over an open graveyard, low and steady, seamless loop (loop) | 30 s | not yet |
| `ambience/day-birds-crows.ogg` | sfx | grey morning in a country graveyard, distant crows, faint wind, seamless loop (loop) | 30 s | not yet |
| `ambience/hut-interior.ogg` | sfx | inside a small wooden hut, iron stove crackling, roof creaks, rain outside, seamless loop (loop) | 30 s | not yet |
| `ambience/catacombs-drip.ogg` | sfx | stone catacombs, slow water drips, low room tone, distant settling stone, seamless loop (loop) | 30 s | not yet |

## Music

| File | Kind | Prompt or line | Length | Played |
|---|---|---|---|---|
| `music/stem-drone.ogg` | music | dark ambient drone for a horror game, low cello and organ pedal, D minor, 60 bpm, no drums, calm, seamless loop (loop) | 60 s | not yet |
| `music/stem-unease.ogg` | music | unsettling horror layer, sparse detuned violin harmonics and soft piano notes, D minor, 60 bpm, seamless loop (loop) | 60 s | not yet |
| `music/stem-tension.ogg` | music | tense horror layer, pulsing low strings and ticking percussion, D minor, 60 bpm, seamless loop (loop) | 60 s | not yet |
| `music/stem-danger.ogg` | music | urgent horror layer, frantic tremolo strings and heavy timpani hits, D minor, 60 bpm, seamless loop (loop) | 60 s | not yet |
| `music/title-theme.ogg` | music | slow mournful Victorian gothic theme, solo cello and music box over organ, D minor, sparse (loop) | 90 s | not yet |
| `music/ending-rest.ogg` | music | gentle hopeful dawn theme, warm strings and soft choir, D major, peaceful, release | 60 s | not yet |
| `music/ending-taken.ogg` | music | bleak funeral dirge, low organ and a single tolling bell, D minor, hopeless | 60 s | not yet |

## Narration

| File | Kind | Prompt or line | Length | Played |
|---|---|---|---|---|
| `voice/page-1.ogg` | voice | *elias:* Third night at Hollowmere and I have stopped pretending it is the foxes. The graves along the north row were not dug from above. The soil is pushed up and outward, as though something had been trying to leave. I checked the dates against the parish ledger and they do not agree. Someone has been tidying the truth. I will keep the lantern lit. |  | not yet |
| `voice/page-2.ogg` | voice | *elias:* Found this beneath the Marsh family stone, wrapped in oilcloth. The ledger records thirty-one burials in a single week of 1849, and not one death certificate among them. Thirty-one graves, and I have dug beside half of them. They are empty. Whoever was laid here did not stay, or was never laid here at all. |  | not yet |
| `voice/page-3.ogg` | voice | *elias:* The Crane crypt gave up a fragment in the priest’s own hand. "They were not dead. God forgive me, they were not yet dead, and I could not bear the fever to spread." He sealed them below the chapel and wrote them into the ledger as buried. At the foot of the page is a ring of salt and a note: grave salt and holy water, drawn as a circle, and nothing foul will cross it. I have copied it out. Further down, smudged: "What I hid, I hid beneath the Word." He prayed first, then rang the bell, then named the smallest of them, then covered the rest, and last he sealed the heart away. |  | not yet |
| `voice/page-4.ogg` | voice | *elias:* Scratches on every stone, low down, where a seated man could reach. Names, hundreds of small marks, and the same names again and again. Beside the sealed door, five relics are listed for the Rite of Rest, in the order Crane confessed it: the rosary, the clapper, the locket, the shroud, the heart. Crane meant to lay them on the altar in that order and finish what guilt began. He died with the words half said. I mean to say the rest. |  | not yet |
| `voice/page-5.ogg` | voice | *elias:* The rite did not take. I did not have all five, and I did not hold the words long enough. I can hear them in the chapel walls now, and I can hear myself among them. Finish it, whoever you are. Do not let me out. |  | not yet |
| `voice/ending-rest-1.ogg` | voice | *narrator:* The last name is spoken. The altar candle does not gutter. |  | not yet |
| `voice/ending-rest-2.ogg` | voice | *narrator:* Under the grass, thirty-one breaths let go at once. |  | not yet |
| `voice/ending-rest-3.ogg` | voice | *elias:* "Thank you, keeper," says a voice with Elias in it. |  | not yet |
| `voice/ending-rest-4.ogg` | voice | *narrator:* Dawn comes over Hollowmere, and the dead lie down. |  | not yet |
| `voice/ending-taken-1.ogg` | voice | *narrator:* Dawn finds the cemetery quiet and the rite undone. |  | not yet |
| `voice/ending-taken-2.ogg` | voice | *narrator:* The ledger has a new line, in a hand you almost know. |  | not yet |
| `voice/ending-taken-3.ogg` | voice | *narrator:* Your name. Today's date. "Buried." |  | not yet |
| `voice/ending-taken-4.ogg` | voice | *narrator:* Somewhere above, the bell begins to ring for someone else. |  | not yet |
| `voice/walkout-1.ogg` | voice | *narrator:* The fog thins as the sun climbs over Hollowmere. |  | not yet |
| `voice/walkout-2.ogg` | voice | *narrator:* Behind you, the graves are only graves again. |  | not yet |
| `voice/walkout-3.ogg` | voice | *narrator:* The lane is empty. You do not look back. |  | not yet |
