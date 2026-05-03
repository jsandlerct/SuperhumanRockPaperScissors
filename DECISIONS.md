# DECISIONS.md — SRPS Locked Decisions
**Append-only.** Decisions here are not up for debate in implementation sessions.
**If a decision needs revisiting, raise it with the designer first — do not just implement differently.**
**Format:** `[vX.XX | Date] Decision — Rationale`

---

## Trophy Case Display

**[v0.2 | 2026-05-02] Trophy case displays earned trophies grouped by season — no unearned/shadow entries.**
Each season that produced a trophy shows a row of full-color trophy images with labels. The same trophy can appear in multiple seasons (e.g., Local Champion in Season 1 and Season 2 are two separate entries). Replaces the old 2-column all-trophies-with-silhouettes layout.

**[v0.2 | 2026-05-02] `_trophies.trophies` changed from `string[]` to `{id: string, season: number}[]`.**
Legacy string entries (from before this change) are read as `{ id: entry, season: 1 }` for backwards compatibility. Deduplication guard removed — same trophy ID can appear multiple times across different seasons. `newTrophy` banner (Season Complete panel) still fires only on the first earn of each trophy type.

---

## Testing

**[v0.2 | 2026-04-30] Every game system addition or change must be accompanied by added or updated tests in `js/tests/`.**
Rationale: NPC strategy bugs caught in testing (momentum off-by-one, maskedThrows order) confirmed the value of the test harness. Test coverage is not optional for game systems — it is part of the definition of done. Test files follow the `<system>.test.js` naming convention and are run via `tests.html`.

---

## Architecture

**[v0.95 | 2026-04-26] Tech stack: Vanilla HTML5 + Canvas + JavaScript, no framework, no build step.**
Rationale: zero dependencies, runs in any browser, simplest possible Claude Code support.

**[v0.95 | 2026-04-26] All localStorage access goes through `storage.js` only. No other file calls localStorage directly.**
Rationale: single point of control for migration, debugging, and future backend swap.

**[v0.95 | 2026-04-26] All randomness goes through `rng.js`. No file calls Math.random() directly.**
Rationale: makes RNG mockable for testing.

**[v0.95 | 2026-04-26] All named constants live in `constants.js`. Magic numbers are never inlined.**
Rationale: playtesting tweaks must be single-line changes in one file.

**[v0.95 | 2026-04-26] localStorage schema uses 9 namespaced key buckets, not one blob per character.**
Rationale: targeted writes — a round-end stat update must not rewrite NPC world state (39 KB).

**[v0.95 | 2026-04-26] `phase` field in `_progress` is the single source of truth for game state on reload. Never infer state from other fields.**
Rationale: clean resume after page close/crash; unambiguous screen routing.

**[v0.95 | 2026-04-26] Third tree is absent from treeState entirely (not false, not null).**
Rationale: absence is the authoritative signal to hide it from UI — avoids conditional UI logic on a value that should never be checked.

**[v0.1 | 2026-04-22] Static file hosting (GitHub Pages / Netlify). No server required through v0.3.**

**[v1.0 stretch] Backend migration: Node.js + database for cross-device persistence. localStorage schema designed from day one to make this migration clean.**

---

## NPC System

**[v0.95 | 2026-04-26] NPC vs NPC match outcomes: ELO-probability only. No round simulation, no skill resolution, no powerup resolution.**
Rationale: season simulation must be fast and synchronous; outcome difference vs full simulation is marginal since player never sees those matches.

**[v0.95 | 2026-04-26] NPC skill point spending algorithm: random selection from all legal affordable nodes.**
Rationale: produces maximum build variety across seasons without authoring burden; occasional odd builds are interesting flavor.

**[v0.95 | 2026-04-26] NPC skill points are spent once at season end only, not mid-season.**
Rationale: keeps simulation clean — no need to track NPC point balances mid-simulation.

**[v0.95 | 2026-04-26] NPC starting skill budgets by tier: T1=5, T2=15, T3=35, T4=55, T5=75 pts.**
These are the constant `NPC_STARTING_BUDGET_BY_TIER`. Never inline. Tunable during playtesting (affects new playthroughs only).

