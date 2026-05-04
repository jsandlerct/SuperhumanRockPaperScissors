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
  { name: "Schrödinger's Amulet", tier: 'Basic', scope: 'round', tree: 'MYSTIC', jessieOnly: false, activationPhase: 'either',
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
  // MYSTIC
  'Fait Accompli', 'Dizzy Spell', 'Hiccup Potion', 'Tabula Rasa',
  'Mystic Pizza', 'Cosmic Insurance Policy',
  // MYSTIC — no-op until later systems land (skill cooldowns / NPC powerup use)
  'Clockwork Orange', 'Molasses', 'Padlock', 'Cuckoo Clock',
]);

// Powerups marked implemented but currently no-op (waiting on dependent systems).
// Useful for the popup to show "Effect activated, but waits on …" rather than a blanket lock.
export const POWERUP_NO_OP = new Set([
  'Clockwork Orange',  // resets your active-skill cooldowns — needs v0.3 active skills
  'Molasses',          // bumps opponent active-skill cooldowns — needs v0.3 active skills
  'Padlock',           // blocks NPC powerup activation — NPCs don't yet activate powerups
  'Cuckoo Clock',      // auto-fires Clockwork Orange — needs v0.3 active skills
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

// Lookup: node id → metadata across L1 + L2.
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
  return map;
})();

// L2 skill effect chances.
export const TWEAK_REALITY_CHANCE     = 0.30;
export const CONSOLATION_PRIZE_CHANCE = 0.30;
export const REVERSE_CARD_CHANCE      = 0.25; // no-op until NPC active skills exist
export const TML_SUCCESS_CHANCE       = 0.75;
export const TML_COOLDOWN_ROUNDS      = 5;
export const NPR_FIRE_BASE_ACCURACY   = 0.90;

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

// ── Powerup Drop System (Section 8.4) ────────────────────────────────────────
// Base drop chance by the player's Nth win within a match (escalating schedule).
// Values > 1.0 mean guaranteed drops + fractional chance for one more.
export const POWERUP_DROP_CHANCE_BY_ROUND_WON = {
  1: 0.10, 2: 0.20, 3: 0.40, 4: 0.80, 5: 1.60, 6: 3.20,
};
export const POWERUP_UPGRADE_CHANCE_BASE  = 0.10; // Flat +10% to upgrade one tier on any drop
export const POWERUP_MAX_SLOTS_BASELINE   = 3;    // Default slots before MIND.1 / FORTUNE.1.1.2

// ── localStorage Schema Version ───────────────────────────────────────────────
export const SCHEMA_VERSION = 1;
// Increment this when making any breaking localStorage schema change.
// Migration function in storage.js checks this on every app load.
