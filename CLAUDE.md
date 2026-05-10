# CLAUDE.md — Superhuman Rock Paper Scissors (SRPS)
**Read this file completely before writing a single line of code.**
**Then read the files imported below.**

@DECISIONS.md
@TODO.md

---

## 1. Quick Start — Session Orientation

Every Claude Code session begins with this sequence, no exceptions:

1. Read this file (CLAUDE.md) completely
2. Read DECISIONS.md — these are locked, do not relitigate them
3. Read TODO.md — find the current task, do not start something not on the list
4. Before implementing any game system, read the relevant section of the design doc
5. When any decision is made (design or implementation), write it to DECISIONS.md immediately — not at end of session
6. Mark tasks done in TODO.md immediately upon completion — not at end of session

**Design doc:** `docs/SRPS_Design_Doc_v1_0.mht`
**localStorage schema:** `docs/SRPS_localStorage_schema_v1_0.md`
**NPC roster:** `data/npc_roster_v0_9.json`

---

## 2. Project Identity

**Game:** Superhuman Rock Paper Scissors (SRPS)
**Type:** Browser-based single-player strategy game, set in 2050
**Premise:** Players choose skill trees (MIND / MYSTIC / FORTUNE) that define their competitive identity across a 10-season career arc against 99 NPC competitors
**Visual style:** SNES / 16-bit retro pixel art throughout — chunky UI panels, pixel fonts, sprite animations
**Current design doc version:** 0.95
**Current game version target:** v0.1 MVP (see Section 7 of this file for scope)

---

## 3. File Map

```
/
├── CLAUDE.md                          ← you are here
├── DECISIONS.md                       ← locked decisions, append-only
├── TODO.md                            ← task list, mark done immediately
├── index.html                         ← single entry point
├── css/
│   └── style.css
├── js/
│   ├── main.js                        ← app init, screen router
│   ├── constants.js                   ← ALL named constants live here, nowhere else
│   ├── storage.js                     ← all localStorage read/write, nowhere else
│   ├── screens/
│   │   ├── intro.js                   ← intro narration screen
│   │   ├── login.js                   ← account login/creation
│   │   ├── characterCreate.js         ← name + portrait selection
│   │   ├── skillTree.js               ← skill tree allocation + Lock In
│   │   ├── tournament.js              ← bracket UI and match routing
│   │   ├── match.js                   ← round loop controller
│   │   └── summary.js                 ← post-tournament/season summary
│   ├── systems/
│   │   ├── round.js                   ← round resolution (throws, skills, powerups)
│   │   ├── elo.js                     ← ELO calculation
│   │   ├── npc.js                     ← NPC strategy engine + simulation
│   │   ├── skillEngine.js             ← skill effect resolution
│   │   ├── powerupEngine.js           ← powerup inventory + activation
│   │   └── seasonEngine.js            ← season flow, NPC simulation, world write
│   └── utils/
│       ├── rng.js                     ← all randomness through one function
│       └── helpers.js
├── assets/
│   └── portraits/
│       ├── male_1.png … male_25.png    ← player + NPC portraits (match portraitId in npc_roster)
│       ├── female_1.png … female_25.png
│       └── jessie/                    ← Coach Jessie expressions (v1.0 use only)
│           └── Jessie_*.png
├── data/
│   └── npc_roster_v0_9.json           ← static NPC data (read-only at runtime)
└── docs/
    ├── SRPS_Design_Doc_v0_95.docx
    ├── SRPS_localStorage_schema_v0_95.md
    └── SRPS_section_8_3_1_starting_loadout_v0_95.md
```

**Rule:** Every localStorage access goes through `storage.js`. No other file may call `localStorage` directly.
**Rule:** Every random number goes through `rng.js`. No other file may call `Math.random()` directly. This makes the RNG mockable for testing.
**Rule:** Every named constant lives in `constants.js`. No magic numbers anywhere else.

---

## 4. Tech Stack

| Component | Technology | Notes |
|---|---|---|
| Core engine | Vanilla HTML5 + Canvas + JavaScript | Zero dependencies. No build step. No framework. |
| Styling | CSS3 | Tailwind CDN acceptable for layout utilities only |
| Persistence | Browser localStorage | All access through `storage.js` only |
| Hosting | Static files (GitHub Pages / Netlify) | No server required through v0.3 |
| Portraits & sprites | PNG pixel art | Real assets in `assets/portraits/` from v0.1. No SVG placeholders needed. |
| Audio | None | Deferred to v1.0 |