**[v0.95 | 2026-04-26] NPC starting budgets are spent at playthrough initialisation using the same random-from-legal-nodes algorithm.**

**[v0.95 | 2026-04-26] NPCs with secondaryTree: null spend entirely in their primary tree. NPCs with both trees draw from the union of both trees' legal nodes.**

**[v0.95 | 2026-04-26] NPC treeState is append-only. NPCs never respec.**
Rationale: no off-season mechanic for NPCs; append-only keeps simulation state simple.

**[v0.95 | 2026-04-26] Remaining NPC skill points carry over to next season (not discarded).**

**[v0.9 | 2026-04-26] All 99 NPC portraitIds assigned in npc_roster_v0_9.json. No same-portrait conflicts within any tournament tier. 48 of 50 portraits used. Format: male_N / female_N.**

**[v0.7 | 2026-04-26] NPC behavioral equivalents for all MIND player-only skills: passive accuracy model (Option A). Section 10.7 of design doc is fully complete.**

---

## Powerup System

**[v0.95 | 2026-04-26] Powerup inventory is a FIFO array. Activation priority is array position. Never sort. Never deduplicate. Multiple identical powerups are allowed.**

**[v0.95 | 2026-04-26] Starting powerup loadout is fully deterministic — no RNG at season start.**
See docs/SRPS_section_8_3_1_starting_loadout_v0_95.md for the full table.

**[v0.95 | 2026-04-26] MYSTIC.1's upgrade chance bonus applies to in-season round-win drops only — never to starting loadout.**
Rationale: resolves conflict between MIND.1 and MYSTIC.1 at season start; starting loadout is deterministic, drop modifiers are runtime-only.

**[v0.95 | 2026-04-26] Synergy nodes (X.1.1.2) are the sole mechanism for modifying starting loadout beyond root node baseline.**

**[v0.95 | 2026-04-26] All starting powerups drawn from the combined pool of all trees with any root node purchased.**

**[v0.95 | 2026-04-26] Powerup instanceId is generated at drop time (pu_ + 8 random hex chars). Used to identify specific inventory entries.**

**[v0.95 | 2026-04-26] `scope` field stored on each powerup inventory entry at drop time (not derived from name at runtime).**
Rationale: UI needs to display duration without re-deriving from name.

---

## Skill System

**[v0.95 | 2026-04-26] Lock In button is disabled until at least one node is purchased. Applies to pre-season allocation and off-season respec.**
Gate: `Object.values(treeState).some(tree => Object.values(tree).some(v => v === true))`

**[v0.95 | 2026-04-26] Player must purchase at least one node before any season begins or off-season respec is locked in.**
Rationale: ensures starting powerup loadout is never undefined; root node (L1, 5 pts) is always affordable.

**[v0.9 | 2026-04-26] Season 1 starting points: 15 pts, one-time only. Not awarded again in subsequent seasons.**

**[v0.8 | 2026-04-26] Consolation bonus by tournament level: T1=25, T2=20, T3=15, T4=10, T5=5 pts.**

**[v0.7 | 2026-04-26] MIND.1.1.1.1 renamed to Neural Scan 2.0. Effect: replaces Neural Scan, 90% accuracy on-demand read, cooldown reduced from 5 to 3 matches.**
One shared cooldown tracker for both. Active cooldown value determined by treeState check.

**[v0.5 | 2026-04-25] puristRandom NPC re-rolls at match start, not season start.**

**[v0.4 | 2026-04-24] NPR false result chance is always flat 10% — never scales, never reaches 0%.**

**[v0.4 | 2026-04-24] Alter Reality (60%) replaces Tweak Reality (30%) — not additive.**
Full replacement pairs listed in design doc Section 16.9.

---

## Ranking & Milestones

**[v0.2 | 2026-05-02] Ranking milestone messages (Section 11.3) are detected in summary.js after season simulation and displayed on a "Season Complete" results panel before navigating away.**
One-shot threshold milestones (ranked, top50, top20, top10, top3, rank1) are stored in `_trophies.achievedMilestones` (array of IDs). Personal best fires any season the player improves their peak rank (repeatable, not stored). Championship milestones (first T5 win, third T5 win) are detected from `stats.career.t5Wins` before incrementing.

