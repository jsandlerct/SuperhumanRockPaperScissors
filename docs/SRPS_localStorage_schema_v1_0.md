# SRPS localStorage Schema
**Version:** 1.0
**Game:** Superhuman Rock Paper Scissors
**Scope:** Covers all data persisted to browser localStorage for v0.1 through v1.0.
**Migration hook:** Every breaking schema change increments `schemaVersion` in `srps_meta`. A migration function runs on every app load and upgrades older saves before the app initialises.

---

## Design Principles

1. **Targeted writes.** Data is split into buckets by write frequency. A round-end stat update must not rewrite NPC world state (39 KB). Write the smallest bucket that covers the change.
2. **Static data stays static.** `npc_roster.json` is the source of truth for all immutable NPC fields (id, name, portraitId, strategies, greeting, tournamentLevel, startingElo). localStorage only stores mutable runtime state that diverges from the static file.
3. **Schema version first.** Every read from localStorage must check `schemaVersion` before trusting any other key. If the version is stale, run migration before proceeding.
4. **Named constants, never magic numbers.** All tuning values (tier budgets, drop rates, ELO ranges) must be defined as named constants in one config file — never inlined. This makes playtesting tweaks a single-line change.
5. **FIFO array order is law.** Powerup inventories are arrays. Never sort or deduplicate them. Order encodes activation priority and must be preserved exactly.
6. **Interrupted match detection.** If the app loads and `currentMatch !== null` inside the tournament bucket, a match was interrupted. Surface a resume/forfeit prompt. Never silently discard match state.

---

## Key Registry

All keys follow the pattern `srps_{scope}_{qualifier}`.

| Key | Scope | Written When |
|---|---|---|
| `srps_meta` | Global | Schema migrations only |
| `srps_acct_{username}` | Account | Account creation; character added/removed |
| `srps_session` | Global | Login / logout / character switch |
| `srps_char_{id}_identity` | Character | Creation (name, portrait); Season 1 tree lock; Season 2 tree lock |
| `srps_char_{id}_progress` | Character | After every match; after every skill point spend |
| `srps_char_{id}_stats` | Character | After every round |
| `srps_char_{id}_trophies` | Character | After each tournament result; after season end; after any one-shot Jessie beat fires |
| `srps_char_{id}_tournament` | Character | After each match within a tournament |
| `srps_char_{id}_world` | Character | Once per season end (after NPC simulation) |

---

## Key Specifications

---

### `srps_meta`

Global registry. First key read on every app load.

```json
{
  "schemaVersion": 1,
  // Increment when any key structure changes in a breaking way.
  // Migration function checks this before any other read.

  "accountUsernames": ["jeff"]
  // List of all accounts ever created on this device.
  // Used to enumerate srps_acct_{username} keys on login screen.
}
```

---

### `srps_acct_{username}`

One key per account. Username is lowercased for key construction.

```json
{
  "username": "jeff",
  "passwordHash": "...",
  // bcrypt or SHA-256 hash. Never store plaintext.

  "characterIds": ["char_abc123", "char_def456"]
  // Ordered list. Max 3 entries (enforced at creation time, not here).
  // IDs are generated at character creation: char_ + 8 random hex chars.
}
```

---

### `srps_session`

Volatile. Written on login, cleared on logout. On cold app load, if this key exists, skip the login screen and restore directly to the active character's current state.

```json
{
  "loggedInUsername": "jeff",
  "activeCharId": "char_abc123"
  // Do NOT store credentials or tokens here.
  // This key is intentionally shallow — it's a pointer, not a payload.
}
```

---

### `srps_char_{id}_identity`

Written at character creation, then only twice more in a playthrough (Season 1 tree lock, Season 2 tree lock). Treat as append-only after creation.

```json
{
  "charId": "char_abc123",
  "name": "Alex",
  "portraitId": "male_3",
  // Format: male_N or female_N (N = 1-25). Matches npc_roster.json convention.

  "primaryTree": null,
  // null until Season 1 pre-tournament selection. Then: "MIND" | "MYSTIC" | "FORTUNE".
  // Once set, never changes for the life of this character.

  "secondaryTree": null,
  // null until Season 2 pre-tournament selection. Then: "MIND" | "MYSTIC" | "FORTUNE".
  // Must differ from primaryTree. Once set, never changes.
  // The third (unchosen) tree is simply absent from this schema — never store it.
  // Its absence is the authoritative signal to hide it from the UI entirely.

  "createdAt": 1745000000000
  // Unix timestamp ms. Used for display only (career screen).
}
```

---

### `srps_char_{id}_progress`