**No npm. No build pipeline. No bundler.** The entire game runs from static files. A new session should be able to open `index.html` in a browser and run.

---

## 5. Named Constants — `constants.js`

**This is the most important section for preventing playtesting pain.**
Every tunable value is a named constant. Never inline these. Changing a constant during playtesting must be a single-line change in one file.

```javascript
// constants.js — single source of truth for all tunable values

// ── Economy ──────────────────────────────────────────────────────────────────
export const STARTING_SKILL_POINTS_SEASON_1 = 15;       // One-time only, Season 1
export const TOTAL_SEASONS = 10;
export const MAX_CHARACTERS_PER_ACCOUNT = 3;
export const TOTAL_NPCS = 99;
export const TOTAL_PLAYERS = 100;                        // 99 NPCs + 1 player

// ── Node Costs ────────────────────────────────────────────────────────────────
export const NODE_COST = { L1: 5, L2: 10, L3: 15, L4: 20 };
// Prerequisite rule: L1 must precede L2, L2 must precede L3, L3 must precede L4.
// A node is legal to purchase only if its direct parent is already purchased.

// ── Consolation Bonus (skill points awarded on early season exit) ─────────────
export const CONSOLATION_BONUS_BY_LEVEL = { 1: 25, 2: 20, 3: 15, 4: 10, 5: 5 };

// ── NPC Starting Skill Budget by Tournament Tier ─────────────────────────────
// Spent once at playthrough init using random-from-legal-nodes algorithm.
// Changing these only affects new playthroughs, not saves in progress.
export const NPC_STARTING_BUDGET_BY_TIER = { 1: 5, 2: 15, 3: 35, 4: 55, 5: 75 };

// ── Match Structure ───────────────────────────────────────────────────────────
export const ROUNDS_TO_WIN_MATCH = 3;                   // First to 3 rounds wins

// ── ELO ──────────────────────────────────────────────────────────────────────
export const ELO_K_FACTOR = 32;                          // TBD — tune during playtesting
export const ELO_BASELINE = 1000;                        // Player starting ELO

// NPC starting ELO ranges by tier (from design doc Section 10.2)
export const NPC_ELO_RANGE_BY_TIER = {
  1: { min: 820,  max: 1050 },
  2: { min: 990,  max: 1250 },
  3: { min: 1170, max: 1430 },
  4: { min: 1360, max: 1620 },
  5: { min: 1630, max: 1950 },
};

// ── Neural Scan Cooldowns ─────────────────────────────────────────────────────
export const NEURAL_SCAN_COOLDOWN_MATCHES = 5;           // MIND.1.1.1
export const NEURAL_SCAN_2_COOLDOWN_MATCHES = 3;         // MIND.1.1.1.1 (replaces above)

// ── NPR System ────────────────────────────────────────────────────────────────
export const NPR_ACCUMULATION_PER_ROUND = 0.10;          // +10% per round
export const NPR_MAX = 0.90;                              // 90% read accuracy cap
export const NPR_FALSE_RESULT_CHANCE = 0.10;             // Always flat 10%, never scales
export const NPR_ADVANCED_ACCUMULATION = 0.15;           // Advanced NPR: +15%/round

// ── Powerup Slots by Root Node ────────────────────────────────────────────────
export const POWERUP_SLOTS_BY_ROOT = { MIND: 5, MYSTIC: 3, FORTUNE: 3 };
// When both trees have root nodes, use the higher value (MIND wins at 5).

// ── Powerup Starting Loadout ──────────────────────────────────────────────────
// See docs/SRPS_section_8_3_1_starting_loadout_v0_95.md for full table.
// These are the deterministic starting loads — no RNG at season start.
export const STARTING_LOADOUT = {
  MIND_only:             { Basic: 4, Advanced: 1, Legendary: 0 },
  MYSTIC_only:           { Basic: 1, Advanced: 0, Legendary: 0 },
  FORTUNE_only:          { Basic: 1, Advanced: 0, Legendary: 0 },
  MIND_MYSTIC_roots:     { Basic: 4, Advanced: 1, Legendary: 0 },
  MIND_MYSTIC_synergy:   { Basic: 3, Advanced: 1, Legendary: 1 }, // MIND.1.1.2 purchased
  MIND_FORTUNE_roots:    { Basic: 4, Advanced: 1, Legendary: 0 },
  MIND_FORTUNE_synergy:  { Basic: 4, Advanced: 1, Legendary: 0, extraSlot: 1 }, // FORTUNE.1.1.2
  MYSTIC_FORTUNE_roots:  { Basic: 1, Advanced: 0, Legendary: 0 },
  MYSTIC_FORTUNE_synergy:{ Basic: 1, Advanced: 0, Legendary: 1 }, // MYSTIC.1.1.2 purchased
};

// ── localStorage Schema Version ───────────────────────────────────────────────
export const SCHEMA_VERSION = 1;
// Increment this when making any breaking localStorage schema change.
// Migration function in storage.js checks this on every app load.
```