**[v0.2 | 2026-05-02] `peakWorldRank` stored in `_progress` (lowest rank number ever achieved). Updated by `runSeasonSimulation` via `Math.min`.**
Required for personal best detection: summary.js captures it before calling the simulation, then compares against the new rank.

**[v0.2 | 2026-05-02] `stats.career.t5Wins` tracks World Championship wins separately from `tournamentsWon`.**
Needed to detect "First Championship" (t5Wins === 0 before win) and "Three-Time World Champion" (t5Wins + 1 === 3).

**[v0.2 | 2026-05-02] Season-end summary uses a two-phase UI: initial results view → "END OF SEASON" triggers simulation → "Season Complete" panel with rank + milestones → "CONTINUE" navigates.**
The initial view shows last season's rank (from `progress.worldRank`). The season complete panel shows the newly computed rank and any triggered milestones.

---

## Career Summary

**[v0.2 | 2026-05-02] Career summary screen (`js/screens/careerSummary.js`) is accessible via a STATS button on each filled character slot in the character select screen.**
Shows: portrait, current ELO + world rank, career record (seasons, tournaments, wins, runner-up, best finish, best rank, peak ELO), and throw distribution table (R/P/S play% and win% from career stats). Trophy case and HOF plaque are deferred to the trophy system task. No game logic — pure presentation, no tests required.

---

## Season Simulation

**[v0.2 | 2026-05-02] NPC season simulation runs 5 separate brackets (one per tier), NPC-only, each using the standard TOURNAMENT_CONFIG bracket size.**
Eligible pool for tier N = all NPCs with tournamentLevel ≤ N. Random selection fills each bracket; selected NPCs are seeded by ELO descending. All bracket sizes are powers of 2 (4, 8, 16, 32, 64) and eligible pool is always ≥ bracket size, so no bye handling needed.

**[v0.2 | 2026-05-02] NPC unspentSkillPoints stored in _world bucket on each NPC entry.**
Carry-over from seasons where the budget cannot be fully spent (no legal affordable nodes remain). Field initialised to remaining pts after starting budget spend; added to each season's earnings before spending.

**[v0.2 | 2026-05-02] worldRank computed as: count of NPC ELOs strictly greater than player ELO, plus 1.**
Ties resolve in the player's favour (player gets the higher rank). Computed from the post-simulation eloMap, not from stale world bucket values.

---

## Season & Tournament Structure

**[v0.2 | 2026-04-30] Bracket display redesigned as a player-path layout (one column per round, linear sequence with ▶ arrows).**
Replaces the T1 fork-connector layout. Scales cleanly to T5 (6 rounds) with horizontal scroll. NPC vs NPC results appear in a "Meanwhile…" panel after each player match, before bracket advances.

**[v0.2 | 2026-04-30] NPC bracket composition rules for T2–T5: previous finalist NPC (guaranteed) + top 5 ELO from eligible pool (guaranteed) + random fill. All seeded by ELO descending.**
T1 remains 3 random T1 NPCs + player. Eligible pool for tier N = all NPCs with tournamentLevel ≤ N.

**[v0.2 | 2026-04-30] NPC concurrent matches are simulated (ELO-probability) after the player's match completes, then revealed before the bracket advances.**
Results simulate that all matches happen simultaneously. Player clicks "Continue to [Next Round]" to advance.

**[v0.2 | 2026-04-30] Finals match is Best of 7 (first to 4 rounds). All non-final matches remain Best of 5 (first to 3).**
`matchType: 'finals'` triggers `ROUNDS_TO_WIN_MATCH_FINALS = 4` in match.js. Score bar scales to match.

**[v0.2 | 2026-04-30] Round name badges display in the match screen header (`cm.roundName`) and bracket column headers.**
Values from `TOURNAMENT_CONFIG[tier].roundNames` array, stored on `currentMatch.roundName` at match start.

**[v0.2 | 2026-04-30] `currentTournamentTier` and `previousFinalists` stored in `_progress`.**
`currentTournamentTier` (1–5) drives which bracket is generated. `previousFinalists` is set after any tournament where the player reaches the final; reset to null on season end or early elimination.