The most frequently written character bucket. Written after every match and every skill point spend.

```json
{
  "charId": "char_abc123",

  "currentSeason": 3,

  "phase": "active_season",
  // Enum: "pre_season" | "active_season" | "off_season" | "complete"
  // "pre_season"    → tree selection / skill point allocation screen
  //                   Lock In button disabled until at least one node purchased.
  //                   A no-node state at Tournament 1 start is impossible by design.
  // "active_season" → tournaments are live; mid-season add-only spend rule applies
  // "off_season"    → full respec available; powerups cleared; NPC simulation run
  //                   Lock In button disabled until at least one node purchased.
  // "complete"      → 10-season arc finished; HOF evaluation done
  //
  // This is the app's primary resume signal. On load, read phase to know
  // exactly which screen to show. Never infer game state from other fields.

  "currentElo": 1200,
  "peakElo": 1250,
  // peakElo is a high-water mark — only ever increases. Never decremented.

  "worldRank": 42,
  // Rank among all 100 players (1 = best). Recomputed after NPC season simulation.
  // Write order: simulate NPC matches → update all ELOs → recompute rank → write here.

  "unspentSkillPoints": 5,
  // Points available to spend right now. Decremented on node purchase.
  // During off_season: may be large (full refund + consolation bonus).
  // During active_season: only increases (tournament awards added here).

  "totalSkillPointsEarned": 85,
  // Lifetime total for career stats display. Only ever increases.

  "treeState": {
    // Only the two chosen trees appear here. The third tree is absent.
    // All 15 nodes listed explicitly per tree for O(1) lookup.
    // Node IDs use the canonical dot-notation from the design doc.
    "MIND": {
      "MIND.1":       true,   // L1 Root
      "MIND.1.1":     true,   // L2 Offense
      "MIND.1.2":     false,  // L2 Defense
      "MIND.1.1.1":   false,  // L3 Active Offense
      "MIND.1.1.2":   false,  // L3 Passive Synergy
      "MIND.1.2.1":   false,  // L3 Active Defense
      "MIND.1.2.2":   false,  // L3 Passive Soft Counter
      "MIND.1.1.1.1": false,  // L4 Powerful Active Offense
      "MIND.1.1.1.2": false,  // L4 Powerful Passive Offense
      "MIND.1.1.2.1": false,  // L4 Synergy Active
      "MIND.1.1.2.2": false,  // L4 Synergy Passive
      "MIND.1.2.1.1": false,  // L4 Powerful Active Defense
      "MIND.1.2.1.2": false,  // L4 Powerful Passive Defense
      "MIND.1.2.2.1": false,  // L4 Hard Counter Active
      "MIND.1.2.2.2": false   // L4 Hard Counter Passive
    },
    "FORTUNE": {
      "FORTUNE.1":       false,
      "FORTUNE.1.1":     false,
      "FORTUNE.1.2":     false,
      "FORTUNE.1.1.1":   false,
      "FORTUNE.1.1.2":   false,
      "FORTUNE.1.2.1":   false,
      "FORTUNE.1.2.2":   false,
      "FORTUNE.1.1.1.1": false,
      "FORTUNE.1.1.1.2": false,
      "FORTUNE.1.1.2.1": false,
      "FORTUNE.1.1.2.2": false,
      "FORTUNE.1.2.1.1": false,
      "FORTUNE.1.2.1.2": false,
      "FORTUNE.1.2.2.1": false,
      "FORTUNE.1.2.2.2": false
    }
  },

  "crossMatchState": {
    // Skills whose cooldowns span multiple matches (not rounds).
    // Must survive page reload — this is why they live here, not in match memory.
    //
    // Neural Scan: cooldown is "once every 5 matches". Count matches since last use.
    // Triggers when value reaches cooldownValue (5 for Neural Scan, 3 for NS 2.0).
    // When Neural Scan 2.0 is purchased it REPLACES Neural Scan — same tracker.
    "neuralScanMatchesSinceLastUse": 0
    // Only one tracker needed: Neural Scan and Neural Scan 2.0 share a cooldown.
    // The active cooldownValue (5 vs 3) is determined by whether MIND.1.1.1.1 is true.
  },

  "powerupInventory": [
    // Array of powerup instances. FIFO order is activation priority — never sort.
    // Multiple identical powerups are allowed. instanceId disambiguates them.
    // instanceId generated at drop time: "pu_" + 8 random hex chars.
    // Cleared to [] at every off_season start.
    {
      "instanceId": "pu_a1b2c3d4",
      "name": "Espresso Shot",
      "tier": "Basic",
      // Enum: "Basic" | "Advanced" | "Legendary"
      "tree": "MIND",
      // Source tree. Used for thematic linking and Jessie powerup filtering.
      "scope": "round"
      // Enum: "round" | "match" | "tournament" | "season"
      // Stored here so the UI can display duration without re-deriving from name.
    }
  ]
}
```