---

## 6. Critical Game System Rules

Read this section entirely before implementing any game system. These are the rules that are most likely to be implemented incorrectly. The design doc Section 16 is the authoritative reference — these are the most important highlights.

### 6.1 NPR System (Neural Pattern Recognition — MIND.1.1)
- NPR is a **running percentage total**, not a boolean
- Accumulates +10% per round (or +15% with Advanced NPR), starting from 0% at match start
- Resets to 0% on **two** triggers: (1) match start, (2) immediately after it fires
- On fire: two independent RNG rolls — (1) does it actually fire? (2) is result false?
- **False result chance is always flat 10%** — never scales, never reaches 0%, never affected by any skill
- Advanced NPR changes accumulation rate only — not accuracy, not false result chance
- Desperate Clarity adds +20% to the current NPR total permanently for match remainder — this bonus **does not reset on NPR fire**
- Track as a float: `nprTotal = 0.0`, increment each round, check against `Math.random()`

### 6.2 Neural Scan Cooldown (MIND.1.1.1)
- Cooldown is **per-match** (once every 5 matches), not per-round
- This counter must survive page reloads — it lives in `srps_char_{id}_progress.crossMatchState`
- Neural Scan 2.0 (MIND.1.1.1.1) **replaces** Neural Scan — same tracker, cooldown drops from 5 to 3
- Determine active cooldown value from treeState: if `MIND.1.1.1.1 === true`, use `NEURAL_SCAN_2_COOLDOWN_MATCHES`; else use `NEURAL_SCAN_COOLDOWN_MATCHES`
- One tracker for both skills. Never create a second tracker.

### 6.3 Mental Mysticism Precondition (MIND.1.1.2.2)
- Boolean flag `hasNPRFiredThisMatch` must persist **across rounds within a match** but reset at match start
- This is in-memory only — it never goes to localStorage
- Mental Mysticism button only appears when `hasNPRFiredThisMatch === true`
- This flag is separate from the NPR accumulation total — two distinct in-memory trackers

### 6.4 TML / ATML System (FORTUNE.1.1 / FORTUNE.1.1.1)
- Lucky Socks (85%) and Fingers Crossed (95%) are sequential — Fingers Crossed **replaces** Lucky Socks value, never stacks
- ATML replaces TML entirely — one cooldown tracker, one UI button
- Resolution: insert one check before rolling — "is a MIND counter skill active this round?" → failure branch = auto-loss
- `Due for a Win` (FORTUNE.1.1.2): track consecutive TML/ATML failures separately; resets on success; one-time 95% boost per match

### 6.5 Tie Resolution System (MYSTIC.1.1 family)
- `tieIsImmune` flag is set by Refuse to Lose — blocks **all** tie-altering skills when true
- Flag clears at round end, not match end
- Active skill check runs **before** passive roll — if active triggered, passive does not roll
- Alter Reality (60%) **replaces** Tweak Reality (30%) — not additive
- Third Time's the Charm: track consecutive failed conversions; resets on success; one-time 95% boost per match
- Blocked-by-Oblivious counts as a failure for Third Time's the Charm tracking

### 6.6 Phantom Memory (MIND.1.2.2.2)
- Fires **after** Neural scan passes the Mind Shield block check, but **before** result is displayed to player
- When fires: overrides result with false (incorrect) strategy read
- 1-round cooldown — not triggered by IGaH
- NPC using Phantom Memory vs player: 100% false behavioral read — random strategy shown

### 6.7 Blank Slate / Memory Wipe (MIND.1.2 / MIND.1.2.1)
- NPC strategy engines (Historian, Streaker, Mimic) need a `maskedThrows` parameter
- Blank Slate: always mask last 2 throws from those strategies
- Memory Wipe: reset NPC strategy to base — reference NPC schema for base strategy
- Clean Slate lockout: round counter decrements each round — 3 rounds, then strategies resume