**[v0.95 | 2026-04-26] Season-end write order is mandatory: NPC simulation → NPC ELO update → player worldRank recompute → write _world → write _progress → write _trophies → write _stats (zero season after career update).**

**[v0.95 | 2026-04-26] `seasonEloHistory` stored in `_trophies` (not recomputed from world state) because NPC ELOs drift and past world ranks cannot be reconstructed retroactively.**

**[v0.6 | 2026-04-25] Total players: 99 NPCs + 1 player = 100. Tournament distribution: T1=10, T2=15, T3=20, T4=25, T5=29.**

**[v0.5 | 2026-04-25] Mid-season respec: add-only during active season. Full respec during off-season only.**

---

## ELO System

**[v0.95 | 2026-04-26] ELO K-factor: TBD — defined as constant `ELO_K_FACTOR`, tuned during playtesting.**

**[v0.2 | 2026-04-23] Standard ELO formula: `P(A beats B) = 1 / (1 + 10^((EloB - EloA) / 400))`**

**[v0.12 | 2026-04-22] HOF eligibility: evaluated after Season 10 regardless of result. Inducted if player finished in top 3 cumulative ELO rankings across all 10 seasons.**

---

## Visual Style

**[v0.2 | 2026-04-23] Game is SNES/16-bit retro aesthetic throughout. Not a filter — defines every visual element.**

**[v0.2 | 2026-04-23] Portrait size: 48×48 or 64×64 base, scaled up 2–3x. SVG/Canvas for v0.1, final pixel art for v1.0.**

**[v0.1 | 2026-04-27] Real PNG portrait assets used from v0.1. No SVG placeholders needed.**
All 50 portraits (male_1–25, female_1–25) are in `assets/portraits/`. Filename matches `portraitId` field in npc_roster exactly (e.g. `male_3.png` for `portraitId: "male_3"`). 8 Jessie expression PNGs are in `assets/portraits/jessie/` — not used until v1.0.

**[v0.9 | 2026-04-26] Player can choose any of all 50 portraits at character creation regardless of gender. Scrollable gallery.**

**[v0.1.1 | 2026-04-29] Responsive layout: game uses full viewport width on all screen sizes — no fixed 480px cap.**
`.screen` has no max-width; horizontal padding is `clamp(16px, 4vw, 64px)`. Narrow-content screens (login, summary, intro) center content in `.content-card` (max-width 560px). Character select uses `.content-card--lg` (800px) with a 2-column slot grid at ≥640px. Match screen uses a 2-column CSS grid at ≥768px (scoreboard left, action right). Tournament bracket scales up at ≥768px (larger slots, bigger portraits, wider connector). Portrait gallery in character create uses `repeat(5→8→10, 1fr)` auto-fill at breakpoints.

**[v0.1.1 | 2026-04-29] Bracket visualization redesigned as a horizontal bracket with fork connector lines.**
Replaces stacked match cards. Two columns (SEMIFINAL / FINAL) connected by a CSS fork (`.bracket-conn-top` / `.bracket-conn-bot` with interlocking border-right + border-bottom/top). Each match slot shows: portrait (28px→44px on desktop), name, score. Winner slot gets green highlight; loser fades. Active next-match gets yellow border glow.

---

## App Flow & Session

**[v0.1 | 2026-04-29] Intro plays on every page load — no session auto-resume.**
Every app load goes: intro → title → login → character select → game. The session is never used to skip the login screen. Session is written only when the player picks a character slot.

**[v0.1 | 2026-04-29] Title screen added as a dedicated screen between intro and login (`js/screens/title.js`).**
Displays `assets/SRPS Title screen.png` full-screen on a black background. Any click, tap, or keypress advances to login. Image is centered with `max-width: min(100%, 560px)`.

**[v0.1 | 2026-04-29] Pixel-art hand images used for throw selection and reveal in the match screen.**
Assets: `assets/hands/rock.png`, `assets/hands/paper.png`, `assets/hands/scissors.png`. Throw selection: 3-column button grid with hand image above label. Reveal: player hand on left (normal orientation), NPC hand on right (mirrored with `scaleX(-1)`) so both hands face each other.

