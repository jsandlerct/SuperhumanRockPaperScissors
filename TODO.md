# TODO.md — SRPS Task List
**Mark tasks `[x]` immediately upon completion — not at end of session.**
**Do not start a task not on this list without adding it here first.**
**Current target: v0.1 MVP**

---

## Setup

- [x] Create file structure as defined in CLAUDE.md Section 3
- [x] Create `js/constants.js` with all constants from CLAUDE.md Section 5
- [x] Create `js/utils/rng.js` — single `roll()` function wrapping Math.random()
- [x] Create `js/storage.js` — migration function + all read/write helpers
  - [x] `migrateIfNeeded()` — runs on every app load, checks schemaVersion
  - [x] `saveSession()`, `loadSession()`, `clearSession()`
  - [x] `saveAccount()`, `loadAccount()`
  - [x] `saveIdentity()`, `loadIdentity()`
  - [x] `saveProgress()`, `loadProgress()`
  - [x] `saveStats()`, `loadStats()`
  - [x] `saveTournament()`, `loadTournament()`
  - [x] `saveWorld()`, `loadWorld()`

---

## v0.1 MVP Tasks

### Infrastructure
- [x] `index.html` — single entry point, loads all JS modules
- [x] `css/style.css` — SNES palette, pixel font import, base layout
- [x] `js/main.js` — app init, screen router (reads `phase` from progress, routes to correct screen)
- [x] App load sequence: migrate → check session → load phase → route to screen

### Intro Screen
- [x] `js/screens/intro.js` — text-crawl reveal at ~50 words/minute
- [x] SNES-style pixel font, dark background, subtle scanline effect
- [x] Skip button available
- [x] Transitions to login screen on completion or skip

### Login / Account Screen
- [x] `js/screens/login.js`
- [x] Show existing accounts from `srps_meta.accountUsernames`
- [x] Login form: username + password, verify against hash in `srps_acct_{username}`
- [x] Create account flow: new username + password (hash before storing)
- [x] After login: load character list from account; if no characters, go to character creation
- [x] Set `srps_session` on successful login

### Character Creation
- [x] `js/screens/characterCreate.js`
- [x] Name input field
- [x] Portrait selector: scrollable gallery of all 50 portraits (male_1–25, female_1–25)
- [x] Any portrait selectable regardless of gender
- [x] On confirm: generate charId (char_ + 8 hex chars), write `_identity` with trees as null, write `_progress` with phase=active_season season=1
- [x] For v0.1: skip tree selection (no skill trees yet); set phase=active_season directly

### Match Screen (v0.1 core loop)
- [x] `js/screens/match.js` — round loop controller
- [x] `js/systems/round.js` — round resolution
  - [x] Player throw selection (R/P/S buttons)
  - [x] NPC throw determination (strategy engine for v0.1 strategies only)
  - [x] Round outcome resolution (win/lose/tie)
  - [x] Match win condition: first to `ROUNDS_TO_WIN_MATCH` (3) rounds
  - [x] Round history panel: running tally of rounds won per player
- [ ] Placeholder: powerup activation phase (disabled, UI stub only)
- [ ] Placeholder: skill information phase (disabled, UI stub only)

### NPC Strategy Engine (v0.1 strategies only)
- [x] `js/systems/npc.js`
- [x] `random`: uniform random throw each round
- [x] `puristRock`: always rock
- [x] `puristPaper`: always paper
- [x] `puristScissors`: always scissors
- [x] `puristRandom`: pick random throw at match start, throw same every round
- [x] `mirror`: throw whatever player threw last round (round 1: random)

### Tournament (v0.1: Tournament 1 only)
- [x] `js/screens/tournament.js`
- [x] Tournament 1: Local Championship — 2-round bracket, 4 players (player + 3 T1 NPCs)
- [x] Select 3 random T1 NPCs from npc_roster for the bracket
- [x] Generate bracket, populate `_tournament` bucket
- [x] Player's path only (2 matches to win)
- [x] After each match: write result to `_tournament.bracket`
- [x] Basic bracket display: show player's path, results as they populate
- [x] On bracket complete: route to post-tournament summary