### 6.8 Powerup Inventory — FIFO is law
- Powerup inventory is an **array**. Activation priority is array position (index 0 first)
- **Never sort this array.** Never deduplicate it. Multiple identical powerups are allowed.
- Each powerup has a unique `instanceId` generated at drop time — use this to identify specific instances, not the powerup name
- Overflow prompt is mandatory and blocking — game cannot proceed until player chooses replace or discard
- Probability Storm fires **before** overflow check — generate both powerups first, then check slots

### 6.9 Replacement vs Stacking Rules
These pairs replace, never stack:
- `The Cooler` (50%) → `The Freezer` upgrades it to 75% (replace, not +25%)
- `Lucky Socks` (85%) → `Fingers Crossed` replaces to 95%
- `Tweak Reality` (30%) → `Alter Reality` replaces to 60%
- `TML` → `ATML` replaces entirely (one button, one cooldown)
- `Mind Shield` (50%) → `Mind Fortress` replaces to 90%
- `Oblivious` (50%) → `Totes Oblivious` replaces to 90%
- `Neural Scan` → `Neural Scan 2.0` replaces (shared cooldown tracker)

This pair stacks additively:
- `MYSTIC.1` upgrade chance + `MIND.1.1.2.2` upgrade chance: up to +35% tier upgrade, +10% Legendary

### 6.10 Lock In Gate — Minimum Spend
- The Lock In button on the skill tree screen is **disabled** until at least one node is purchased
- Applies in two contexts: (1) pre-season allocation, (2) off-season respec
- Gate check: `Object.values(treeState).some(tree => Object.values(tree).some(v => v === true))`
- Check purchased nodes, not point balance
- See design doc Section 16.13

### 6.11 Purist Strategy Variants
- `puristRock/Paper/Scissors`: NPC always throws that sign. Set at NPC creation, never changes.
- `puristRandom`: NPC picks one throw randomly **at match start** and throws it every round for that match's duration. Re-rolls at start of each new match. **Not** at season start.

### 6.12 Starting Powerup Loadout
- Starting loadout is **fully deterministic** — no RNG at season start
- MYSTIC.1's upgrade chance bonus applies to in-season round-win drops **only** — never to starting loadout
- Loadout is determined by: (a) which root nodes are purchased, (b) whether the relevant synergy node (X.1.1.2) is purchased
- Full table: `docs/SRPS_section_8_3_1_starting_loadout_v0_95.md`
- Loadout is generated once at season start, before Tournament 1

---

## 7. localStorage Rules

Full schema: `docs/SRPS_localStorage_schema_v0_95.md`. Read it before touching storage.

### 7.1 Key Buckets
```
srps_meta                          ← schema version + account registry
srps_acct_{username}               ← credentials + character list
srps_session                       ← active login pointer (volatile)
srps_char_{id}_identity            ← name, portrait, trees (rarely written)
srps_char_{id}_progress            ← ELO, skill points, treeState, crossMatchState, powerups
srps_char_{id}_stats               ← throw stats (career + season)
srps_char_{id}_trophies            ← trophy case, HOF, seasonEloHistory
srps_char_{id}_tournament          ← active bracket + currentMatch
srps_char_{id}_world               ← all 99 NPC mutable states
```

### 7.2 Rules
- All localStorage access goes through `storage.js` only. No direct `localStorage` calls elsewhere.
- Always check `schemaVersion` in `srps_meta` before reading any other key. Run migration if stale.
- `phase` in `_progress` is the **single source of truth** for game state on reload. Read it. Never infer state from other fields.
- `currentMatch` in `_tournament` must be checked on app load. If not null, surface resume/forfeit prompt before anything else.
- The third tree is **absent from treeState entirely** — not false, not null. Absent. Its absence is what hides it from UI.
- Powerup array is FIFO. Never sort. See Section 6.8.

### 7.3 Season-End Write Order (mandatory)
This order must be followed exactly:
1. Simulate all NPC vs NPC tournament results (ELO-probability only — no round simulation)
2. Award NPC skill points; spend via random-from-legal-nodes
3. Update all NPC `currentElo` values
4. Recompute player `worldRank` from full ELO standings
5. Write `_world` bucket
6. Write `_progress` bucket (captures new worldRank)
7. Write `_trophies` bucket (append seasonEloHistory entry)
8. Write `_stats` bucket (zero season stats **after** updating career totals)

