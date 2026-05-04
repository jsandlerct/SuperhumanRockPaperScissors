import { roll } from '../utils/rng.js';
import {
  POWERUP_DROP_CHANCE_BY_ROUND_WON,
  POWERUP_UPGRADE_CHANCE_BASE,
  POWERUP_MAX_SLOTS_BASELINE,
  POWERUP_CATALOG,
  STARTING_LOADOUT,
  MYSTIC_UPGRADE_BONUS_TO_ADVANCED,
  MYSTIC_UPGRADE_BONUS_TO_LEGENDARY,
  FORTUNE_DROP_MULTIPLIER,
} from '../constants.js';

// ── Tree state inspection ─────────────────────────────────────────────────────

// Returns true if the given tree's L1 root is purchased.
function hasRoot(treeState, treeName) {
  return Boolean(treeState?.[treeName]?.[`${treeName}.1`]);
}

// Returns the array of trees the player has any node in (root or higher).
function getActiveTrees(treeState) {
  if (!treeState) return [];
  return ['MIND', 'MYSTIC', 'FORTUNE'].filter(t =>
    treeState[t] && Object.values(treeState[t]).some(v => v === true)
  );
}

// ── Tree-derived drop modifiers ───────────────────────────────────────────────

// FORTUNE.1 doubles the base drop rate per round.
export function getDropMultiplier(treeState) {
  return hasRoot(treeState, 'FORTUNE') ? FORTUNE_DROP_MULTIPLIER : 1;
}

// MYSTIC.1 applies an upgrade-chance bonus to in-season round-win drops.
// Returns { advanced, legendary } — independent rolls applied in resolveTier.
export function getUpgradeBonus(treeState) {
  if (!treeState) return { advanced: 0, legendary: 0 };
  let advanced  = 0;
  let legendary = 0;
  if (hasRoot(treeState, 'MYSTIC')) {
    advanced  += MYSTIC_UPGRADE_BONUS_TO_ADVANCED;
    legendary += MYSTIC_UPGRADE_BONUS_TO_LEGENDARY;
  }
  return { advanced, legendary };
}

// ── Drop count ─────────────────────────────────────────────────────────────────

// Returns how many powerups the player earns after their Nth win in a match.
// roundWon = 1 for first win, 2 for second win, etc.
// fortuneMultiplier = 2 if FORTUNE.1 purchased, else 1.
export function calcDropCount(roundWon, fortuneMultiplier = 1) {
  const base       = POWERUP_DROP_CHANCE_BY_ROUND_WON[roundWon] ?? 0;
  const chance     = base * fortuneMultiplier;
  const guaranteed = Math.floor(chance);
  const extra      = roll() < (chance - guaranteed) ? 1 : 0;
  return guaranteed + extra;
}

// ── Tier resolution ────────────────────────────────────────────────────────────

// Applies upgrade rolls. bonus = { advanced, legendary } from MYSTIC.1 etc.
function resolveTier(baseTier, bonus = { advanced: 0, legendary: 0 }) {
  const advChance = POWERUP_UPGRADE_CHANCE_BASE + (bonus.advanced ?? 0);
  const legChance = POWERUP_UPGRADE_CHANCE_BASE + (bonus.legendary ?? 0);
  if (baseTier === 'Basic'    && roll() < advChance) return 'Advanced';
  if (baseTier === 'Advanced' && roll() < legChance) return 'Legendary';
  return baseTier;
}

// ── Pool selection ────────────────────────────────────────────────────────────

// Returns the catalog entries the player can receive based on their tree state.
// Universal powerups always included. Tree pools included for any tree the
// player has any node in.
export function getDropPool(treeState, opts = {}) {
  const { excludeJessieOnly = false } = opts;
  const activeTrees = new Set(getActiveTrees(treeState));
  // Always include universal powerups.
  return POWERUP_CATALOG.filter(p => {
    if (excludeJessieOnly && p.jessieOnly) return false;
    if (p.tree === 'UNIVERSAL') return true;
    return activeTrees.has(p.tree);
  });
}

