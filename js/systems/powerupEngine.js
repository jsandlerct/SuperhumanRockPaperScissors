import { roll } from '../utils/rng.js';
import {
  POWERUP_DROP_CHANCE_BY_ROUND_WON,
  POWERUP_UPGRADE_CHANCE_BASE,
  POWERUP_MAX_SLOTS_BASELINE,
} from '../constants.js';

// ── Drop count ─────────────────────────────────────────────────────────────────

// Returns how many powerups the player earns after their Nth win in a match.
// roundWon = 1 for first win, 2 for second win, etc.
// fortuneMultiplier = 2 if FORTUNE.1 purchased (Fortunate Power), else 1.
export function calcDropCount(roundWon, fortuneMultiplier = 1) {
  const base       = POWERUP_DROP_CHANCE_BY_ROUND_WON[roundWon] ?? 0;
  const chance     = base * fortuneMultiplier;
  const guaranteed = Math.floor(chance);
  const extra      = roll() < (chance - guaranteed) ? 1 : 0;
  return guaranteed + extra;
}

// ── Tier resolution ────────────────────────────────────────────────────────────

// Applies the standard tier upgrade roll to a base tier.
// upgradeChanceMod = bonus percentage from MYSTIC.1, Uncanny Mind, etc. (0 for v0.2).
function resolveTier(baseTier, upgradeChanceMod) {
  const chance = POWERUP_UPGRADE_CHANCE_BASE + upgradeChanceMod;
  if (baseTier === 'Basic'    && roll() < chance) return 'Advanced';
  if (baseTier === 'Advanced' && roll() < chance) return 'Legendary';
  return baseTier;
}

// ── Instance creation ──────────────────────────────────────────────────────────

function createPowerupInstance(name, tier, tree, scope) {
  const instanceId = 'pu_' + Math.floor(roll() * 0x100000000).toString(16).padStart(8, '0');
  return { instanceId, name, tier, tree, scope };
}

// ── Drop generation ────────────────────────────────────────────────────────────

// Generates an array of powerup instances for a drop event.
// upgradeChanceMod = bonus upgrade percentage from tree nodes (0 for v0.2).
// For v0.2: only "Changed My Mind" (universal, Basic, round scope) is in the pool.
export function generateDrops(count, upgradeChanceMod = 0) {
  const drops = [];
  for (let i = 0; i < count; i++) {
    const tier = resolveTier('Basic', upgradeChanceMod);
    drops.push(createPowerupInstance('Changed My Mind', tier, 'UNIVERSAL', 'round'));
  }
  return drops;
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