### ELO (v0.1: player only)
- [x] `js/systems/elo.js`
- [x] Standard formula: `P = 1 / (1 + 10^((eloB - eloA) / 400))`
- [x] Update player ELO after tournament based on win/loss vs each opponent
- [x] Use `ELO_K_FACTOR` constant — never hardcode 32
- [x] Write updated ELO to `_progress`
- [x] v0.1: no NPC ELO updates, no world simulation (those are v0.2)

### Post-Tournament Summary
- [x] `js/screens/summary.js` (basic)
- [x] Show: result (win/loss), rounds played, player ELO change
- [x] v0.1: no skill point award screen, no powerup drops, no off-season
- [x] For v0.1: after summary, loop back to tournament (same tournament level)

### SNES Visual Style
- [x] Pixel font — load from CDN (Press Start 2P or equivalent)
- [x] Chunky UI panels with SNES-style borders (think FF6 menu boxes)
- [x] Portrait boxes: 48×48 base, scaled 2–3x, SNES-style frame
- [x] Portrait assets — real PNGs in `assets/portraits/`, no SVG placeholders needed
- [ ] Mobile portrait layout (vertical), touch input for all buttons

### v0.1 Remaining
- [ ] Powerup activation phase placeholder (disabled UI stub in match screen)
- [ ] Skill information phase placeholder (disabled UI stub in match screen)

### NPC Data Loading
- [x] Load `data/npc_roster_v0_9.json` at app init
- [x] Cache in memory — it's read-only, never written at runtime
- [x] Helper: `getNpcById(id)`, `getNpcsByTier(level)`

---

## v0.2 Tasks (do not start until v0.1 ships)

- [ ] All 5 tournaments with correct bracket sizes
- [ ] Full season structure: advancement rules, season end conditions
- [ ] Off-season screen (placeholder respec — no trees)
- [ ] Full NPC roster: all 99 NPCs, all 13 strategies
- [ ] Full ELO simulation: all NPC vs NPC matches per season (ELO-probability only)
- [ ] Global ranking display with milestone celebrations (Section 11.3)
- [ ] Career summary screen: stats, throw distribution
- [ ] Post-season summary: consolation bonus + Jessie dialogue stubs
- [ ] Trophy system: 5 trophy types, trophy case
- [ ] Basic powerup drops (Basic tier only, no tree-specific powerups)
- [ ] 3 characters per account

---

## v0.3 Tasks (do not start until v0.2 ships)

- [ ] All 3 skill trees, levels 1–2 only
- [ ] Active skill system: one active skill per round, cooldowns, UI buttons
- [ ] Skill point allocation UI: node graph, tap to inspect, Add/Remove/Lock In
- [ ] Lock In gate: disabled until ≥1 node purchased (Section 6.10 of CLAUDE.md)
- [ ] Mid-season point spending after each tournament (add-only)
- [ ] Full off-season respec
- [ ] Season 1 / Season 2 tree selection rules enforced
- [ ] NPC tree configs active: NPCs spend points per random-from-legal-nodes
- [ ] Trust My Luck for FORTUNE (levels 1–2, 75% baseline)
- [ ] Cross-tree synergy nodes (level 3) — may slide to v1.0

---

## v1.0 Tasks (do not start until v0.3 ships)

- [ ] Full 4-level skill trees (all 15 nodes per tree)
- [ ] All cross-tree synergy pairs
- [ ] All counter skill classifications
- [ ] Complete powerup catalog: Basic, Advanced, Legendary
- [ ] Hall of Fame: 10-season evaluation, induction screen
- [ ] Full NPC behaviors: strategy + skill tree + powerup
- [ ] Trust My Luck full implementation (75% / 85% / 95%)
- [ ] Skill information phase fully implemented
- [ ] Coach Jessie: complete tutorial + all milestone dialogues
- [ ] Final portrait assets replacing SVG placeholders
- [ ] All 13 NPC strategies fully implemented

---

## Backlog / Post-v1.0

- [ ] Audio: 8-bit chiptune music and SFX
- [ ] Full bracket view: all NPC matches visible
- [ ] Difficulty levels (easy/normal/hard)
- [ ] Additional NPC strategies
- [ ] Achievement system beyond HOF
- [ ] Backend migration for cross-device sync