// ── Instance creation ──────────────────────────────────────────────────────────

function createPowerupInstance(name, tier, tree, scope) {
  const instanceId = 'pu_' + Math.floor(roll() * 0x100000000).toString(16).padStart(8, '0');
  return { instanceId, name, tier, tree, scope };
}

// Picks a random powerup of the requested tier from a filtered pool.
// Falls back to the same tier across all eligible trees if no match in the
// requested filtering. Returns null if no candidates exist.
function pickRandomFromPool(pool, tier) {
  const candidates = pool.filter(p => p.tier === tier);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(roll() * candidates.length)];
}

// ── Drop generation (in-season round-win drops) ───────────────────────────────

// Generates an array of powerup instances for a round-win drop event.
// Tree state determines the eligible pool and any upgrade-chance bonus.
export function generateDrops(count, treeState) {
  const pool  = getDropPool(treeState);
  const bonus = getUpgradeBonus(treeState);
  const drops = [];

  for (let i = 0; i < count; i++) {
    const tier   = resolveTier('Basic', bonus);
    const picked = pickRandomFromPool(pool, tier)
                 ?? pickRandomFromPool(pool, 'Basic'); // fallback if pool lacks tier
    if (!picked) continue;
    drops.push(createPowerupInstance(picked.name, tier, picked.tree, picked.scope));
  }
  return drops;
}

// ── Starting loadout (deterministic, no RNG) ──────────────────────────────────

// Maps tree state to the deterministic starting loadout key from STARTING_LOADOUT.
// For v0.3-pre (L1 only): single-tree players use {tree}_only.
// Returns null if no roots are purchased (Lock In gate prevents this anyway).
function getLoadoutKey(treeState) {
  const has = {
    MIND:    hasRoot(treeState, 'MIND'),
    MYSTIC:  hasRoot(treeState, 'MYSTIC'),
    FORTUNE: hasRoot(treeState, 'FORTUNE'),
  };
  const roots = Object.keys(has).filter(t => has[t]);
  if (roots.length === 0) return null;
  if (roots.length === 1) return `${roots[0]}_only`;

  // Multi-root combinations (synergy keys not yet relevant — L3 nodes).
  const sorted = roots.sort().join('_');
  if (sorted === 'MIND_MYSTIC')   return 'MIND_MYSTIC_roots';
  if (sorted === 'FORTUNE_MIND')  return 'MIND_FORTUNE_roots';
  if (sorted === 'FORTUNE_MYSTIC') return 'MYSTIC_FORTUNE_roots';
  return null;
}

// Deterministic starter pools — first N picks per tier per tree.
// Curated to give a player a varied, themed opening hand.
const STARTER_PICKS = {
  UNIVERSAL: { Basic: ['Changed My Mind'] },
  MIND: {
    Basic:     ['Espresso Shot', 'Focus Group', 'Research Notes', 'Protein Shake'],
    Advanced:  ['Reading Glasses', 'Dead Giveaway', 'Focused Focus Group', 'A Word From Your Coach'],
    Legendary: ['Smart Glasses', 'Jessie Did Her Homework'],
  },
  MYSTIC: {
    Basic:     ['Mystic Pizza', 'Hiccup Potion', 'Dizzy Spell', "Schrödinger's Amulet"],
    Advanced:  ['Tabula Rasa', 'Clockwork Orange', 'Molasses', 'Padlock'],
    Legendary: ['Cosmic Insurance Policy', 'Fait Accompli'],
  },
  FORTUNE: {
    Basic:     ['Fortune Cookie', 'Hot Sauce', "Pandora's Box", 'Project Hail Mary'],
    Advanced:  ['Lucky Penny', 'Giant Fortune Cookie', 'Ghost Pepper', "Three's Company"],
    Legendary: ['Carolina Reaper', 'Wish Upon a Star'],
  },
};

