// ── Economy ──────────────────────────────────────────────────────────────────
export const STARTING_SKILL_POINTS_SEASON_1 = 15;
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
// See docs/SRPS_Design_Doc_v1_0.docx Section 8.3.1 for full table.
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