### 7.4 In-Memory Only — Never Persisted
These must never appear in localStorage:
- Current round number
- Player/NPC throw selection for current round
- NPR accumulation total (`nprTotal`)
- `hasNPRFiredThisMatch` flag
- Consecutive losses counter (Desperate Clarity)
- Consecutive TML/ATML failures counter (Due for a Win)
- Consecutive tie-conversion failures counter (Third Time's the Charm)
- `tieIsImmune` flag (Refuse to Lose)
- NPC strategy engine state (Historian/Streaker/Mimic data)
- Clean Slate lockout round counter
- Active powerup durations for round/match-scoped powerups
- All round-based skill cooldowns

**Exception:** `neuralScanMatchesSinceLastUse` in `_progress.crossMatchState` — this is the only cross-match persistent player skill state.

---

## 8. NPC System Rules

### 8.1 NPC Data Split
- **Static (never changes):** `npc_roster_v0_9.json` — id, name, portraitId, tournamentLevel, startingElo, primaryTree, secondaryTree, strategies, greeting
- **Mutable (changes each season):** `srps_char_{id}_world` — currentElo, treeState, powerupInventory

Never duplicate static fields into localStorage. Load them from the JSON file.

### 8.2 NPC vs NPC Simulation
- **ELO-probability only.** No round-by-round simulation. No skill resolution. No powerup resolution.
- Outcome probability: `P(A beats B) = 1 / (1 + 10^((EloB - EloA) / 400))`
- Roll `Math.random()` against this probability to determine winner
- Update both ELOs using standard formula after each simulated match
- This runs once per season for all NPC bracket matches across all 5 tournaments

### 8.3 NPC Skill Point Spending Algorithm
```
// Called at season end, after ELO simulation
function spendNpcPoints(npc, unspentPoints, treeState) {
  // NPCs never respec — treeState is append-only
  while (unspentPoints > 0) {
    const legal = getLegalNodes(treeState, npc.primaryTree, npc.secondaryTree)
      .filter(node => NODE_COST[getNodeLevel(node)] <= unspentPoints);

    if (legal.length === 0) break; // Can't spend remainder — this is fine

    const chosen = legal[Math.floor(Math.random() * legal.length)];
    treeState[getNodeTree(chosen)][chosen] = true;
    unspentPoints -= NODE_COST[getNodeLevel(chosen)];
  }
  return { treeState, remainingPoints: unspentPoints };
}
// Remaining points carry over to next season — NPCs accumulate across seasons.
```

Legal node rule: node is legal if (a) not yet purchased, (b) parent is purchased (or it is L1 root), (c) cost <= remaining budget.

### 8.4 NPC Initialisation at Playthrough Start
- Budget from `NPC_STARTING_BUDGET_BY_TIER` constant — never inline the values
- Run same random-from-legal-nodes algorithm
- NPCs with `secondaryTree: null` spend only in their primary tree
- T1 NPCs (budget: 5 pts) always purchase exactly their root node — this is correct and intentional
- This runs once when a new character's first season transitions from `pre_season` to `active_season`

---

## 9. Screen Flow & Phase State Machine

The `phase` field in `_progress` drives all screen routing. This is the complete valid state machine:

```
[pre_season] → player selects tree, allocates points, Lock In (≥1 node required)
     ↓
[active_season] → tournaments run sequentially; mid-season add-only spend after each win
     ↓ (win championship OR lose all paths)
[off_season] → full respec; powerups cleared; NPC simulation runs; Lock In (≥1 node required)
     ↓
[pre_season] → next season begins
     ↓ (after Season 10 off-season)
[complete] → HOF evaluation; career summary; no further seasons
```

On app load:
1. Check `srps_meta` for schema version → migrate if needed
2. Check `srps_session` → if null, show login screen
3. Load active character's `_progress`
4. Read `phase` → route to correct screen
5. If `phase === active_season`, check `_tournament.currentMatch` → if not null, show resume/forfeit prompt

---

## 10. Current Version Scope — v0.1 MVP

**In scope for v0.1:**
- Account system: login/password, 1 character per account, localStorage persistence
- Character creation: name + portrait selection (scrollable gallery, all 50 portraits)
- Tournament 1 only: Local Championship (2-round bracket, 4 players)
- Core round loop: all 4 phases functional (powerup activation placeholder, skill phase placeholder)
- NPC strategies: `random`, `puristRock`, `puristPaper`, `puristScissors`, `puristRandom`, `mirror`
- Basic bracket UI: player's path, result population
- Basic ELO tracking: player ELO updates after tournament
- Post-tournament summary screen (basic)
- SNES visual style: pixel fonts, portrait boxes, chunky UI panels
- Intro narration screen with text-crawl reveal (~50 words/minute)
- Mobile portrait layout, touch input

**Explicitly out of scope for v0.1:**
- Skill trees (v0.3)
- Powerups (v0.2 partial, v1.0 full)
- Off-season / respec (v0.2)
- Full NPC roster (v0.2)
- All NPC strategies beyond the 6 listed above (v0.2)
- Full ELO world simulation (v0.2)
- HOF, trophy system (v0.2+)
- Coach Jessie dialogue (v1.0)

**Do not implement anything outside v0.1 scope.** If you encounter a design decision that requires a v0.2+ feature, stub it out with a clear `// TODO v0.2:` comment and move on.

---

## 11. What Never To Do

These are the most likely mistakes. Read this list before writing code for any system.

**localStorage:**
- Never call `localStorage` directly outside `storage.js`
- Never sort the powerup inventory array
- Never store match-scope state in localStorage (see Section 7.4)
- Never infer `phase` from other fields — read it directly
- Never write `_world` before updating all NPC ELOs (write order matters — Section 7.3)
- Never store the third tree in treeState — it must be absent, not false

**NPC system:**
- Never run full round simulation for NPC vs NPC matches — ELO-probability only
- Never hardcode NPC starting budgets — use `NPC_STARTING_BUDGET_BY_TIER`
- Never allow NPCs to respec — their treeState is append-only
- Never let NPCs spend points mid-season — season end only

**Game systems:**
- Never make NPR false result chance scale or vary — it is always flat 10%
- Never add a second Neural Scan cooldown tracker — one tracker serves both Neural Scan and Neural Scan 2.0
- Never stack replacement-pair skills — see Section 6.9
- Never allow Lock In without at least one node purchased — see Section 6.10
- Never run starting loadout generation with RNG — it is deterministic, see Section 6.12
- Never let `puristRandom` re-roll at season start — only at match start

**Architecture:**
- Never call `Math.random()` outside `rng.js`
- Never put a magic number in game logic — define it in `constants.js`
- Never create a second source of truth for any value — pick one place and reference it

---

## 12. Session Protocol

### Starting a session
1. Read CLAUDE.md → DECISIONS.md → TODO.md (in that order)
2. Identify the current task in TODO.md
3. Read the relevant design doc section before implementing
4. State your plan before writing code for any non-trivial feature

### During a session
- Write to DECISIONS.md immediately when any decision is made
- Mark tasks done in TODO.md immediately on completion
- Use `// TODO v0.2:` comments for out-of-scope stubs
- If you are unsure about any design decision, stop and ask — do not invent

### When you discover a conflict or gap
- If the design doc contradicts DECISIONS.md: DECISIONS.md wins
- If the design doc is ambiguous: stop and ask before implementing
- If something in the existing code contradicts the schema: fix the code to match the schema

### Ending a session
- Ensure DECISIONS.md and TODO.md are fully up to date
- Leave no uncommitted decision in working memory

---

## 13. Testing Approach

For v0.1, manual testing is sufficient. For v0.2 onward, each game system needs a test harness.

Priority test areas (implement before the relevant system ships):
1. **Round resolution** — every skill interaction has edge cases; write unit tests for NPR, TML, tie resolution
2. **localStorage migration** — test that a v1 save loads correctly after schema bump
3. **NPC simulation** — verify ELO updates are symmetric and bounded
4. **Bracket generation** — verify all bracket sizes produce correct player paths
5. **Season-end write order** — verify worldRank is computed after ELO update, not before

Test stubs go in `js/tests/` — do not mix test code with game code.

---

## 14. Design Doc Quick Reference — Section Index

| Topic | Section |
|---|---|
| Season & tournament structure | 4 |
| Skill point awards | 4.3 |
| Tree selection rules + minimum spend | 4.7 |
| Round flow & phase structure | 5 |
| Skill tree definitions (all 3 trees) | 6.7, 6.8, 6.9 |
| Counter interaction matrix | 7 |
| Powerup system | 8 |
| Starting loadout (all combinations) | 8.3.1 |
| Powerup catalog (all 37) | 8.10, 8.11, 8.12 |
| NPC profiles & strategies | 10 |
| NPC behavioral equivalents | 10.7 |
| ELO mechanics | 11.2 |
| Hall of Fame | 12 |
| UI/UX specifications | 14 |
| Coach Jessie | 15 |
| Coding gotchas (all 13) | 16 |
| MVP roadmap | 18 |