// Determines the source tree to draw a tier from for a given loadout.
// Single-tree player draws from their tree; multi-root players prefer the
// "richer" pool (MIND > FORTUNE > MYSTIC for tier coverage). Universal Basic
// is reserved as fallback for trees that lack starter Basics.
function pickStarterPowerup(treeState, tier, alreadyPicked) {
  const order = ['MIND', 'FORTUNE', 'MYSTIC'].filter(t => hasRoot(treeState, t));
  for (const tree of order) {
    const pool = STARTER_PICKS[tree]?.[tier] ?? [];
    for (const name of pool) {
      if (!alreadyPicked.has(name)) return name;
    }
  }
  // Last-resort fallback to universal pool (only Basic).
  if (tier === 'Basic') {
    for (const name of STARTER_PICKS.UNIVERSAL.Basic) {
      if (!alreadyPicked.has(name)) return name;
    }
  }
  return null;
}

// Deterministic loadout — no RNG, no upgrade rolls.
// Returns an array of powerup instances ready to assign to inventory.
export function generateStartingLoadout(treeState) {
  const key = getLoadoutKey(treeState);
  if (!key) return [];

  const recipe = STARTING_LOADOUT[key];
  if (!recipe) return [];

  const out         = [];
  const usedNames   = new Set();
  const tiers       = ['Legendary', 'Advanced', 'Basic']; // higher tier first to prefer it
  for (const tier of tiers) {
    const want = recipe[tier] ?? 0;
    for (let i = 0; i < want; i++) {
      const name = pickStarterPowerup(treeState, tier, usedNames);
      if (!name) continue;
      usedNames.add(name);
      const meta = POWERUP_CATALOG.find(p => p.name === name);
      if (!meta) continue;
      // Same instance creation as drops, but seeded values.
      const instanceId = 'pu_' + Math.floor(roll() * 0x100000000).toString(16).padStart(8, '0');
      out.push({ instanceId, name: meta.name, tier, tree: meta.tree, scope: meta.scope });
    }
  }
  return out;
}

// ── Bonus drops (powerup-triggered, fixed-tier) ───────────────────────────────

// Spawns a fixed-tier set of drops without rolling for upgrades.
// Used by powerup effects like Fortune Cookie ("earn 2 Basic powerups").
// Specs: array of { tier, count } objects.
// Pulls from the player's current drop pool (universal + active trees).
// If the requested tier has no candidates in the pool, falls back to lower
// tiers (Legendary → Advanced → Basic) so the spawn is never lost.
export function generateBonusDrops(specs, treeState) {
  const pool = getDropPool(treeState);
  const out  = [];
  const tierFallback = { Legendary: ['Legendary', 'Advanced', 'Basic'],
                         Advanced:  ['Advanced', 'Basic'],
                         Basic:     ['Basic'] };

  for (const { tier, count } of specs) {
    for (let i = 0; i < count; i++) {
      let picked = null;
      for (const t of (tierFallback[tier] ?? [tier])) {
        picked = pickRandomFromPool(pool, t);
        if (picked) break;
      }
      if (!picked) continue;
      const instanceId = 'pu_' + Math.floor(roll() * 0x100000000).toString(16).padStart(8, '0');
      out.push({ instanceId, name: picked.name, tier: picked.tier, tree: picked.tree, scope: picked.scope });
    }
  }
  return out;
}

// Random R/P/S pick — used by Fortune Cookie family and Pandora's Box etc.
export function randomThrow() {
  const throws = ['rock', 'paper', 'scissors'];
  return throws[Math.floor(roll() * throws.length)];
}

// Random heads/tails — used by Lucky Penny.
export function randomCoinFlip() {
  return roll() < 0.5 ? 'heads' : 'tails';
}

// ── Inventory slots ────────────────────────────────────────────────────────────

// Returns the maximum number of inventory slots for this character.
// Baseline = 3. MIND.1 raises to 5. FORTUNE.1.1.2 synergy adds a 6th.
export function getMaxSlots(treeState) {
  if (!treeState) return POWERUP_MAX_SLOTS_BASELINE;
  if (treeState.MIND?.['MIND.1']) {
    return treeState.FORTUNE?.['FORTUNE.1.1.2'] ? 6 : 5;
  }
  return POWERUP_MAX_SLOTS_BASELINE;
}