---

### `srps_char_{id}_stats`

Written after every round. Career scope never resets. Season scope resets to zero at off-season start (after career totals are updated — always update career first, then zero season).

```json
{
  "career": {
    "rock": 234,
    "paper": 198,
    "scissors": 201,
    // Raw throw counts. Percentages are computed at display time, never stored.

    "rockWins": 134,
    "paperWins": 112,
    "scissorsWins": 98,
    // Win counts per throw type. Used for "win rate per throw" on profile screen.

    "totalMatches": 47,
    "matchWins": 29,
    "matchLosses": 18,
    // matchWins + matchLosses === totalMatches always. Assert this on write.

    "tournamentsEntered": 12,
    "tournamentsWon": 1,
    "runnerUpFinishes": 3,
    "deepestTournamentReached": 5
    // deepestTournamentReached: highest tournamentLevel ever reached (1-5). High-water mark.
  },

  "season": {
    // Same throw/win fields as career, scoped to current season only.
    // Reset to all-zeros at off_season start (after career snapshot is written).
    "rock": 45,
    "paper": 38,
    "scissors": 41,
    "rockWins": 28,
    "paperWins": 20,
    "scissorsWins": 22
    // No match/tournament counts here — those live in the trophies bucket.
  }

  // NOTE: Match-scope stats (current-match throw history, current streak,
  // Streaker/Historian/Mimic/Counter data) are IN-MEMORY ONLY.
  // They reset at every match start and are never persisted.
  // Do not add match-scope fields here — they do not belong in localStorage.
}
```

---

### `srps_char_{id}_trophies`

Written after each tournament result, at season end, and whenever any one-shot Jessie beat fires.
Contains all data needed for HOF evaluation and Jessie beat tracking.

```json
{
  "hofStatus": false,
  // Set to true at end of Season 10 if HOF eligibility conditions are met.
  // Never decremented.

  "hofInductionSeason": null,
  // Integer 1-10, or null. Set alongside hofStatus.

  "seasonEloHistory": [
    // One entry per completed season. Required for HOF cumulative ranking evaluation.
    // Stored here (not recomputed from world state) because NPC ELOs drift
    // over seasons and past world ranks cannot be reconstructed retroactively.
    { "season": 1, "endElo": 1050, "worldRank": 67 },
    { "season": 2, "endElo": 1150, "worldRank": 45 }
    // After 10 seasons, this array has exactly 10 entries.
  ],

  "trophies": [
    // One entry per trophy earned. Multiple trophies per tournament are possible
    // (winner + runnerUp are both trophy-earning results).
    {
      "tournamentLevel": 1,
      // 1-5 (Local through World Championship)

      "result": "winner",
      // Enum: "winner" | "runnerUp"
      // runnerUp trophies are silver variants — TBD in art direction per design doc.

      "season": 1
      // Season in which this trophy was earned. Display only.
    }
  ],

  "jessieOneShots": [],
  // Array of beat IDs that have already fired (e.g. ["T-01", "T-02", "M-01"]).
  // Before firing any one-shot beat: check includes(beatId). If true, skip.
  // After firing: push beatId and call saveTrophies() immediately.
  // When Jessie toggle is OFF: do NOT push IDs. Beats will fire when re-enabled.
  // M-04 and M-06 are repeatable — never add them to this array.

  "jessieSeasonCheckInHistory": []
  // Array of used M-12 line indices (integers 0-7).
  // Before firing M-12: select random index NOT in this array.
  // After firing: push the used index and call saveTrophies().
  // If all 8 indices are in the array: reset to [] and start again.
}
```

---

### `srps_char_{id}_tournament`

Written after every match within an active tournament. The bracket here is the player's path only (v0.1 through v1.0 — full bracket is post-v1.0).