**[v0.1 | 2026-04-27] Character select screen added between login and game (`js/screens/characterSelect.js`).**
Shows exactly 3 slots (MAX_CHARACTERS_PER_ACCOUNT). Filled slots show portrait, name, season, phase, ELO with a PLAY button. Empty slots show a NEW button. Log Out button returns to login and clears session.

**[v0.1 | 2026-04-27] NPC roster JSON is accessed as `.npcs` array (the JSON root has `meta` and `npcs` keys).**
`main.js` caches `roster.npcs`, not the full root object. All `getNpcById` / `getNpcsByTier` calls operate on this array.

**[v0.2 | 2026-05-02] Intro text crawl speed: 40ms per character (~300 WPM).**

**[v0.2 | 2026-05-02] Intro text updated by designer to reflect the three skill trees more explicitly.**
New lines: "BIOTECH IMPLANTS UTILIZING QUANTUM MECHANICS COULD UNLOCK SUPERHUMAN ABILITIES", "MICROSCOPIC PERCEPTION AND REACTION TIMES." (MIND), "THE ABILITY TO INFLUENCE THOUGHTS AND ACTIONS." (MYSTIC), "EVEN THE ABILITY TO CREATE ORDER FROM WHAT WAS SEEMINGLY RANDOM CHAOS." (FORTUNE). Source of truth is `js/screens/intro.js` — do not revert to older wording.

**[v0.2 | 2026-05-02] Trophy PNG assets added to `assets/trophies/` — one 1st-place and one 2nd-place image per tournament tier.**
Naming convention: `trophy_{tier}_1st_place.png` and `trophy_{tier}_2nd_place.png`, where `{tier}` is `local`, `regional`, `national`, `continental`, or `world`. Exception: the local runner-up is named `trophy_local_2nd_medal.png` (not `2nd_place`). Use these exact filenames when displaying trophies in the trophy system (v0.2).

**[v0.2 | 2026-05-02] Jessie consolation dialogue shown at season-end for eliminated players (not runner-up, not champion) as a tap-to-advance SNES dialog box stub.**
Locked dialogue text lives in `JESSIE_CONSOLATION_DIALOGUE` in `constants.js` — 5 tiers × 2 messages (pep talk + award sentence). Portrait area shows a placeholder; actual Jessie expression sprites (`assets/portraits/jessie/`) are deferred to v1.0. Dialogue fires in `summary.js` between "END OF SEASON" click and the season-results panel.

---

## Powerup Drop System

**[v0.2 | 2026-05-02] Drop pool for v0.2: "Changed My Mind" only (universal, Basic, round scope).**
All players are eligible regardless of tree. Tree-specific powerups activate in v0.3 alongside the skill tree system. "Changed My Mind" grants the ability to change your throw selection during the Gut Check phase.

**[v0.2 | 2026-05-02] Drop rates follow the escalating schedule from Section 8.4: 10% / 20% / 40% / 80% / 160% / 320% by player's Nth win in the match.**
Values >100% encode guaranteed drops + fractional chance for one more (e.g. 160% = 1 guaranteed + 60% chance of a second). Constants in `POWERUP_DROP_CHANCE_BY_ROUND_WON`.

**[v0.2 | 2026-05-02] Baseline powerup slots = 3 (Section 8.3). MIND.1 raises to 5; FORTUNE.1.1.2 synergy adds a 6th.**
Constant `POWERUP_MAX_SLOTS_BASELINE = 3`. `getMaxSlots(treeState)` in `powerupEngine.js` is the single source of truth.

**[v0.2 | 2026-05-02] Overflow prompt is mandatory and blocking (Section 6.8). Player must choose replace or discard before the round can advance.**
Each overflow drop is handled individually. On replace: chosen slot is spliced out, new drop pushed to end (FIFO preserved). On discard: drop is discarded silently.

**[v0.2 | 2026-05-02] Match screen flow restructured: picking → gut_check → revealing → (drop_result / overflow_prompt) → next round.**
Removed `powerup_stub` and `skill_stub` states. Phase 2 (Gut Check) is the combined powerup + skill info phase. "Changed My Mind" is activated in Gut Check; consuming it reveals throw-change buttons. Skill phase stub note remains visible in Gut Check (`[SKILL PHASE V0.3]`).

