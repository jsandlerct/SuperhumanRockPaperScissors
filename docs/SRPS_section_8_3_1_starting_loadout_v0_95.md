## 8.3.1 Season Starting Loadout — All Tree Combinations

This section is the authoritative reference for starting powerup state at the beginning of every season. It supersedes any implicit loadout rules in the individual root node descriptions in Sections 6.7–6.9.

**Three rules govern all loadout states:**

- Starting loadout is fully deterministic. No randomness occurs at season start. MYSTIC.1's upgrade chance bonus applies to in-season round-win drops only — never to starting loadout composition.
- All starting powerups are drawn from the combined pool of every tree in which the player has at least one root node purchased. A MIND+FORTUNE player draws Basic powerups from the MIND or FORTUNE pool equally.
- Synergy nodes (X.1.1.2) are the sole mechanism for modifying starting loadout beyond the root node baseline. The table below shows both the root-only state and the with-synergy state for each combination.

---

### Single Tree (Season 1 only — secondary tree not yet chosen)

| Root Node Purchased | Slots | Starting Loadout | In-Season Drop Modifiers |
|---|---|---|---|
| MIND.1 | 5 | 4 Basic + 1 Advanced | — |
| MYSTIC.1 | 3 | 1 Basic | +15% one-tier-higher chance; +5% Legendary chance |
| FORTUNE.1 | 3 | 1 Basic | 2× drop rate per round |

*Season 1 note: The player must purchase at least one node (minimum: their root node at 5 pts) before the Lock In button is enabled and Tournament 1 can begin. This is enforced by the UI gate (see Section 16.13 of the design doc). A no-root-node state is therefore impossible at season start — the baseline (no node purchased) state does not exist in practice and is not represented here.*

---

### Two Trees — Root Nodes Only (Season 2+, synergy node not yet reached)

| Trees | Slots | Starting Loadout | In-Season Drop Modifiers |
|---|---|---|---|
| MIND.1 + MYSTIC.1 | 5 | 4 Basic + 1 Advanced | +15% one-tier-higher chance; +5% Legendary chance |
| MIND.1 + FORTUNE.1 | 5 | 4 Basic + 1 Advanced | 2× drop rate per round |
| MYSTIC.1 + FORTUNE.1 | 3 | 1 Basic | +15% one-tier-higher chance; +5% Legendary chance; 2× drop rate per round |

*Conflict resolution — MIND.1 vs MYSTIC.1: When both roots are purchased, MIND.1's loadout (4B+1A) applies as the starting state. MYSTIC.1's bonus is a drop modifier only and has no effect on the deterministic season-start loadout. The player receives MYSTIC.1's upgrade chance benefit on all in-season drops from Round 1 onward.*

---

### Two Trees — With Relevant Synergy Node Purchased

Each tree combination has exactly one synergy node (X.1.1.2) that can modify the starting loadout. Purchasing it upgrades the starting state as shown. The synergy node requires its L2 parent, which requires L1 — minimum 30 points invested in that chain to reach it.

| Trees + Synergy Node | Slots | Starting Loadout | In-Season Drop Modifiers |
|---|---|---|---|
| MIND.1 + MYSTIC.1 + MIND.1.1.2 (Desperate Clarity) | 5 | 3 Basic + 1 Advanced + 1 Legendary | +15% one-tier-higher chance; +5% Legendary chance |
| MIND.1 + FORTUNE.1 + FORTUNE.1.1.2 (Due for a Win) | 6 | 4 Basic + 1 Advanced + 1 empty slot | 2× drop rate per round |
| MYSTIC.1 + FORTUNE.1 + MYSTIC.1.1.2 (Third Time's the Charm) | 3 | 1 Basic + 1 Legendary | +15% one-tier-higher chance; +5% Legendary chance; 2× drop rate per round |

*MIND+FORTUNE slot note: The 6th slot granted by FORTUNE.1.1.2 starts each season empty — it is a capacity bonus, not a powerup bonus. The starting loadout remains 4B+1A across those 5 filled slots. The empty 6th slot fills via normal in-season drops.*

*MYSTIC+FORTUNE loadout note: This combination has the smallest slot count (3) but the most aggressive drop modifiers — both the tier-upgrade chance and the 2× rate apply simultaneously. The 1 Legendary in the starting loadout (from MYSTIC.1.1.2 synergy) combined with double drop rate makes this the highest-variance early-season configuration.*

---

### Powerup Pool Source by Combination

| Trees | Starting Loadout Drawn From |
|---|---|
| MIND only | MIND pool |
| MYSTIC only | MYSTIC pool |
| FORTUNE only | FORTUNE pool |
| MIND + MYSTIC | MIND + MYSTIC pools combined |
| MIND + FORTUNE | MIND + FORTUNE pools combined |
| MYSTIC + FORTUNE | MYSTIC + FORTUNE pools combined |

The Universal powerup (Changed My Mind) is available in all pools regardless of tree. Tree-specific powerups are only available to players with at least one point in that tree — this applies to starting loadout generation and in-season drops equally.

*Jessie powerups (player-only) are excluded from starting loadout generation. They may only appear via in-season drops. NPCs never receive Jessie powerups under any circumstances.*

---

### Implementation Notes

| *Starting loadout generation runs once at season initialisation, before Tournament 1. It is deterministic — use the table above directly, not a probability roll. MYSTIC.1's upgrade chance is a runtime drop modifier applied to the drop resolution system, not a loadout constructor parameter. The two systems must not be conflated. Synergy node check: at season start, read treeState to determine which synergy node (if any) is purchased, then select the correct table row. This is a single conditional lookup — not a cascading calculation.* |
|---|