```json
{
  "currentTournamentLevel": 2,
  // 1-5. Null if no tournament is in progress (between tournaments or off-season).

  "tournamentStatus": "in_progress",
  // Enum: "not_started" | "in_progress" | "complete"

  "bracket": {
    // Player's path through the bracket only.
    // Rounds are indexed 1-based. Results populate as matches complete.
    "rounds": [
      {
        "round": 1,
        "matches": [
          {
            "p1": "player",
            // "player" literal or an NPC id string (e.g. "npc_023")
            "p2": "npc_023",
            "result": "p1_won",
            // Enum: "p1_won" | "p2_won" | null (not yet played)
            "score": [3, 1]
            // [p1_rounds_won, p2_rounds_won]. Null until match is complete.
          },
          {
            "p1": "npc_017",
            "p2": "npc_045",
            "result": "p1_won",
            "score": [3, 2]
            // NPC vs NPC results are populated after ELO-probability resolution,
            // not from a full match simulation. See NPC Simulation section below.
          }
        ]
      }
    ]
  },

  "currentMatch": null
  // null when between matches (safe state).
  // Non-null when a match is actively in progress or was interrupted.
  // On app load: if currentMatch !== null, surface resume/forfeit prompt.
  // For v0.1: forfeit is acceptable (no mid-match resume required).
  //
  // Structure when active:
  // {
  //   "opponentId": "npc_023",
  //   "matchType": "regular",      // "regular" | "finals"
  //   "playerRoundsWon": 2,
  //   "opponentRoundsWon": 1,
  //   "roundHistory": [
  //     { "round": 1, "playerThrow": "rock", "opponentThrow": "scissors", "winner": "player" },
  //     { "round": 2, "playerThrow": "paper", "opponentThrow": "paper",   "winner": "tie" },
  //     { "round": 3, "playerThrow": "scissors","opponentThrow": "rock",  "winner": "opponent" }
  //   ]
  //   // roundHistory is append-only. Ties are recorded and replayed from Phase 1
  //   // unless Refuse to Lose immune tie — in which case winner is "player" (tie-converted).
  // }
}
```

---

### `srps_char_{id}_world`

The largest bucket. Written **once per season**, after NPC simulation completes at season end. Contains only mutable NPC runtime state — all static fields remain in `npc_roster.json`.

```json
{
  "season": 3,
  // The season this world state reflects. Sanity check on load:
  // if world.season !== progress.currentSeason, world state is stale — re-simulate.

  "npcs": {
    // Keyed by NPC id. One entry per NPC (all 99).
    "npc_001": {
      "currentElo": 855,
      // Live ELO. Starts at npc_roster.json startingElo at playthrough init,
      // then diverges as season simulation runs.

      "treeState": {
        // Same structure as player treeState. Only the NPC's trees appear.
        // NPCs with secondaryTree: null have only one tree here.
        // Nodes purchased via random-from-legal-nodes rule at:
        //   (a) Playthrough init — NPC_STARTING_BUDGET_BY_TIER points spent
        //   (b) Season end — accumulated tournament earnings spent
        "FORTUNE": {
          "FORTUNE.1":       true,
          "FORTUNE.1.1":     false,
          "FORTUNE.1.2":     false,
          "FORTUNE.1.1.1":   false,
          "FORTUNE.1.1.2":   false,
          "FORTUNE.1.2.1":   false,
          "FORTUNE.1.2.2":   false,
          "FORTUNE.1.1.1.1": false,
          "FORTUNE.1.1.1.2": false,
          "FORTUNE.1.1.2.1": false,
          "FORTUNE.1.1.2.2": false,
          "FORTUNE.1.2.1.1": false,
          "FORTUNE.1.2.1.2": false,
          "FORTUNE.1.2.2.1": false,
          "FORTUNE.1.2.2.2": false
        }
      },

      "powerupInventory": []
      // Same structure as player powerupInventory.
      // Cleared each season. Seeded by tree root node at season start.
      // Grows via normal drop/reward during player-facing matches.
      // For NPC vs NPC simulated matches: no powerup simulation (ELO-only).
    },

    "npc_099": {
      "currentElo": 1920,
      "treeState": {
        "MYSTIC": { "MYSTIC.1": true, "...": false },
        "FORTUNE": { "FORTUNE.1": true, "...": false }
      },
      "powerupInventory": []
    }
  }
}
```

---

## NPC Initialisation at Playthrough Start

When a new character's first season begins (phase transitions from `pre_season` to `active_season` for Season 1), the world bucket must be fully initialised before any tournament runs.

**Algorithm:**

```
NPC_STARTING_BUDGET_BY_TIER = { 1: 5, 2: 15, 3: 35, 4: 55, 5: 75 }
// These are named constants. Define in one config file. Never inline.

For each NPC in npc_roster.json:
  budget = NPC_STARTING_BUDGET_BY_TIER[npc.tournamentLevel]
  treeState = initialise all nodes false for npc.primaryTree
               (and npc.secondaryTree if not null)

  While budget > 0:
    legal = all nodes where:
      (a) not yet purchased
      (b) parent node is purchased (or node is L1 root, which has no parent)
      (c) node cost <= remaining budget

    If legal is empty: break

    Pick one node at random from legal
    Mark it purchased in treeState
    Subtract node cost from budget

  Write result to world["npcs"][npc.id]
```