---

## Trophy System

**[v0.2 | 2026-05-02] Trophy case displayed in `careerSummary.js` using all 10 `TROPHY_CONFIG` entries in a 2-column grid (1st place / 2nd place per tier).**
Earned trophies show full-color PNG at 64×64 (`image-rendering: pixelated`). Unearned trophies show the same asset with `filter: grayscale(1) brightness(0.25)` — silhouette effect, no separate asset needed. The earned set is `_trophies.trophies` (array of ID strings like `t1_1st`). No tests required — pure presentation, no game logic.

**[v0.2 | 2026-05-02] Trophies awarded in two paths: advance path (T1–T4 champion, written immediately) and season-end path (any tier champion or runner-up, written as part of season-end simulation flow).**
Both paths guard against duplicates with `Array.includes` before pushing. `newTrophy` flag (set only on first earn) drives the "NEW TROPHY" display in the Season Complete panel so re-earning the same trophy does not re-trigger the callout.

---

## Off-Season Screen

**[v0.2 | 2026-05-02] Off-season screen (`js/screens/offSeason.js`) is a placeholder — skill tree respec and starting loadout both show `[UNLOCKS V0.3]` stubs.**
The screen shows: player identity panel (portrait, ELO, rank), skill points available (accumulated, no respec yet), powerup inventory cleared notice. "BEGIN SEASON N" locks in the transition: clears `powerupInventory`, increments `currentSeason`, resets `currentTournamentTier = 1` and `previousFinalists = null`, sets `phase = 'active_season'`, then navigates to tournament.

**[v0.2 | 2026-05-02] `routeByPhase` updated: `off_season` now routes to `offSeason` screen (was incorrectly pointing to `skillTree`).**

---

## Character Management

**[v0.2 | 2026-05-02] Character deletion uses a two-stage confirmation before any data is removed.**
Stage 1: "DELETE CHARACTER?" with YES/CANCEL. Stage 2: "ARE YOU SURE? PERMANENT DELETION" with YES DELETE PERMANENTLY/CANCEL. No data is touched until both confirmations pass. Deletion removes all 6 character localStorage keys (`identity`, `progress`, `stats`, `trophies`, `tournament`, `world`) via `deleteCharacterData(charId)` in `storage.js`, then removes the charId from `account.characterIds` and saves the account.

**[v0.2 | 2026-05-02] Character select screen re-renders in place after each confirmation step and after deletion — no navigation required.**
`deleteConfirm = { charId, stage }` is module-scoped state inside the mount function; resetting it to null and calling `render()` restores the normal slot view.

---

## Hosting

**[v0.1 | 2026-04-27] Project hosted on GitHub Pages.**
Repo: `https://github.com/jsandlerct/SuperhumanRockPaperScissors`
Live URL: `https://jsandlerct.github.io/SuperhumanRockPaperScissors`
Deploy: push to `master` branch — Pages auto-deploys from root.

---

## Schema Version History

**[v1.0 | 2026-04-27] localStorage schema bumped to v1.0. Reference file: `docs/SRPS_localStorage_schema_v1_0.md`.**
Changes from v0.95: added `jessieOneShots` and `jessieSeasonCheckInHistory` arrays to `_trophies` bucket. Design doc bumped to v1.0 (`docs/SRPS_Design_Doc_v1_0.docx`). Starting loadout reference (`docs/SRPS_section_8_3_1_starting_loadout_v0_95.md`) removed — content folded into v1.0 design doc.

**[v1.0 | 2026-04-27] `_trophies` bucket has an additional write trigger: immediately after any one-shot Jessie beat fires.**
Push beat ID to `jessieOneShots` (or update `jessieSeasonCheckInHistory` for M-12) and call `saveTrophies()` immediately — do not wait for end of match or season.

**[v1.0 | 2026-04-27] M-04 and M-06 Jessie beats are repeatable — never added to `jessieOneShots`.**
All other Jessie one-shot beats: check `jessieOneShots.includes(beatId)` before firing; push after firing.

**[v1.0 | 2026-04-27] `jessieSeasonCheckInHistory` tracks used M-12 line indices (0–7). Reset to [] after all 8 used.**
