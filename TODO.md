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
- [ ] `index.html` — single entry point, loads all JS modules
- [ ] `css/style.css` — SNES palette, pixel font import, base layout
- [ ] `js/main.js` — app init, screen router (reads `phase` from progress, routes to correct screen)
- [ ] App load sequence: migrate → check session → load phase → route to screen

### Intro Screen
- [ ] `js/screens/intro.js` — text-crawl reveal at ~50 words/minute
- [ ] SNES-style pixel font, dark background, subtle scanline effect
- [ ] Skip button available
- [ ] Transitions to login screen on completion or skip

### Login / Account Screen
- [ ] `js/screens/login.js`
- [ ] Show existing accounts from `srps_meta.accountUsernames`
- [ ] Login form: username + password, verify against hash in `srps_acct_{username}`
- [ ] Create account flow: new username + password (hash before storing)
- [ ] After login: load character list from account; if no characters, go to character creation
- [ ] Set `srps_session` on successful login

### Character Creation
- [ ] `js/screens/characterCreate.js`
- [ ] Name input field
- [ ] Portrait selector: scrollable gallery of all 50 portraits (male_1–25, female_1–25)
- [ ] Any portrait selectable regardless of gender
- [ ] On confirm: generate charId (char_ + 8 hex chars), write `_identity` with trees as null, write `_progress` with phase=pre_season season=1
- [ ] For v0.1: skip tree selection (no skill trees yet); set phase=active_season directly

### Match Screen (v0.1 core loop)
- [ ] `js/screens/match.js` — round loop controller
- [ ] `js/systems/round.js` — round resolution
  - [ ] Player throw selection (R/P/S buttons)
  - [ ] NPC throw determination (strategy engine for v0.1 strategies only)
  - [ ] Round outcome resolution (win/lose/tie)
  - [ ] Match win condition: first to `ROUNDS_TO_WIN_MATCH` (3) rounds
  - [ ] Round history panel: running tally of rounds won per player
- [ ] Placeholder: powerup activation phase (disabled, UI stub only)
- [ ] Placeholder: skill information phase (disabled, UI stub only)

### NPC Strategy Engine (v0.1 strategies only)
- [ ] `js/systems/npc.js`
- [ ] `random`: uniform random throw each round
- [ ] `puristRock`: always rock
- [ ] `puristPaper`: always paper
- [ ] `puristScissors`: always scissors
- [ ] `puristRandom`: pick random throw at match start, throw same every round
- [ ] `mirror`: throw whatever player threw last round (round 1: random)

### Tournament (v0.1: Tournament 1 only)
- [ ] `js/screens/tournament.js`
- [ ] Tournament 1: Local Championship — 2-round bracket, 4 players (player + 3 T1 NPCs)
- [ ] Select 3 random T1 NPCs from npc_roster for the bracket
- [ ] Generate bracket, populate `_tournament` bucket
- [ ] Player's path only (2 matches to win)
- [ ] After each match: write result to `_tournament.bracket`
- [ ] Basic bracket display: show player's path, results as they populate
- [ ] On bracket complete: route to post-tournament summary

### ELO (v0.1: player only)
- [ ] `js/systems/elo.js`
- [ ] Standard formula: `P = 1 / (1 + 10^((eloB - eloA) / 400))`
- [ ] Update player ELO after tournament based on win/loss vs each opponent
- [ ] Use `ELO_K_FACTOR` constant — never hardcode 32
- [ ] Write updated ELO to `_progress`
- [ ] v0.1: no NPC ELO updates, no world simulation (those are v0.2)

### Post-Tournament Summary
- [ ] `js/screens/summary.js` (basic)
- [ ] Show: result (win/loss), rounds played, player ELO change
- [ ] v0.1: no skill point award screen, no powerup drops, no off-season
- [ ] For v0.1: after summary, loop back to tournament (same tournament level)

### SNES Visual Style
- [ ] Pixel font — load from CDN (Press Start 2P or equivalent)
- [ ] Chunky UI panels with SNES-style borders (think FF6 menu boxes)
- [ ] Portrait boxes: 48×48 base, scaled 2–3x, SNES-style frame
- [ ] SVG placeholder portraits for v0.1 (simple colored shapes with initial letter)
- [ ] Mobile portrait layout (vertical), touch input for all buttons

### NPC Data Loading
- [ ] Load `data/npc_roster_v0_9.json` at app init
- [ ] Cache in memory — it's read-only, never written at runtime
- [ ] Helper: `getNpcById(id)`, `getNpcsByTier(level)`

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