**Notes:**
- NPCs with `secondaryTree: null` draw legal nodes only from their primary tree.
- NPCs with both trees draw from the union of both trees' legal nodes.
- Prerequisite rule: L2 requires L1, L3 requires its L2 parent, L4 requires its L3 parent.
- The root node (L1, cost 5 pts) is always the first legal node. All T1 NPCs (budget: 5 pts) will always and only purchase their root node. This is correct and intentional.

---

## NPC Skill Point Accumulation (Season End)

At the end of each season, before writing the world bucket:

```
For each NPC:
  Determine tournament results from ELO-probability simulation
  Award skill points per the same winner/runner-up table as the player (Section 4.3)

  While unspentPoints > 0:
    Run same random-from-legal-nodes algorithm as above
    (NPCs never respec — treeState is append-only)

  Update currentElo based on simulated tournament results
```

NPC vs NPC match outcomes are determined by ELO win probability only — no round-by-round simulation, no skill or powerup resolution.

---

## NPC Simulation Write Order (Season End)

This order is mandatory. Writing in the wrong order can corrupt rank or HOF data.

```
1. Simulate all NPC vs NPC tournament results (ELO-probability)
2. Award NPC skill points; spend via random-from-legal-nodes
3. Update all NPC currentElo values
4. Recompute player worldRank from full ELO standings (player + all 99 NPCs)
5. Write world bucket  (srps_char_{id}_world)
6. Write progress bucket (srps_char_{id}_progress) — captures new worldRank
7. Write trophies bucket (srps_char_{id}_trophies) — append seasonEloHistory entry
8. Write stats bucket (srps_char_{id}_stats) — zero season stats after career update
```

---

## Jessie Beat Write Trigger

`_trophies` is written in one additional context beyond the season-end sequence above:

**Whenever any one-shot Jessie beat fires:**
1. Push the beat ID to `jessieOneShots` (or update `jessieSeasonCheckInHistory` for M-12)
2. Call `saveTrophies()` immediately — do not wait for end of match or season

This ensures Jessie beat state survives page reloads during an active session.

---

## Schema Migration Pattern

Every app load must run this before any other localStorage access:

```javascript
function migrateIfNeeded() {
  const meta = JSON.parse(localStorage.getItem('srps_meta') || '{}');
  const currentVersion = meta.schemaVersion || 0;

  if (currentVersion < 1) {
    // v0 to v1: initial schema. Nothing to migrate — fresh install.
    meta.schemaVersion = 1;
    meta.accountUsernames = meta.accountUsernames || [];
    localStorage.setItem('srps_meta', JSON.stringify(meta));
  }

  // When adding Jessie fields to existing saves (schema v1 to v2):
  // if (currentVersion < 2) {
  //   // For each existing character, load _trophies and add missing Jessie fields
  //   // jessieOneShots: [], jessieSeasonCheckInHistory: []
  //   meta.schemaVersion = 2;
  //   localStorage.setItem('srps_meta', JSON.stringify(meta));
  // }
}
```

Add a new numbered block for every breaking change. Never modify an existing block.

---

## In-Memory-Only State (Never Persisted)

The following are reset on every match start and must never appear in localStorage.

| State | Reset When | Used By |
|---|---|---|
| Current round number | Match start | Phase controller |
| Player's current throw selection | Round start | Resolution |
| NPC's current throw (pre-reveal) | Round start | Resolution |
| NPR accumulation total (%) | Match start + post-fire | NPR system |
| `hasNPRFiredThisMatch` flag | Match start | Mental Mysticism precondition |
| Consecutive losses counter | Match start | Desperate Clarity |
| Consecutive TML/ATML failures | Match start | Due for a Win |
| Consecutive tie-conversion failures | Match start | Third Time's the Charm |
| `tieIsImmune` flag | Round end | Refuse to Lose |
| NPC Historian/Streaker/Mimic data | Match start | NPC strategy engines |
| Clean Slate lockout round counter | Match start | Clean Slate |
| Active powerup durations (round/match) | Appropriate expiry | Powerup system |
| All active skill cooldowns (round-based) | Match start | Skill system |

**Exception:** `neuralScanMatchesSinceLastUse` survives match boundaries — it is the only cross-match persistent player skill state, and it lives in `_progress.crossMatchState` for exactly this reason.
