# Egg Mama

**Game requirements specification · Next mobile release · November 22, 2026**

Egg Mama is an endless, side-scrolling platformer for children playing on a phone held sideways. A storm has scattered Mama’s eggs across the valley. She rolls gently forward while the player reads the terrain, backs up for a better approach, and jumps to gather her clutch. A trail of ordinary eggs can show the way across a gap. When Mama touches a golden egg, a duckling hatches, falls in behind her, and can save her from a mistake.

The journey has a destination even though play is endless. Thirteen landscapes lead from Meadow to Beacon Summit. Lighting the beacon gives the flock a way home and the player a choice to keep exploring.

## 1. The playfield and controls

The published game places a masthead and score strip above the world and a control bar below it. This release removes all three. Opening the game must feel like entering the Meadow. The title and its choices appear over the scene, then give way to play in that same space.

| ID | Required behavior |
| --- | --- |
| VIEW-1 | Fill the entire available browser viewport by default, from Main Title through play, pause, and retry. The player can start a full-size game with the browser toolbar visible and without granting fullscreen permission. Draw scenery to the edges and keep actionable controls inside phone safe areas. |
| VIEW-2 | Anchor the playfield to the screen. Swiping anywhere in the play area must leave the document at the same horizontal and vertical position, with no page bounce or pull-to-refresh. The camera follows Mama horizontally. A normal jump keeps the horizon steady and the landing in view. Chapter captions, hatching, and score changes must never resize or move the playfield. |
| VIEW-3 | Remove the persistent game name, score header, button footer, and surrounding page frame. Show the flock in the world. Put a thumb-reachable pause control over the game and keep score, journal, sound, and instructions in game menus or results. Overlays may not hide an approaching hazard while play continues. |
| VIEW-4 | Design for landscape. If a phone opens in portrait or turns upright mid-run, offer a short rotate prompt inside the game. Pause active play during the interruption and give the player control over when the run resumes. Preserve position, flock, and checkpoint across rotation. |
| INPUT-1 | Ease Mama into a slow forward roll when play starts or resumes. Swipe up to jump, left to brake and briefly back up, or right to push ahead. After a steering gesture expires, return to the gentle roll. Her shell rocks with her travel while the horizon stays level. |
| INPUT-2 | Make the main route playable with one thumb, from either side of the screen. A swipe produces one action. Allow a slightly early jump before landing and a brief grace interval after leaving an edge. Keep keyboard movement, jump, pause, and mute available. Honor reduced motion by softening decorative rocking and camera effects. |

## 2. Eggs, survival, and saved progress

| ID | Required behavior |
| --- | --- |
| FLOCK-1 | Every collected egg adds to the egg total. An ordinary egg earns points. Only a golden egg hatches, adding one visible follower while the flock has fewer than five. At five, a golden egg still awards eggs and points. The flock stays at five. |
| FLOCK-2 | Ducklings are extra lives and follow Mama through movement and jumps. A shield absorbs the next hit first. Otherwise a hit uses one duckling. A survivable collision gives Mama a short recovery window. A survivable fall returns her to safe footing at the latest checkpoint. With no shield or ducklings, a hit ends the attempt and offers a checkpoint retry. |
| PLAY-1 | Use egg trails, stompable enemies, springs, moving and crumbling ledges, lifts, spikes, ice, shields, and egg magnets to create route choices. Give the main route a readable landing and a way through using touch controls at the default pace. Upper routes can reward harder jumps with golden eggs. Missing an egg never blocks chapter completion. |
| SAVE-1 | Save automatically at checkpoint flags, chapter transitions, and the summit beacon. **Continue** and **Retry checkpoint** restore the latest saved chapter or circuit, safe position, generated route, egg total, score, and flock in the same browser. A failed attempt, reload, or trip to Main Title preserves the save. |
| SAVE-2 | Put **Start Over** on Main Title and require confirmation before replacing a journey. Cancel must preserve the save. A confirmed new journey starts in Meadow with zero eggs and zero followers. A release upgrade must let returning players continue an existing GitHub Pages save. |

## 3. Longer chapters with a difficulty curve

**LEVEL-1.** Extend all 13 chapters beyond their published versions. Give each an opening that teaches or recalls a move, a middle stretch that varies it, and a closing challenge that leads into the next landscape. A short story cue explains where the eggs went or why Mama follows this route. The trail journal keeps those cues available for rereading.

**LEVEL-2.** Increase the demands as the journey advances. Early chapters isolate one decision at a time. Later chapters combine familiar skills, shorten safe timing windows, and ask players to plan a second landing. Keep the default roll gentle. Place checkpoint flags on safe ground before demanding sequences so a missed jump gives the player a nearby chance to practice.

**Proposed first-pass pacing.** Time a clean main-route run from chapter entry to exit at the default cruise, including required jumps and excluding pauses, retries, and optional detours. Aim for 60–90 seconds per chapter in chapters 1–4, 90–120 in chapters 5–9, and 120–150 in chapters 10–13. Adjust the targets after observing real players.

