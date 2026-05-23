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

// ── Tournament Configuration ──────────────────────────────────────────────────
export const TOURNAMENT_CONFIG = [
  { tier: 1, name: 'Local Championship',       players: 4,  roundNames: ['Semifinal', 'Final'] },
  { tier: 2, name: 'Regional Championship',    players: 8,  roundNames: ['Quarterfinal', 'Semifinal', 'Final'] },
  { tier: 3, name: 'National Championship',    players: 16, roundNames: ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'] },
  { tier: 4, name: 'Continental Championship', players: 32, roundNames: ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'] },
  { tier: 5, name: 'World Championship',       players: 64, roundNames: ['Round of 64', 'Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'] },
];

// ── Match Structure (extended) ────────────────────────────────────────────────
export const ROUNDS_TO_WIN_MATCH_FINALS = 4; // Finals are Best of 7 (first to 4)

// ── Skill Point Awards ────────────────────────────────────────────────────────
export const SKILL_POINTS_AWARD = {
  1: { winner: 10, runnerUp:  5 },
  2: { winner: 15, runnerUp:  7 },
  3: { winner: 20, runnerUp: 10 },
  4: { winner: 25, runnerUp: 12 },
  5: { winner: 30, runnerUp: 15 },
};

// ── Trophy Configuration (Section 13) ────────────────────────────────────────
// One entry per earnable trophy. id = `t{tier}_{place}`.
// Unearned trophies are shown as silhouettes in the trophy case.
export const TROPHY_CONFIG = [
  { id: 't1_1st', tier: 1, place: '1st', label: 'LOCAL CHAMPION',        asset: 'assets/trophies/trophy_local_1st_place.png' },
  { id: 't1_2nd', tier: 1, place: '2nd', label: 'LOCAL RUNNER-UP',       asset: 'assets/trophies/trophy_local_2nd_medal.png' },
  { id: 't2_1st', tier: 2, place: '1st', label: 'REGIONAL CHAMPION',     asset: 'assets/trophies/trophy_regional_1st_place.png' },
  { id: 't2_2nd', tier: 2, place: '2nd', label: 'REGIONAL RUNNER-UP',    asset: 'assets/trophies/trophy_regional_2nd_place.png' },
  { id: 't3_1st', tier: 3, place: '1st', label: 'NATIONAL CHAMPION',     asset: 'assets/trophies/trophy_national_1st_place.png' },
  { id: 't3_2nd', tier: 3, place: '2nd', label: 'NATIONAL RUNNER-UP',    asset: 'assets/trophies/trophy_national_2nd_place.png' },
  { id: 't4_1st', tier: 4, place: '1st', label: 'CONTINENTAL CHAMPION',  asset: 'assets/trophies/trophy_continental_1st_place.png' },
  { id: 't4_2nd', tier: 4, place: '2nd', label: 'CONTINENTAL RUNNER-UP', asset: 'assets/trophies/trophy_continental_2nd_place.png' },
  { id: 't5_1st', tier: 5, place: '1st', label: 'WORLD CHAMPION',        asset: 'assets/trophies/trophy_world_1st_place.png' },
  { id: 't5_2nd', tier: 5, place: '2nd', label: 'WORLD RUNNER-UP',       asset: 'assets/trophies/trophy_world_2nd_place.png' },
];

// ── Powerup Icons ─────────────────────────────────────────────────────────────
// Maps canonical powerup name (as stored in inventory entries) → icon asset path.
export const POWERUP_ICONS = {
  'A Word From Your Coach':        'assets/powerups/a_word_from_your_coach.png',
  'Carolina Reaper':               'assets/powerups/carolina_reaper.png',
  'Changed My Mind':               'assets/powerups/Changed_my_mind.png',
  'Clockwork Orange':              'assets/powerups/clockwork_orange.png',
  'Comically Large Fortune Cookie':'assets/powerups/comically_large_fortune_cookie.png',
  'Cosmic Insurance Policy':       'assets/powerups/cosmic_insurance_policy.png',
  'Courtside with Jessie':         'assets/powerups/courtside_with_jessie.png',
  'Cuckoo Clock':                  'assets/powerups/cuckoo_clock.png',
  'Dead Giveaway':                 'assets/powerups/dead_giveaway.png',
  'Dizzy Spell':                   'assets/powerups/dizzy_spell.png',
  'Espresso Shot':                 'assets/powerups/espresso_shot.png',
  'Fait Accompli':                 'assets/powerups/fait_accompli.png',
  'Focus Group':                   'assets/powerups/focus_group.png',
  'Focused Focus Group':           'assets/powerups/focused_focus_group.png',
  'Fortune Cookie':                'assets/powerups/fortune_cookie.png',
  'Giant Fortune Cookie':          'assets/powerups/giant_fortune_cookie.png',
  'Ghost Pepper':                  'assets/powerups/ghost_pepper.png',
  'Hiccup Potion':                 'assets/powerups/hiccup_potion.png',
  'Hot Sauce':                     'assets/powerups/hot_sauce.png',
  'Jessie Did Her Homework':       'assets/powerups/jessie_did_her_homework.png',
  'Jonesing to Help':              'assets/powerups/jonesing_to_help.png',
  'Lucky Penny':                   'assets/powerups/lucky_penny.png',
  'Molasses':                      'assets/powerups/molasses.png',
  'Mystic Pizza':                  'assets/powerups/mystic_pizza.png',
  "Pandora's Box":                 'assets/powerups/pandora\'s_box.png',
  'Padlock':                       'assets/powerups/padlock.png',
  'Project Hail Mary':             'assets/powerups/Project_hail_mary.png',
  'Protein Shake':                 'assets/powerups/protein_shake.png',
  'Reading Glasses':               'assets/powerups/reading_glasses.png',
  'Research Notes':                'assets/powerups/research_notes.png',
  "Schrödinger's Amulet":          "assets/powerups/schrodinger's_amulet.png",
  'Smart Glasses':                 'assets/powerups/smart_glasses.png',
  'Tabula Rasa':                   'assets/powerups/tabula_rasa.png',
  'The Ballad of Jessie Jones':    'assets/powerups/the_ballad_of_jessie_jones.png',
  'The Jessie Special':            'assets/powerups/the_jessie_special.png',
  "Three's Company":               "assets/powerups/three's_company.png",
  'Wish Upon a Star':              'assets/powerups/wish_upon_a_star.png',
};

// ── Powerup Catalog (Section 8.9 / 8.10 / 8.11 / 8.12) ────────────────────────
// All 37 powerups (1 Universal + 12 MIND + 12 MYSTIC + 12 FORTUNE).
// tree: 'UNIVERSAL' | 'MIND' | 'MYSTIC' | 'FORTUNE'
// tier: 'Basic' | 'Advanced' | 'Legendary'
// scope: 'round' | 'match' | 'tournament' | 'season'
// jessieOnly: powerup is player-only (NPCs cannot receive it).
export const POWERUP_CATALOG = [
  // ── Universal ──────────────────────────────────────────────────────────────
  { name: 'Changed My Mind', tier: 'Basic', scope: 'round', tree: 'UNIVERSAL', jessieOnly: false, activationPhase: 'gut_check',
    effect: 'Grants the ability to change your throw during the Gut Check phase. One-time use per round.' },

  // ── MIND — Basic (4) ───────────────────────────────────────────────────────
  { name: 'Espresso Shot',   tier: 'Basic', scope: 'round', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: 'Play two throws this round — the better outcome counts.' },
  { name: 'Focus Group',     tier: 'Basic', scope: 'match', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: 'Each round during Gut Check the crowd hints at the NPC\'s initial throw with 65% accuracy. If the NPC changes throw, tough luck.' },
  { name: 'Research Notes',  tier: 'Basic', scope: 'round', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: 'Reveals the NPC\'s cumulative throw distribution across all matches this season. Historical only.' },
  { name: 'Protein Shake',   tier: 'Basic', scope: 'round', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: 'Grants ability to change throw during Gut Check. If you change and win, earn 1 bonus Basic powerup drop.' },

  // ── MIND — Advanced (4) ────────────────────────────────────────────────────
  { name: 'Focused Focus Group',  tier: 'Advanced', scope: 'match', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: 'Upgraded Focus Group — 80% accurate. Same mechanic.' },
  { name: 'A Word From Your Coach', tier: 'Advanced', scope: 'match', tree: 'MIND', jessieOnly: true,  activationPhase: 'either',
    effect: 'Each round one throw the NPC is definitely NOT throwing is eliminated. Player may always change throw. Jessie powerup — player only.' },
  { name: 'Dead Giveaway',        tier: 'Advanced', scope: 'round', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: 'Reveals NPC\'s initial throw with 100% accuracy. Player may change throw. NPC is aware and may attempt to change.' },
  { name: 'Reading Glasses',      tier: 'Advanced', scope: 'tournament', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: '15% chance per round of catching a tell. NPC unaware. Initial throw only.' },

  // ── MIND — Legendary (4) ───────────────────────────────────────────────────
  { name: 'The Jessie Special',   tier: 'Legendary', scope: 'round', tree: 'MIND', jessieOnly: true,  activationPhase: 'either',
    effect: 'You win this round. Jessie saw something nobody else could see. Jessie powerup — player only.' },
  { name: 'Jessie Did Her Homework', tier: 'Legendary', scope: 'match', tree: 'MIND', jessieOnly: true,  activationPhase: 'either',
    effect: 'Pre-match: Jessie reveals NPC\'s current behavioral strategy with 99% accuracy. Jessie powerup — player only.' },
  { name: 'Courtside with Jessie',tier: 'Legendary', scope: 'tournament', tree: 'MIND', jessieOnly: true,  activationPhase: 'either',
    effect: '40% chance per round Jessie spots a tell. Jessie powerup — player only.' },
  { name: 'Smart Glasses',        tier: 'Legendary', scope: 'season', tree: 'MIND', jessieOnly: false, activationPhase: 'either',
    effect: '20% chance per round of catching a tell, all season. Always active.' },

  // ── MYSTIC — Basic (4) ─────────────────────────────────────────────────────
  { name: 'Mystic Pizza',         tier: 'Basic', scope: 'round', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'If you lose: round replays from Throw Selection. If you win or tie: fizzles.' },
  { name: 'Dizzy Spell',          tier: 'Basic', scope: 'round', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'NPC throws randomly this round and cannot change their throw during Gut Check.' },
  { name: "Schrödinger's Amulet", tier: 'Basic', scope: 'round', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'gut_check',
    effect: 'If you change throw, both your original and new throw exist — if either beats the NPC, you win.' },
  { name: 'Hiccup Potion',        tier: 'Basic', scope: 'match', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'Every third round this match, the NPC throws randomly regardless of strategy.' },

  // ── MYSTIC — Advanced (4) ──────────────────────────────────────────────────
  { name: 'Clockwork Orange',     tier: 'Advanced', scope: 'round', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'Reset all your active skill cooldowns to ready and add 1 round to all opponent active skill cooldowns.' },
  { name: 'Tabula Rasa',          tier: 'Advanced', scope: 'match', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'NPC plays completely randomly for the entire match — no adaptation, no active skills, no powerups.' },
  { name: 'Molasses',             tier: 'Advanced', scope: 'match', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'All opponent active skill cooldowns increased by 1 round, including any already cooling.' },
  { name: 'Padlock',              tier: 'Advanced', scope: 'tournament', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'Opponents cannot activate any powerups during the first 3 rounds of every match.' },

  // ── MYSTIC — Legendary (4) ─────────────────────────────────────────────────
  { name: 'Fait Accompli',        tier: 'Legendary', scope: 'round', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'Activate before throw reveal. You win this round. Reality had no choice.' },
  { name: 'Cosmic Insurance Policy', tier: 'Legendary', scope: 'match', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'Reset match to round 1. You remember everything. Opponent remembers nothing.' },
  { name: 'Cuckoo Clock',         tier: 'Legendary', scope: 'tournament', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
    effect: 'At the start of round 3 of every match this tournament, Clockwork Orange fires automatically.' },
  { name: 'Jonesing to Help',     tier: 'Legendary', scope: 'season', tree: 'MYSTIC', jessieOnly: true,  activationPhase: 'either',
    effect: 'At the start of every match this season, Jessie delivers 1 random Advanced powerup. Jessie powerup — player only.' },

  // ── FORTUNE — Basic (4) ────────────────────────────────────────────────────
  { name: 'Fortune Cookie',       tier: 'Basic', scope: 'round', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Change throw to a random selection. If you win, earn 2 Basic powerups.' },
  { name: "Pandora's Box",        tier: 'Basic', scope: 'round', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Both players throw randomly. If you win, all your active skill cooldowns reset to ready.' },
  { name: 'Project Hail Mary',    tier: 'Basic', scope: 'round', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Disables all your other powerups and active skills this round. Both players throw randomly. If you win, you win the match instantly.' },
  { name: 'Hot Sauce',            tier: 'Basic', scope: 'match', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Every time you win 2 consecutive rounds this match, earn 1 Basic powerup.' },

  // ── FORTUNE — Advanced (4) ─────────────────────────────────────────────────
  { name: 'Giant Fortune Cookie', tier: 'Advanced', scope: 'round', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Change throw to a random selection. If you win, earn 2 Advanced powerups.' },
  { name: 'Ghost Pepper',         tier: 'Advanced', scope: 'tournament', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Win 2 consecutive rounds = 1 Basic powerup. Win 3 consecutive = 1 Advanced powerup.' },
  { name: "Three's Company",      tier: 'Advanced', scope: 'match', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'If you win 3 consecutive rounds at any point this match, earn 3 Advanced powerups.' },
  { name: 'Lucky Penny',          tier: 'Advanced', scope: 'match', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Each round during Gut Check, call heads or tails. Correct call earns 1 Basic powerup. Independent of round outcome.' },

  // ── FORTUNE — Legendary (4) ────────────────────────────────────────────────
  { name: 'Wish Upon a Star',     tier: 'Legendary', scope: 'round', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'You win this round. You wished for it. The universe complied.' },
  { name: 'Comically Large Fortune Cookie', tier: 'Legendary', scope: 'round', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Change throw to a random selection. If you win, earn 2 Legendary powerups.' },
  { name: 'Carolina Reaper',      tier: 'Legendary', scope: 'tournament', tree: 'FORTUNE', jessieOnly: false, activationPhase: 'either',
    effect: 'Win 2 consecutive rounds = 1 Advanced powerup. Win 3 consecutive = 1 Legendary powerup.' },
  { name: 'The Ballad of Jessie Jones', tier: 'Legendary', scope: 'season', tree: 'FORTUNE', jessieOnly: true,  activationPhase: 'either',
    effect: 'All season: win 2 consecutive = 1 Advanced. Win 3 consecutive = 1 Legendary. Jessie powerup — player only.' },
];

// Lookup map — powerup name → catalog entry.
export const POWERUP_BY_NAME = Object.fromEntries(POWERUP_CATALOG.map(p => [p.name, p]));

// Lookup map — powerup name → effect description (used by match-screen popup).
export const POWERUP_DESCRIPTIONS = Object.fromEntries(
  POWERUP_CATALOG.map(p => [p.name, p.effect])
);

// Powerups that have actual gameplay effects implemented (rest are catalog-only for now).
export const POWERUP_IMPLEMENTED = new Set([
  'Changed My Mind',
  // FORTUNE
  'Fortune Cookie', 'Giant Fortune Cookie', 'Comically Large Fortune Cookie',
  "Pandora's Box", 'Project Hail Mary', 'Wish Upon a Star',
  'Hot Sauce', "Three's Company", 'Lucky Penny',
  'Ghost Pepper', 'Carolina Reaper', 'The Ballad of Jessie Jones',
  // MIND
  'The Jessie Special', 'Research Notes', 'Jessie Did Her Homework',
  'Dead Giveaway', 'Focus Group', 'Focused Focus Group',
  'Espresso Shot', 'A Word From Your Coach', 'Reading Glasses',
  'Courtside with Jessie', 'Smart Glasses', 'Protein Shake',
  // MYSTIC
  'Fait Accompli', 'Dizzy Spell', 'Hiccup Potion', 'Tabula Rasa',
  'Mystic Pizza', 'Cosmic Insurance Policy', "Schrödinger's Amulet",
  'Clockwork Orange', 'Cuckoo Clock', 'Jonesing to Help',
  // MYSTIC — NPC active skill system implemented in v1.0
  'Molasses', 'Padlock',
  // MYSTIC — pending NPC throw history tracking
  'Research Notes',
]);

// Powerups marked implemented but currently no-op (waiting on dependent systems).
// Useful for the popup to show "Effect activated, but waits on …" rather than a blanket lock.
export const POWERUP_NO_OP = new Set([
  // All former no-ops have been implemented in v1.0 NPC system.
]);

// ── Skill Trees — L1 metadata (Section 6.7 / 6.8 / 6.9) ──────────────────────
// Display info for the L1 root nodes. Higher levels deferred to a future v0.3 task.
export const SKILL_TREE_INFO = {
  MIND: {
    name:       'MIND',
    theme:      'Deduce it',
    color:      'var(--snes-blue)',
    rootId:     'MIND.1',
    rootName:   'Mind Power',
    rootEffect: '5 powerup slots. Start season with 4 Basic + 1 Advanced powerups.',
  },
  MYSTIC: {
    name:       'MYSTIC',
    theme:      'Bend it',
    color:      'var(--snes-purple)',
    rootId:     'MYSTIC.1',
    rootName:   'Mystical Power',
    rootEffect: '+15% chance of one tier higher on random drops, plus +5% Legendary chance.',
  },
  FORTUNE: {
    name:       'FORTUNE',
    theme:      'Trust it',
    color:      'var(--snes-green)',
    rootId:     'FORTUNE.1',
    rootName:   'Fortunate Power',
    rootEffect: '2× powerup drop rate per round.',
  },
};

// Drop modifiers from MYSTIC.1 (Mystical Power) — applied to in-season drops only.
export const MYSTIC_UPGRADE_BONUS_TO_ADVANCED  = 0.15; // +15%
export const MYSTIC_UPGRADE_BONUS_TO_LEGENDARY = 0.05; // +5%

// Drop multiplier from FORTUNE.1 (Fortunate Power).
export const FORTUNE_DROP_MULTIPLIER = 2;

// ── Skill Trees — L3 constants ────────────────────────────────────────────────
// MIND.1.1.2 — Desperate Clarity
export const DESPERATE_CLARITY_NPR_BOOST     = 0.20;  // +20% permanent NPR floor after 2 consecutive losses

// MYSTIC.1.1.1 — Force Your Hand (active, 90% tie→win)
// Note: ALTER_REALITY_CHANCE is now used by MYSTIC.1.1.1.2 (L4)
export const ALTER_REALITY_CHANCE            = 0.60;  // 60% tie→win passive (Alter Reality, L4)

// MYSTIC.1.1.2 — Third Time's the Charm
export const THIRD_TIMES_CHARM_BOOST         = 0.95;  // 95% tie→win after 2 failed conversions (one-time)

// MYSTIC.1.2.1 — Brain Fart (active, nullify opponent active skill)
export const BRAIN_FART_COOLDOWN_ROUNDS      = 3;

// MYSTIC.1.2.2 — Mind Shield (passive, 50% block NPR/Neural Scan)
export const MIND_SHIELD_CHANCE              = 0.50;  // 50% block opponent strategy reads (no-op until NPC NPR)

// MIND.1.2.2 — The Cooler (passive, 50% block TML/ATML)
export const THE_COOLER_CHANCE               = 0.50;  // 50% block opponent TML/ATML
// MIND.1.2.2.2 — The Freezer (upgrades Cooler 50%→75%)
export const THE_FREEZER_CHANCE              = 0.75;  // 75% block opponent TML/ATML

// FORTUNE.1.1.1 — Lucky Socks (passive, TML 75%→85%)
export const LUCKY_SOCKS_TML_CHANCE          = 0.85;  // 85% TML success (replaces 75%)

// FORTUNE.1.1.2 — Due for a Win
export const DUE_FOR_A_WIN_BOOST             = 0.95;  // 95% TML after 2 consecutive TML failures (one-time)

// MYSTIC.1.1.1 — Force Your Hand (was FORTUNE.1.2.1)
export const FORCE_YOUR_HAND_CHANCE          = 0.90;  // 90% tie→win
export const FORCE_YOUR_HAND_COOLDOWN_ROUNDS = 5;

// FORTUNE.1.2.1 — Change My Luck (active, earn 2 powerups on round loss)
export const CHANGE_MY_LUCK_COOLDOWN_ROUNDS  = 3;

// FORTUNE.1.2.2 — Oblivious (passive, 50% block MYSTIC tie-altering)
export const OBLIVIOUS_CHANCE                = 0.50;  // 50% block opponent tie-altering skill (no-op until NPC skills)

// ── MIND Powerup Passive Reveal Chances ───────────────────────────────────────
export const READING_GLASSES_CHANCE   = 0.15;  // 15% per round — tournament scope
export const SMART_GLASSES_CHANCE     = 0.20;  // 20% per round — season scope
export const COURTSIDE_CHANCE         = 0.40;  // 40% per round — tournament scope

// ── Skill Trees — L2 metadata (Section 6.7 / 6.8 / 6.9) ──────────────────────
// L2 nodes per tree. Each costs NODE_COST.L2 (10 pts). Requires L1 root.
// kind: 'passive' (always-on) or 'active' (player-triggered, with cooldown).
export const SKILL_TREE_L2 = {
  MIND: [
    { id: 'MIND.1.1', name: 'Neural Pattern Recognition', branch: 'Offense', kind: 'passive',
      effect: 'Accumulates 10% per round to identify NPC strategy at 90% accuracy. Resets at match start and after firing. Always 10% chance of false read.' },
    { id: 'MIND.1.2', name: 'Blank Slate', branch: 'Defense', kind: 'passive',
      effect: 'NPC pattern-reading strategies (Historian, Streaker, Mimic) treat your last 2 throws as unknown. Always active.' },
  ],
  MYSTIC: [
    { id: 'MYSTIC.1.1', name: 'Tweak Reality', branch: 'Offense', kind: 'passive',
      effect: '30% chance a natural tie converts to a win.' },
    { id: 'MYSTIC.1.2', name: 'Reverse Card', branch: 'Defense', kind: 'passive',
      effect: '25% chance any opponent active skill fires for you instead. Always active.' },
  ],
  FORTUNE: [
    { id: 'FORTUNE.1.1', name: 'Trust My Luck', branch: 'Offense', kind: 'active', cooldownRounds: 5,
      effect: 'Supersedes RPS choice. 75% auto-win / 25% auto-loss. Usable every 5 rounds.' },
    { id: 'FORTUNE.1.2', name: 'Consolation Prize', branch: 'Defense', kind: 'passive',
      effect: '30% chance to earn a Basic powerup when you lose a round. Always active.' },
  ],
};

// ── Skill Trees — L3 metadata (Section 6.7 / 6.8 / 6.9) ──────────────────────
// L3 nodes per tree. Each costs NODE_COST.L3 (15 pts). Requires parent L2.
export const SKILL_TREE_L3 = {
  MIND: [
    { id: 'MIND.1.1.1', name: 'Neural Scan', parent: 'MIND.1.1', branch: 0, kind: 'active',
      effect: 'Actively scan the NPC\'s strategy at 90% accuracy. Cross-match cooldown: once every 5 matches (3 with upgrade). Always 10% chance of false read.' },
    { id: 'MIND.1.1.2', name: 'Desperate Clarity', parent: 'MIND.1.1', branch: 1, kind: 'passive',
      effect: 'After 2 consecutive round losses this match: permanently add +20% to current NPR accumulation. Bonus does not reset when NPR fires. ★ MYSTIC SYNERGY: If you also hold the MYSTIC root, your season starting loadout replaces 1 Basic with 1 Legendary powerup (3 Basic + 1 Advanced + 1 Legendary).' },
    { id: 'MIND.1.2.1', name: 'Memory Wipe', parent: 'MIND.1.2', branch: 2, kind: 'active',
      effect: 'Reset NPC\'s strategy to their base behavior — all pattern adaptation erased. Usable once per match.' },
    { id: 'MIND.1.2.2', name: 'The Cooler', parent: 'MIND.1.2', branch: 3, kind: 'passive',
      effect: '50% chance to block opponent Trust My Luck / Advanced TML activation — opponent loses round on block. Upgrades to 75% with The Freezer. (No-op until NPC uses TML.)' },
  ],
  MYSTIC: [
    { id: 'MYSTIC.1.1.1', name: 'Force Your Hand', parent: 'MYSTIC.1.1', branch: 0, kind: 'active', cooldownRounds: 5,
      effect: '90% chance to convert a tie into a win this round. No effect on non-tie rounds. 5-round cooldown. Upgrades to 3-round cooldown with Twist Your Arm.' },
    { id: 'MYSTIC.1.1.2', name: "Third Time's the Charm", parent: 'MYSTIC.1.1', branch: 1, kind: 'passive',
      effect: 'After 2 consecutive failed tie conversions: next conversion attempt succeeds at 95%. Resets on success. One-time per match. ★ FORTUNE SYNERGY: If you also hold the FORTUNE root, your season starting loadout gains 1 Legendary powerup (1 Basic + 1 Legendary).' },
    { id: 'MYSTIC.1.2.1', name: 'Brain Fart', parent: 'MYSTIC.1.2', branch: 2, kind: 'active', cooldownRounds: 3,
      effect: 'Nullify opponent active skill this round + add 2 rounds to its cooldown. 3-round cooldown. (No-op until NPCs use active skills.)' },
    { id: 'MYSTIC.1.2.2', name: 'Mind Shield', parent: 'MYSTIC.1.2', branch: 3, kind: 'passive',
      effect: '50% chance to block opponent strategy reads (NPR, Neural Scan) targeting you. Upgrades to 90% with Mind Fortress. (No-op until NPC uses NPR.)' },
  ],
  FORTUNE: [
    { id: 'FORTUNE.1.1.1', name: 'Lucky Socks', parent: 'FORTUNE.1.1', branch: 0, kind: 'passive',
      effect: 'Upgrades Trust My Luck success chance from 75% to 85%. Always active. Replaced by Fingers Crossed (95%) at L4.' },
    { id: 'FORTUNE.1.1.2', name: 'Due for a Win', parent: 'FORTUNE.1.1', branch: 1, kind: 'passive',
      effect: 'After 2 consecutive Trust My Luck failures this match: next TML attempt succeeds at 95%. Resets on success. One-time per match. ★ MIND SYNERGY: If you also hold the MIND root, your starting powerup inventory gains +1 slot (6 slots total instead of 5).' },
    { id: 'FORTUNE.1.2.1', name: 'Change My Luck', parent: 'FORTUNE.1.2', branch: 2, kind: 'active', cooldownRounds: 3,
      effect: 'If you lose this round: earn 2 Basic+ luck-themed powerups. If you win: fizzles. 3-round cooldown.' },
    { id: 'FORTUNE.1.2.2', name: 'Oblivious', parent: 'FORTUNE.1.2', branch: 3, kind: 'passive',
      effect: '50% chance to block MYSTIC tie-altering skills (Tweak Reality, Force Your Hand, Alter Reality, Twist Your Arm). Always active. Upgrades to 90% with Totes Oblivious. (No-op until NPC uses MYSTIC tie-altering.)' },
  ],
};

// ── Skill Trees — L4 metadata ─────────────────────────────────────────────────
// L4 nodes (Aspirational — largely unreachable in a single playthrough).
// Each costs NODE_COST.L4 (20 pts). Requires parent L3.
// branch 0-1: children of L3 branch 0, 2-3: branch 1, 4-5: branch 2, 6-7: branch 3.
export const SKILL_TREE_L4 = {
  MIND: [
    { id: 'MIND.1.1.1.1', name: 'Neural Scan 2.0', parent: 'MIND.1.1.1', branch: 0, kind: 'active',
      effect: 'Replaces Neural Scan. Same 90% on-demand read. Cooldown: every 3 matches (was 5). Shares UI button and tracker with Neural Scan.' },
    { id: 'MIND.1.1.1.2', name: 'Adv. Neural Pattern Rec.', parent: 'MIND.1.1.1', branch: 1, kind: 'passive',
      effect: 'NPR per-round accumulation: 10% → 15%. Always active. Does not affect accuracy or false result chance.' },
    { id: 'MIND.1.1.2.1', name: 'Mental Mysticism', parent: 'MIND.1.1.2', branch: 2, kind: 'active', cooldownRounds: 3,
      effect: 'Precondition: NPR must have fired this match. 90% chance to convert a tie to a win. 3-round cooldown.' },
    { id: 'MIND.1.1.2.2', name: 'Uncanny Mind', parent: 'MIND.1.1.2', branch: 3, kind: 'passive',
      effect: '+10% tier upgrade chance / +5% Legendary chance on random powerup drops. Stacks additively with MYSTIC.1 (Mystical Power).' },
    { id: 'MIND.1.2.1.1', name: 'Total Recall', parent: 'MIND.1.2.1', branch: 4, kind: 'active',
      effect: 'Memory Wipe AND reveals the base strategy the NPC reverts to. Once per match. (Reveal pending NPC base-strategy tracking.)' },
    { id: 'MIND.1.2.1.2', name: 'Clean Slate', parent: 'MIND.1.2.1', branch: 5, kind: 'passive',
      effect: 'After any purge (Memory Wipe or Total Recall): NPC pattern strategies (Historian, Streaker, Mimic) locked out for 3 rounds. (No-op until NPC pattern strategies implemented.)' },
    { id: 'MIND.1.2.2.1', name: 'Not Today!', parent: 'MIND.1.2.2', branch: 6, kind: 'active', cooldownRounds: 3,
      effect: '95% chance opponent TML/ATML fails — opponent loses round. Takes precedence over Cooler/Freezer. 3-round cooldown. (No-op until NPC uses TML.)' },
    { id: 'MIND.1.2.2.2', name: 'The Freezer', parent: 'MIND.1.2.2', branch: 7, kind: 'passive',
      effect: 'Upgrades The Cooler: 50% → 75% block chance against opponent TML/ATML.' },
  ],
  MYSTIC: [
    { id: 'MYSTIC.1.1.1.1', name: 'Twist Your Arm', parent: 'MYSTIC.1.1.1', branch: 0, kind: 'active', cooldownRounds: 3,
      effect: 'Replaces Force Your Hand. Same 90% tie → win. Cooldown: every 3 rounds (was 5). Shares UI button and tracker.' },
    { id: 'MYSTIC.1.1.1.2', name: 'Alter Reality', parent: 'MYSTIC.1.1.1', branch: 1, kind: 'passive',
      effect: 'Upgrades Tweak Reality: 30% tie conversion → 60%. Always active.' },
    { id: 'MYSTIC.1.1.2.1', name: 'Refuse to Lose', parent: 'MYSTIC.1.1.2', branch: 2, kind: 'active', cooldownRounds: 3,
      effect: '90% chance a round loss converts to an immune tie instead. The immune tie cannot be altered by any tie-altering skill. 3-round cooldown.' },
    { id: 'MYSTIC.1.1.2.2', name: 'Probability Storm', parent: 'MYSTIC.1.1.2', branch: 3, kind: 'passive',
      effect: '50% chance any non-Basic powerup drop yields 2 copies instead of 1. Triggers overflow prompt if inventory is full.' },
    { id: 'MYSTIC.1.2.1.1', name: 'Massive Brain Fart', parent: 'MYSTIC.1.2.1', branch: 4, kind: 'active', cooldownRounds: 3,
      effect: 'Nullify opponent active skill + add 3 rounds to its cooldown + add 1 round to all other opponent active skill cooldowns. 3-round cooldown. (No-op until NPC uses active skills.)' },
    { id: 'MYSTIC.1.2.1.2', name: 'Bamboozle', parent: 'MYSTIC.1.2.1', branch: 5, kind: 'passive',
      effect: '25% chance any opponent powerup activates for you instead. Always active. (No-op until NPC activates powerups.)' },
    { id: 'MYSTIC.1.2.2.1', name: 'Phantom Memory', parent: 'MYSTIC.1.2.2', branch: 6, kind: 'active', cooldownRounds: 1,
      effect: 'When a Neural X skill fires against you (after Mind Shield block check): plant a false strategy read. 1-round cooldown. Not triggered by IGaH.' },
    { id: 'MYSTIC.1.2.2.2', name: 'Mind Fortress', parent: 'MYSTIC.1.2.2', branch: 7, kind: 'passive',
      effect: 'Upgrades Mind Shield: 50% → 90% block chance against NPR and Neural Scan reads. (No-op until NPC uses NPR.)' },
  ],
  FORTUNE: [
    { id: 'FORTUNE.1.1.1.1', name: 'Advanced TML (ATML)', parent: 'FORTUNE.1.1.1', branch: 0, kind: 'active', cooldownRounds: 3,
      effect: 'Replaces TML entirely. Same 75%/25% odds. Cooldown: every 3 rounds (was 5). Shares UI button and tracker.' },
    { id: 'FORTUNE.1.1.1.2', name: 'Fingers Crossed', parent: 'FORTUNE.1.1.1', branch: 1, kind: 'passive',
      effect: 'TML/ATML success chance: 85% → 95%. Replaces Lucky Socks value — does not stack.' },
    { id: 'FORTUNE.1.1.2.1', name: "I've Got a Hunch (IGaH)", parent: 'FORTUNE.1.1.2', branch: 2, kind: 'active', cooldownRounds: 3,
      effect: '50% chance of a Neural Scan–quality read at 90% accuracy. NOT blocked by Mind Shield or Mind Fortress. Failure: silent fizzle. 3-round cooldown.' },
    { id: 'FORTUNE.1.1.2.2', name: 'Make Your Own Luck', parent: 'FORTUNE.1.1.2', branch: 3, kind: 'passive',
      effect: 'On any powerup drop: system generates 2 options, player chooses 1 via blocking UI prompt. Always active.' },
    { id: 'FORTUNE.1.2.1.1', name: 'Reversal of Fortune', parent: 'FORTUNE.1.2.1', branch: 4, kind: 'active', cooldownRounds: 3,
      effect: 'If you lose this round: earn 2 Advanced+ luck-themed powerups. 3-round cooldown.' },
    { id: 'FORTUNE.1.2.1.2', name: 'Look What I Found', parent: 'FORTUNE.1.2.1', branch: 5, kind: 'passive',
      effect: 'On round loss: 25% independent chance of a powerup one tier above Consolation Prize. Both Consolation Prize and Look What I Found can trigger on the same loss.' },
    { id: 'FORTUNE.1.2.2.1', name: 'Lucky Charm', parent: 'FORTUNE.1.2.2', branch: 6, kind: 'active', cooldownRounds: 3,
      effect: 'If a MYSTIC tie-altering skill fires this round: result reversed to your favor. Fires after Oblivious fails to block. Fizzles (consuming cooldown) if no tie-altering fires. 3-round cooldown.' },
    { id: 'FORTUNE.1.2.2.2', name: 'Totes Oblivious', parent: 'FORTUNE.1.2.2', branch: 7, kind: 'passive',
      effect: 'Upgrades Oblivious: 50% → 90% block chance against MYSTIC tie-altering skills. (No-op until NPC uses MYSTIC tie-altering.)' },
  ],
};

// Lookup: node id → metadata across L1 + L2 + L3 + L4.
export const SKILL_NODE_INFO = (() => {
  const map = {};
  for (const [tree, info] of Object.entries(SKILL_TREE_INFO)) {
    map[info.rootId] = { ...info, level: 1, tree };
  }
  for (const [tree, nodes] of Object.entries(SKILL_TREE_L2)) {
    for (const node of nodes) {
      map[node.id] = { ...node, level: 2, tree };
    }
  }
  for (const [tree, nodes] of Object.entries(SKILL_TREE_L3)) {
    for (const node of nodes) {
      map[node.id] = { ...node, level: 3, tree };
    }
  }
  for (const [tree, nodes] of Object.entries(SKILL_TREE_L4)) {
    for (const node of nodes) {
      map[node.id] = { ...node, level: 4, tree };
    }
  }
  return map;
})();

// L2 skill effect chances.
export const TWEAK_REALITY_CHANCE     = 0.30;
export const CONSOLATION_PRIZE_CHANCE = 0.30;
export const REVERSE_CARD_CHANCE      = 0.25; // no-op until NPC active skills exist
export const TML_SUCCESS_CHANCE       = 0.75;
export const TML_COOLDOWN_ROUNDS      = 5;
export const NPR_FIRE_BASE_ACCURACY   = 0.90;

// ── Skill Trees — L4 constants ────────────────────────────────────────────────
// MIND.1.1.2.1 — Mental Mysticism
export const MENTAL_MYSTICISM_CHANCE         = 0.90;  // 90% tie→win (precondition: NPR fired this match)
export const MENTAL_MYSTICISM_COOLDOWN_ROUNDS= 3;

// MYSTIC.1.1.1.1 — Twist Your Arm (replaces Force Your Hand, shared cooldown tracker)
export const TWIST_YOUR_ARM_COOLDOWN_ROUNDS  = 3;     // replaces FORCE_YOUR_HAND_COOLDOWN_ROUNDS (5→3)

// MYSTIC.1.1.2.1 — Refuse to Lose
export const REFUSE_TO_LOSE_CHANCE           = 0.90;  // 90% loss→immune tie
export const REFUSE_TO_LOSE_COOLDOWN_ROUNDS  = 3;

// MYSTIC.1.1.2.2 — Probability Storm
export const PROBABILITY_STORM_CHANCE        = 0.50;  // 50% chance non-Basic drop yields 2

// MYSTIC.1.2.1.1 — Massive Brain Fart
export const MASSIVE_BRAIN_FART_COOLDOWN_ROUNDS = 3;  // no-op until NPC active skills

// MYSTIC.1.2.1.2 — Bamboozle
export const BAMBOOZLE_CHANCE                = 0.25;  // 25% chance opp powerup fires for player; no-op until NPC powerups

// MIND.1.2.2.1 — Not Today!
export const NOT_TODAY_COOLDOWN_ROUNDS       = 3;
export const NOT_TODAY_CHANCE                = 0.95;  // 95% chance NPC TML auto-fails (opponent loses round)

// MYSTIC.1.2.2.1 — Phantom Memory
export const PHANTOM_MEMORY_COOLDOWN_ROUNDS  = 1;     // 1-round cooldown

// MYSTIC.1.2.2.2 — Mind Fortress
export const MIND_FORTRESS_CHANCE            = 0.90;  // upgrades Mind Shield 50%→90%; no-op until NPC NPR

// FORTUNE.1.1.1.1 — Advanced TML (ATML)
export const ATML_COOLDOWN_ROUNDS            = 3;     // replaces TML_COOLDOWN_ROUNDS (5→3)

// FORTUNE.1.1.1.2 — Fingers Crossed
export const FINGERS_CROSSED_TML_CHANCE      = 0.95;  // TML/ATML 85%→95% (replaces Lucky Socks)

// FORTUNE.1.1.2.1 — I've Got a Hunch (IGaH)
export const IGAH_CHANCE                     = 0.50;  // 50% chance of strategy read
export const IGAH_READ_ACCURACY              = 0.90;  // 90% accuracy when it fires (not blocked by Mind Shield)
export const IGAH_COOLDOWN_ROUNDS            = 3;

// FORTUNE.1.2.1.1 — Reversal of Fortune
export const REVERSAL_OF_FORTUNE_COOLDOWN_ROUNDS = 3;

// FORTUNE.1.2.1.2 — Look What I Found
export const LOOK_WHAT_I_FOUND_CHANCE        = 0.25;  // 25% on loss, independent of Consolation Prize

// FORTUNE.1.2.2.1 — Lucky Charm
export const LUCKY_CHARM_COOLDOWN_ROUNDS     = 3;

// FORTUNE.1.2.2.2 — Totes Oblivious
export const TOTES_OBLIVIOUS_CHANCE          = 0.90;  // upgrades Oblivious 50%→90%

// ── NPC Skill System ──────────────────────────────────────────────────────────
export const NPC_POWERUP_CHANCE_RATE         = 0.25;  // probability NPC activates powerup when powerupStrategy==='chance'
export const NPC_LUCKY_CHARM_BLOCK_CHANCE    = 0.90;  // Lucky Charm: chance NPC tie-conversion fires for player instead
export const NPC_RESEARCH_NOTES_MIN_THROWS   = 5;     // minimum NPC throw history before Research Notes shows data

// MIND.1.1.2.2 — Uncanny Mind (stacks with MYSTIC.1)
export const UNCANNY_MIND_UPGRADE_BONUS      = 0.10;  // +10% tier upgrade chance on drops
export const UNCANNY_MIND_LEGENDARY_BONUS    = 0.05;  // +5% Legendary chance on drops

// ── Jessie Consolation Dialogue (Section 4.6) ────────────────────────────────
// Locked text — do not change without designer approval.
// Shown to eliminated players (not runner-up, not champion) at season end.
// Each tier is [pepTalk, awardSentence] — displayed as two tap-to-advance boxes.
export const JESSIE_CONSOLATION_DIALOGUE = {
  1: [
    "Hey. That one stings, I know. But you know what? We've got the whole off-season. I'm talking early mornings, late nights, the works. By the time we're done, you're going to be a completely different competitor. Take these points — you earned every one of them.",
    "Your intensive off-season training yielded 25 new skill points to spend before next season!",
  ],
  2: [
    "Regional's a tough draw. But honestly? This is exactly the kind of loss that makes champions. We've got time to fix what went wrong. I've already got a training plan in my head. These points are from us putting in the work together.",
    "Your dedicated off-season work earned you 20 new skill points to spend before next season!",
  ],
  3: [
    "You made it to Nationals. That's real. And now we know exactly what we need to sharpen. We'll use this off-season well — I promise you that. Here's what our sessions together earned you.",
    "Your focused off-season sessions earned you 15 new skill points to spend before next season!",
  ],
  4: [
    "Continental. You were right there. The gap between you and the top is smaller than you think — I've seen it up close. We don't have a lot of off-season left, but we're going to make every session count. These points are from the work we squeezed in.",
    "Your off-season work together earned you 10 new skill points to spend before next season!",
  ],
  5: [
    "You made the World Championship. Let that land for a second. The off-season is short — almost no time at all before it starts again — but we found a few sessions together, and I want you to have what we worked on. You're ready.",
    "Those sessions together earned you 5 new skill points to spend before next season!",
  ],
};

// ── Ranking Milestones (Section 11.3) ─────────────────────────────────────────
// One-shot thresholds — fire the first time player's worldRank reaches each level.
export const RANKING_MILESTONES = [
  { id: 'ranked', threshold: 100, message: "You've entered the world rankings!" },
  { id: 'top50',  threshold: 50,  message: "You've broken into the top 50!" },
  { id: 'top20',  threshold: 20,  message: "You broke into the top 20!" },
  { id: 'top10',  threshold: 10,  message: "You're in the top 10 in the world!" },
  { id: 'top3',   threshold: 3,   message: "You're one of the top 3 players on the planet!" },
  { id: 'rank1',  threshold: 1,   message: "You are the #1 ranked RPS player in the world!" },
];
// Personal best fires any season the player improves their best rank (not one-shot).
export const MILESTONE_PERSONAL_BEST_MSG    = "You hit a new personal best ranking!";
// Championship milestones fire on T5 wins.
export const MILESTONE_FIRST_CHAMP_MSG      = "First Championship! You've reached the pinnacle!";
export const MILESTONE_THREE_TIME_CHAMP_MSG = "Three-Time World Champion!";

// ── NPC Strategy Descriptions ────────────────────────────────────────────────
// Human-readable text shown to the player when a strategy read fires.
// Describes the observable behavior without naming the internal strategy.
export const NPC_STRATEGY_DESCRIPTION = {
  random:        "It appears they are choosing randomly.",
  puristRock:    "It seems like they're always choosing rock.",
  puristScissors:"It seems like they're always choosing scissors.",
  puristPaper:   "It seems like they're always choosing paper.",
  puristRandom:  "It seems like they're always choosing the same choice.",
  mirror:        "It seems like they're always throwing what you threw last round.",
  counter:       "It seems like they're always choosing what would beat what you threw last round.",
  cycler:        "It seems like they're picking in a fixed sequence.",
  momentum:      "It seems like they stick with the same throw until it loses.",
  streaker:      "It seems like they're trying to counter based on patterns of how you're playing this match.",
  historian:     "It seems like they're trying to counter based on patterns of how you're playing this season.",
  tilted:        "It seems like they go random after they've lost 2 rounds.",
};

// ── Powerup Drop System (Section 8.4) ────────────────────────────────────────
// Base drop chance by the player's Nth win within a match (escalating schedule).
// Values > 1.0 mean guaranteed drops + fractional chance for one more.
export const POWERUP_DROP_CHANCE_BY_ROUND_WON = {
  1: 0.10, 2: 0.20, 3: 0.40, 4: 0.80, 5: 1.60, 6: 3.20,
};
export const POWERUP_UPGRADE_CHANCE_BASE  = 0.10; // Flat +10% to upgrade one tier on any drop
export const POWERUP_MAX_SLOTS_BASELINE   = 3;    // Default slots before MIND.1 / FORTUNE.1.1.2

// ── Coach Jessie — Tutorial Beats T-01 through T-14 ─────────────────────────
// One-shot per character; tracked in _trophies.jessieOneShots.
// Source: SRPS_Tutorial_Flow_DRAFT_v3.pdf (2026-04-27).
// T-01: 14-box story sequence. Narration boxes use { text, narration: true }.
//   Box 13 contains [SKILL_POINTS] — substitute STARTING_SKILL_POINTS_SEASON_1 at call site.
// T-07: 3 outcome variants; autoDismissMs fires after ~3s.
// T-08: lineTemplate with [SKILL_NAME] — substitute active skill name at call site.
// T-10/T-11: dropped/merged into T-08.
export const JESSIE_TUTORIAL_DIALOGUE = {
  'T-01': {
    messages: [
      { text: "You've been coming to this gym since you were twelve. Same cracked floor tiles. Same faded championship banners on the wall. You know every corner of this place. Today, it's louder than usual.", narration: true },
      { text: "There's a crowd near the far wall. Thirty, maybe forty people. Phones out. Voices low. Someone important is here.", narration: true },
      { text: "The crowd parts. You've seen that face on trading cards. On championship banners. On the wall of the Hall of Fame itself. Jessie \"Jazz Hands\" Jones.", narration: true },
      { text: "Retired undefeated. Inducted at twenty-six — the youngest in the history of the sport. The woman who made Rock Paper Scissors look like chess. She's looking right at you.", narration: true },
      { text: "“I was wondering when you’d get here.”", expression: 'whisper' },
      { text: "“Six months of tournament tape. I’ve watched every match you’ve played this year. You’ve got something. I’m not sure you even know what it is yet.”", expression: 'whisper' },
      { text: "“I do.”", expression: 'determined' },
      { text: "“I stopped coaching three years ago. Made myself a promise. But every few years, someone comes along who changes the math on that promise. You’re one of those people.”", expression: 'determined' },
      { text: "“I want to coach you. One season. Let’s find out what you’re actually capable of.”", expression: 'fistpump' },
      { text: "You don't even hesitate.", narration: true },
      { text: "“Good answer. We start now.”", expression: 'fistpump' },
      { text: "Weeks pass. Early mornings before the gym opens. Late nights running scenarios. Thousands of throws — pattern after pattern — until your instincts start to feel like facts. Jessie doesn’t teach you what to think. She teaches you how.", narration: true },
      { text: "“Look at you. These [SKILL_POINTS] skill points are from everything we’ve put in together. Every session. Every breakthrough. Every time you figured something out before I told you. They’re yours. Spend them well.”", expression: 'determined' },
      { text: "“First stop: the Local Championship. Four players. One bracket. Your first real test. Let’s go show them what we built.”", expression: 'determined' },
    ],
  },
  'T-02': {
    expression: 'determined',
    lines: ["Time to spend your first skill points! You can only pick one tree this season, so choose carefully. MIND reads the opponent. MYSTIC bends the rules. FORTUNE trusts the universe. This choice is permanent — pick the one that feels like you. You’ll add a second tree next season."],
  },
  'T-03': {
    expression: 'whisper',
    lines: ["These 15 points are from our pre-season sessions. Start with the root node — it unlocks your powerup slots and you need those from day one. Tap a node to see what it does. When you’re ready, hit ADD to spend your points — and LOCK IN when you’re happy with your build. Then work toward whatever you want to become."],
  },
  'T-04': {
    expression: 'default',
    lines: ["Four players. Two matches. Win your semifinal, you’re in the final. Both finalists advance to Regionals — so runner-up counts too. The bracket fills in as results come in."],
  },
  'T-05': {
    expression: 'determined',
    lines: ["I know we’ve practiced this, but I’ll go over it once more quickly. Pick your throw. Your opponent is doing the same — neither of you knows what the other chose until the countdown hits zero."],
  },
  'T-06': {
    expression: 'whisper',
    lines: ["This is the Gut Check. If any of your skills have something to tell you, it shows here. By default you can’t change your throw — only certain skills and powerups let you do that. Hit Ready when you’re set."],
  },
  // T-07: non-blocking, auto-dismisses after ~3s. Outcome determines which variant fires.
  'T-07': {
    autoDismissMs: 3000,
    variants: {
      win:  { expression: 'fistpump',   line: "That’s one. Watch the panel on the right — it tracks every round. First to three wins the match." },
      loss: { expression: 'determined', line: "Don’t worry — that’s only one round. You’ve got four more to work with. Watch the panel on the right — it’ll show you the full picture." },
      tie:  { expression: 'default',    line: "A tie. Time to make a new choice — good luck!" },
    },
  },
  // T-08: [SKILL_NAME] substituted at runtime with the player's active skill name.
  'T-08': {
    expression: 'whisper',
    lineTemplate: "That button with [SKILL_NAME] is the active skill you purchased from the skill tree. Try to use it at the right time — it can give you a huge advantage.",
  },
  'T-09': {
    expression: 'fistpump',
    lines: ["Your first powerup. Activate it during Throw Selection or Gut Check — once it’s used, it’s gone. Check the glow: white is Basic, blue is Advanced, gold is Legendary."],
  },
  // T-10 dropped. T-11 merged into T-08.
  'T-12': {
    expression: 'default',
    lines: ["Your ELO rating moves after every match. Right now you’re near the bottom — that’s expected. This is a 10-season career. The ranking that matters is where you end up, not where you start."],
  },
  'T-13': {
    expression: 'determined',
    lines: ["Now that you’ve trained in the off-season, you’re ready to tweak your strategy for Season 2. Every point you spent comes back — reallocate however you want. This is your one chance to completely rethink your build. Use it."],
  },
  'T-14': {
    expression: 'fistpump',
    lines: ["Time for your second tree — this one locks in permanently, same as the first. These two define you for the rest of this career. Everything you build from here lives inside them."],
  },
};

// ── Coach Jessie — Milestone Beats ───────────────────────────────────────────
// Keyed by milestone ID. Fires in summary.js on season results, highest-priority only.
// Championship + ranking milestones are already one-shot at the system level.
// personal_best is repeatable (no one-shot guard needed).
export const JESSIE_MILESTONE_DIALOGUE = {
  ranked: {
    expression: 'default',
    lines: [
      "You're ranked. A hundred players, one list — and you've got a number now.",
      "Most people who step into this sport never make it onto that list. Don't stop here.",
    ],
  },
  top50: {
    expression: 'determined',
    lines: [
      "Top 50 in the world. The bottom half of the field is behind you.",
      "The other half isn't moving out of your way.",
    ],
  },
  top20: {
    expression: 'fistpump',
    lines: [
      "Top 20. You're not just competitive — you're elite.",
      "I knew you'd get here.",
    ],
  },
  top10: {
    expression: 'fistpump',
    lines: [
      "Ten players. That's the entire upper tier of this sport. And you're one of them.",
      "I've been waiting to see this number.",
    ],
  },
  top3: {
    expression: 'fistpump',
    lines: [
      "Top 3 on the planet. There are two players ahead of you. That's it.",
      "You know what that means.",
    ],
  },
  rank1: {
    expression: 'fistpump',
    lines: [
      "Number one in the world.",
      "...",
      "I was going to say something impressive right now. But honestly? You did that. Not me.",
    ],
  },
  personal_best: {
    expression: 'determined',
    lines: [
      "New personal best. That's what consistent work looks like.",
    ],
  },
  first_champ: {
    expression: 'fistpump',
    lines: [
      "World Champion. You won the whole thing.",
      "I coached a World Champion. I don't care how many times I get to say that — it never gets old.",
    ],
  },
  three_time_champ: {
    expression: 'fistpump',
    lines: [
      "Three World Championships.",
      "There are coaches who retire having never seen one of these. You've got three. I don't even know what to say to you right now.",
    ],
  },
};

// Priority order for picking which Jessie milestone beat to show when multiple fire in one season.
export const JESSIE_MILESTONE_PRIORITY = [
  'three_time_champ', 'first_champ',
  'rank1', 'top3', 'top10', 'top20', 'top50', 'ranked',
  'personal_best',
];

// ── Coach Jessie — Seasonal Check-Ins M-12 ───────────────────────────────────
// 8 rotating lines, indexed 0–7. Tracked in _trophies.jessieSeasonCheckInHistory.
// Resets to [] after all 8 have been used. Fires in the off-season screen.
export const JESSIE_SEASON_CHECKIN = [
  { expression: 'default',    text: "Season 2. You've seen what this game can throw at you. Now let's build something that handles it." },
  { expression: 'default',    text: "Season 3. Your opponents have been watching. Good — that means you've been doing something worth watching." },
  { expression: 'determined', text: "Season 4. Midpoint of the career is coming. Build like you're already in the final." },
  { expression: 'determined', text: "Season 5. The field's gotten harder. So have you. That's the deal." },
  { expression: 'determined', text: "Season 6. Most players who make it this far start playing not to lose. We don't do that." },
  { expression: 'worried',    text: "Season 7. Three seasons left. I need you locked in from here." },
  { expression: 'determined', text: "Season 8. This is where we separate the players who just competed from the ones who actually played to win." },
  { expression: 'determined', text: "Season 9. One more after this. Make this one count." },
];

// ── Feedback ──────────────────────────────────────────────────────────────────
export const FEEDBACK_URL = 'https://forms.gle/P73QR6txD1pZf7YL7';

// ── localStorage Schema Version ───────────────────────────────────────────────
export const SCHEMA_VERSION = 1;
// Increment this when making any breaking localStorage schema change.
// Migration function in storage.js checks this on every app load.