| Chapter | What the player learns or has to do |
| --- | --- |
| 1 · Meadow | Find the first golden egg on safe ground. Follow an egg arc across a single gap with a wide landing. |
| 2 · Clover Mill | Read a patrolling enemy and choose when to jump into a second egg trail. |
| 3 · Reedwater | Cross stepping ledges above the flooded path. Spot the next landing before leaving the current one. |
| 4 · Orchard Heights | Use a spring to reach an egg in the branches, then steer back onto the lower path. |
| 5 · Amber Quarry | Recognize a cracked ledge and jump again before it gives way. |
| 6 · Fogwood | Read a flying enemy’s path and choose a safe crossing. Keep the landing visible through the mist. |
| 7 · Ember Canyon | Chain a gap and a spike crossing with room to recover between them. |
| 8 · Glass Coast | Board a moving lift and time the exit onto a coastal ledge. |
| 9 · Lantern Caverns | Transfer from a moving lift to a crumbling ledge, then leave it in time. |
| 10 · Frostline | Anticipate an icy stopping distance while lining up successive jumps. |
| 11 · Moonridge | Read an enemy patrol while choosing where to land from a moving platform. |
| 12 · Dawnbridge | Cross a sequence of broken spans. Identify the next two landings from each safe approach. |
| 13 · Beacon Summit | Combine springs, lifts, and timed jumps on the final ascent. Touch the beacon to light it for the flock. |

**LEVEL-3.** At the beacon, acknowledge the recovered eggs and offer **Keep Going** or **Main Title**. Continuing opens another circuit through the same 13 landscapes with fresh terrain and the accumulated flock and totals. Each repeat must remain traversable with touch controls.

## 4. Art and music direction

**ART-1.** Keep the 13 pixel-art backgrounds crisp and recognizable. Redraw Mama, ducklings, eggs, enemies, hazards, interactive platforms, and pickups with smooth contours that hold up at full phone resolution. Use the object art in *Egg Runner 2* as the reference for warm upper-left lighting, colored outlines, rounded volume, and contact shadows. Apply that treatment to Egg Mama’s side view. Mama’s shadow should help a player judge where she will land.

**ART-2.** At playing size, the player must be able to tell an ordinary egg from a golden egg, safe ground from a crumbling ledge, and a duckling from a pickup. Give each a distinct shape, marking, or motion in addition to color. Check these distinctions in the bright Meadow, misty Fogwood, and dark Lantern Caverns.

**AUDIO-1.** Compose a new original platformer theme. Give Meadow a short, hummable phrase over a buoyant bass line and crisp percussion, leave space for pickups to sound, and bring the phrase back in a fuller arrangement at the beacon. Vary melody, instrumentation, and intensity across the valley, caverns, and ascent. Each arrangement must sustain a longer chapter and loop cleanly.

**AUDIO-2.** Give an ordinary pickup, a golden hatch, a lost duckling, a checkpoint, and the lit beacon distinguishable sounds. On phone speakers, a hatch must be audible over the busiest music. Pause or background the game and the music stops. Resume starts one music stream. Mute persists across reloads, and all essential events have a visual cue.

## 5. Release acceptance

| Test | Pass condition |
| --- | --- |
| Phone playfield | On a physical iPhone in Safari and an Android phone in Chrome, launch in landscape with browser controls visible. Play to a checkpoint, swipe from both screen halves, pause, rotate twice, and resume. The playfield fills the available area, the page stays put, menus remain reachable, and the same run resumes. |
| First minute | Give a first-time player the phone in landscape. Observe whether they can start, recognize the first hatch, and clear the first required gap using swipes and the in-game cues. Record missed inputs and moments when the landing was hidden. A required jump obscured by scenery or UI fails the check. |
| Chapter pacing and fairness | Time all 13 chapters against the proposed bands. Repeat representative early, middle, and late chapters on several generated routes with hazards enabled. Verify each mandatory sequence at default cruise, each checkpoint recovery, and the first transition into circuit two. |
| Flock and saves | Collect ordinary and golden eggs, reach five followers, then collect a sixth golden egg. Check shield-first damage and unshielded duckling loss. Save at a chapter boundary, reload, retry after a failed attempt, and cancel Start Over. Each path must restore the expected totals and flock. Confirm Start Over separately. |
| Picture and sound | Review the same running, jumping, hatching, and damage sequences against bright and dark backgrounds at phone size. Listen through phone speakers for a full music loop and a chapter transition. The landing remains readable, the hatch sounds distinct, and music resumes once after pause. |
| Publication | A push to the publishing folder on the main branch automatically updates GitHub Pages. Open the deployed project URL directly on a phone. The game, artwork, and audio load, and a checkpoint from the preceding release still opens through Continue. |

**Source baseline** · [Published game](https://benlambm.github.io/egg-mama/) · [Egg Mama source at 32622cb](https://github.com/benlambm/egg-mama/tree/32622cb9879330e1a4661703c13433cd37864419) · [Egg Runner 2 object art reference](https://github.com/benlambm/egg-runner-2/blob/e0c5fa946410cc4e641a03b19f45a416f8e8a78d/js/art.js)
