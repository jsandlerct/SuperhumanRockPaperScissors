import { describe, test, assert, assertEqual } from './testRunner.js';
import {
  calcDropCount, generateDrops, getMaxSlots,
  getDropMultiplier, getUpgradeBonus, getDropPool,
  generateStartingLoadout, generateBonusDrops,
  randomThrow, randomCoinFlip,
} from '../systems/powerupEngine.js';
import {
  POWERUP_CATALOG, POWERUP_IMPLEMENTED, POWERUP_NO_OP,
  POWERUP_UPGRADE_CHANCE_BASE,
  MYSTIC_UPGRADE_BONUS_TO_ADVANCED, MYSTIC_UPGRADE_BONUS_TO_LEGENDARY,
  UNCANNY_MIND_UPGRADE_BONUS, UNCANNY_MIND_LEGENDARY_BONUS,
  PROBABILITY_STORM_CHANCE,
} from '../constants.js';
import { setRollFn, resetRoll } from '../utils/rng.js';

// Helper: queue of roll values; excess rolls fall back to 0.5.
function withRolls(values, fn) {
  let i = 0;
  setRollFn(() => values[i++] ?? 0.5);
  try { return fn(); } finally { resetRoll(); }
}

const treeMIND     = { MIND:    { 'MIND.1': true }, MYSTIC: {}, FORTUNE: {} };
const treeMYSTIC   = { MIND: {}, MYSTIC:  { 'MYSTIC.1': true }, FORTUNE: {} };
const treeFORTUNE  = { MIND: {}, MYSTIC: {}, FORTUNE: { 'FORTUNE.1': true } };

// Uncanny Mind (MIND.1.1.2.2): stacks upgrade bonus additively with MYSTIC.1
const treeUncannyMind = {
  MIND: { 'MIND.1': true, 'MIND.1.1.2.2': true },
};
const treeUncannyMindAndMYSTIC = {
  MIND:  { 'MIND.1': true, 'MIND.1.1.2.2': true },
  MYSTIC: { 'MYSTIC.1': true },
};

// Probability Storm (MYSTIC.1.1.2.2): 50% chance of duplicate non-Basic drop
const treeProbStorm = {
  MYSTIC: { 'MYSTIC.1': true, 'MYSTIC.1.1.2.2': true },
};

// ── calcDropCount ─────────────────────────────────────────────────────────────

describe('calcDropCount', () => {

  test('round 1: 0 drops when roll is above 10%', () => {
    assertEqual(withRolls([0.15], () => calcDropCount(1)), 0);
  });

  test('round 1: 1 drop when roll is below 10%', () => {
    assertEqual(withRolls([0.05], () => calcDropCount(1)), 1);
  });

  test('round 5: 2 drops when fractional roll passes (0.50 < 0.60)', () => {
    assertEqual(withRolls([0.50], () => calcDropCount(5)), 2);
  });

  test('round 6: 4 drops when fractional roll passes (0.10 < 0.20)', () => {
    assertEqual(withRolls([0.10], () => calcDropCount(6)), 4);
  });

  test('fortuneMultiplier=2 doubles base chance', () => {
    assertEqual(withRolls([0.15], () => calcDropCount(1, 2)), 1);
  });

  test('unknown round returns 0 drops', () => {
    assertEqual(withRolls([0.01], () => calcDropCount(99)), 0);
  });

});

// ── getDropMultiplier ─────────────────────────────────────────────────────────

describe('getDropMultiplier', () => {

  test('returns 1 when no FORTUNE root', () => {
    assertEqual(getDropMultiplier(null), 1);
    assertEqual(getDropMultiplier(treeMIND), 1);
  });

  test('returns 2 when FORTUNE.1 purchased', () => {
    assertEqual(getDropMultiplier(treeFORTUNE), 2);
  });

});

// ── getUpgradeBonus ───────────────────────────────────────────────────────────

describe('getUpgradeBonus', () => {

  test('returns zero bonus when no MYSTIC root', () => {
    const b = getUpgradeBonus(treeMIND);
    assertEqual(b.advanced, 0);
    assertEqual(b.legendary, 0);
  });

  test('MYSTIC.1 adds +15% advanced and +5% legendary', () => {
    const b = getUpgradeBonus(treeMYSTIC);
    assert(Math.abs(b.advanced - 0.15) < 1e-9, '+15% advanced');
    assert(Math.abs(b.legendary - 0.05) < 1e-9, '+5% legendary');
  });

  test('Uncanny Mind alone (no MYSTIC root): +10% advanced, +5% legendary', () => {
    const b = getUpgradeBonus(treeUncannyMind);
    assert(Math.abs(b.advanced  - UNCANNY_MIND_UPGRADE_BONUS) < 1e-9,
      `advanced should be ${UNCANNY_MIND_UPGRADE_BONUS}, got ${b.advanced}`);
    assert(Math.abs(b.legendary - UNCANNY_MIND_LEGENDARY_BONUS) < 1e-9,
      `legendary should be ${UNCANNY_MIND_LEGENDARY_BONUS}, got ${b.legendary}`);
  });

  test('Uncanny Mind + MYSTIC.1 stack additively: +25% advanced, +10% legendary', () => {
    const b = getUpgradeBonus(treeUncannyMindAndMYSTIC);
    const expectedAdv = MYSTIC_UPGRADE_BONUS_TO_ADVANCED + UNCANNY_MIND_UPGRADE_BONUS; // 0.25
    const expectedLeg = MYSTIC_UPGRADE_BONUS_TO_LEGENDARY + UNCANNY_MIND_LEGENDARY_BONUS; // 0.10
    assert(Math.abs(b.advanced  - expectedAdv) < 1e-9,
      `stacked advanced should be ${expectedAdv}, got ${b.advanced}`);
    assert(Math.abs(b.legendary - expectedLeg) < 1e-9,
      `stacked legendary should be ${expectedLeg}, got ${b.legendary}`);
  });

  test('Uncanny Mind stacking beats MYSTIC.1 alone', () => {
    const mysticOnly   = getUpgradeBonus(treeMYSTIC);
    const withUncanny  = getUpgradeBonus(treeUncannyMindAndMYSTIC);
    assert(withUncanny.advanced  > mysticOnly.advanced,  'stacked > MYSTIC-only advanced');
    assert(withUncanny.legendary > mysticOnly.legendary, 'stacked > MYSTIC-only legendary');
  });

  test('null treeState returns zero bonus', () => {
    const b = getUpgradeBonus(null);
    assertEqual(b.advanced, 0);
    assertEqual(b.legendary, 0);
  });

});

// ── getDropPool ───────────────────────────────────────────────────────────────

describe('getDropPool', () => {

  test('null treeState yields only universal powerups', () => {
    const pool = getDropPool(null);
    assert(pool.every(p => p.tree === 'UNIVERSAL'), 'only universal');
    assert(pool.length >= 1, 'at least Changed My Mind');
  });

  test('MIND root yields universal + MIND powerups', () => {
    const pool = getDropPool(treeMIND);
    assert(pool.some(p => p.tree === 'MIND'),     'has MIND powerups');
    assert(pool.some(p => p.tree === 'UNIVERSAL'),'has UNIVERSAL');
    assert(!pool.some(p => p.tree === 'MYSTIC'),  'no MYSTIC');
    assert(!pool.some(p => p.tree === 'FORTUNE'), 'no FORTUNE');
  });

  test('excludeJessieOnly removes player-only Jessie powerups', () => {
    const pool = getDropPool(treeMIND, { excludeJessieOnly: true });
    assert(!pool.some(p => p.jessieOnly), 'no jessie-only powerups');
  });

});

// ── generateDrops ─────────────────────────────────────────────────────────────

describe('generateDrops', () => {

  test('count 0 returns empty array', () => {
    const drops = withRolls([], () => generateDrops(0, treeMIND));
    assertEqual(drops.length, 0);
  });

  test('null treeState pulls only universal — Changed My Mind', () => {
    // tier roll, pool pick roll, instanceId roll
    const drops = withRolls([0.50, 0.50, 0.50], () => generateDrops(1, null));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].name, 'Changed My Mind');
    assertEqual(drops[0].tier, 'Basic');
    assertEqual(drops[0].tree, 'UNIVERSAL');
    assert(drops[0].instanceId.startsWith('pu_'), 'instanceId starts with pu_');
  });

  test('MIND tree state yields a MIND or UNIVERSAL powerup', () => {
    const drops = withRolls([0.50, 0.50, 0.50], () => generateDrops(1, treeMIND));
    assertEqual(drops.length, 1);
    assert(['MIND', 'UNIVERSAL'].includes(drops[0].tree), 'tree is MIND or UNIVERSAL');
  });

  test('tier upgrade to Advanced fires when roll < base 10%', () => {
    const drops = withRolls([0.05, 0.50, 0.50], () => generateDrops(1, treeMIND));
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('MYSTIC.1 stacks with base for higher upgrade chance', () => {
    // base 0.10 + 0.15 = 0.25; roll 0.20 → Advanced
    const drops = withRolls([0.20, 0.50, 0.50], () => generateDrops(1, treeMYSTIC));
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('Uncanny Mind alone raises upgrade threshold: roll 0.19 → Advanced', () => {
    // advChance = base 0.10 + Uncanny 0.10 = 0.20; roll 0.19 < 0.20 → Advanced
    const drops = withRolls([0.19, 0, 0], () => generateDrops(1, treeUncannyMind));
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('Uncanny Mind alone: roll 0.20 stays Basic (boundary)', () => {
    // 0.20 >= 0.20 → no upgrade → Basic
    const drops = withRolls([0.20, 0, 0], () => generateDrops(1, treeUncannyMind));
    assertEqual(drops[0].tier, 'Basic');
  });

  test('Uncanny Mind + MYSTIC.1: roll 0.34 → Advanced (0.10+0.15+0.10=0.35)', () => {
    // advChance = 0.10 + 0.15 + 0.10 = 0.35; roll 0.34 < 0.35 → Advanced
    const drops = withRolls([0.34, 0, 0], () => generateDrops(1, treeUncannyMindAndMYSTIC));
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('Uncanny Mind + MYSTIC.1: roll 0.35 stays Basic (boundary)', () => {
    // 0.35 >= 0.35 → no upgrade → Basic
    const drops = withRolls([0.35, 0, 0], () => generateDrops(1, treeUncannyMindAndMYSTIC));
    assertEqual(drops[0].tier, 'Basic');
  });

});

// ── generateStartingLoadout ───────────────────────────────────────────────────

describe('generateStartingLoadout', () => {

  test('empty tree state yields empty loadout', () => {
    const loadout = generateStartingLoadout({});
    assertEqual(loadout.length, 0);
  });

  test('MIND-only state yields 4 Basic + 1 Advanced (5 total)', () => {
    const loadout = generateStartingLoadout(treeMIND);
    assertEqual(loadout.length, 5);
    const basics    = loadout.filter(p => p.tier === 'Basic').length;
    const advanced  = loadout.filter(p => p.tier === 'Advanced').length;
    assertEqual(basics,   4);
    assertEqual(advanced, 1);
  });

  test('MYSTIC-only state yields 1 Basic', () => {
    const loadout = generateStartingLoadout(treeMYSTIC);
    assertEqual(loadout.length, 1);
    assertEqual(loadout[0].tier, 'Basic');
  });

  test('FORTUNE-only state yields 1 Basic', () => {
    const loadout = generateStartingLoadout(treeFORTUNE);
    assertEqual(loadout.length, 1);
    assertEqual(loadout[0].tier, 'Basic');
  });

  test('all loadout entries have unique instanceIds', () => {
    const loadout = generateStartingLoadout(treeMIND);
    const ids = new Set(loadout.map(p => p.instanceId));
    assertEqual(ids.size, loadout.length);
  });

});

// ── getMaxSlots ───────────────────────────────────────────────────────────────

describe('getMaxSlots', () => {

  test('returns 3 for null treeState', () => {
    assertEqual(getMaxSlots(null), 3);
  });

  test('returns 3 for empty treeState', () => {
    assertEqual(getMaxSlots({}), 3);
  });

  test('returns 5 when MIND.1 is purchased', () => {
    assertEqual(getMaxSlots(treeMIND), 5);
  });

  test('returns 6 when MIND.1 + FORTUNE.1.1.2 both purchased', () => {
    assertEqual(getMaxSlots({
      MIND:    { 'MIND.1': true },
      FORTUNE: { 'FORTUNE.1.1.2': true },
    }), 6);
  });

  test('returns 5 when MIND.1 purchased but FORTUNE.1.1.2 not', () => {
    assertEqual(getMaxSlots({
      MIND:    { 'MIND.1': true },
      FORTUNE: { 'FORTUNE.1.1.2': false },
    }), 5);
  });

  test('returns 3 (baseline) when only MYSTIC root purchased', () => {
    assertEqual(getMaxSlots(treeMYSTIC), 3);
  });

  test('returns 3 (baseline) when only FORTUNE root purchased', () => {
    assertEqual(getMaxSlots(treeFORTUNE), 3);
  });

  test('FORTUNE.1.1.2 without MIND root does not grant 6 slots', () => {
    // The 6-slot synergy requires MIND root; FORTUNE.1.1.2 alone has no slot effect.
    assertEqual(getMaxSlots({
      FORTUNE: { 'FORTUNE.1': true, 'FORTUNE.1.1.2': true },
    }), 3);
  });

});

// ── generateStartingLoadout — synergy combinations ───────────────────────────

describe('generateStartingLoadout — synergy combinations', () => {

  // Fixtures for multi-root states
  const treeMIND_MYSTIC_roots = {
    MIND:   { 'MIND.1': true },
    MYSTIC: { 'MYSTIC.1': true },
  };
  const treeMIND_MYSTIC_synergy = {
    MIND:   { 'MIND.1': true, 'MIND.1.1.2': true },  // Desperate Clarity purchased
    MYSTIC: { 'MYSTIC.1': true },
  };
  const treeMIND_FORTUNE_roots = {
    MIND:    { 'MIND.1': true },
    FORTUNE: { 'FORTUNE.1': true },
  };
  const treeMIND_FORTUNE_synergy = {
    MIND:    { 'MIND.1': true },
    FORTUNE: { 'FORTUNE.1': true, 'FORTUNE.1.1.2': true },  // Due for a Win purchased
  };
  const treeMYSTIC_FORTUNE_roots = {
    MYSTIC:  { 'MYSTIC.1': true },
    FORTUNE: { 'FORTUNE.1': true },
  };
  const treeMYSTIC_FORTUNE_synergy = {
    MYSTIC:  { 'MYSTIC.1': true, 'MYSTIC.1.1.2': true },  // Third Time's the Charm purchased
    FORTUNE: { 'FORTUNE.1': true },
  };

  test('MIND + MYSTIC roots (no Desperate Clarity): 4 Basic + 1 Advanced', () => {
    const loadout = generateStartingLoadout(treeMIND_MYSTIC_roots);
    assertEqual(loadout.length, 5);
    assertEqual(loadout.filter(p => p.tier === 'Basic').length,    4);
    assertEqual(loadout.filter(p => p.tier === 'Advanced').length, 1);
    assertEqual(loadout.filter(p => p.tier === 'Legendary').length, 0);
  });

  test('MIND + MYSTIC with Desperate Clarity synergy: 3 Basic + 1 Advanced + 1 Legendary', () => {
    const loadout = generateStartingLoadout(treeMIND_MYSTIC_synergy);
    assertEqual(loadout.length, 5);
    assertEqual(loadout.filter(p => p.tier === 'Basic').length,     3);
    assertEqual(loadout.filter(p => p.tier === 'Advanced').length,  1);
    assertEqual(loadout.filter(p => p.tier === 'Legendary').length, 1);
  });

  test('MIND + FORTUNE roots (no Due for a Win): 4 Basic + 1 Advanced', () => {
    const loadout = generateStartingLoadout(treeMIND_FORTUNE_roots);
    assertEqual(loadout.length, 5);
    assertEqual(loadout.filter(p => p.tier === 'Basic').length,    4);
    assertEqual(loadout.filter(p => p.tier === 'Advanced').length, 1);
    assertEqual(loadout.filter(p => p.tier === 'Legendary').length, 0);
  });

  test('MIND + FORTUNE with Due for a Win synergy: still 4 Basic + 1 Advanced (but 6 slots)', () => {
    const loadout = generateStartingLoadout(treeMIND_FORTUNE_synergy);
    assertEqual(loadout.length, 5);
    assertEqual(loadout.filter(p => p.tier === 'Basic').length,    4);
    assertEqual(loadout.filter(p => p.tier === 'Advanced').length, 1);
    // Slot bonus confirmed separately via getMaxSlots
    assertEqual(getMaxSlots(treeMIND_FORTUNE_synergy), 6);
  });

  test('MYSTIC + FORTUNE roots (no Third Time\'s the Charm): 1 Basic', () => {
    const loadout = generateStartingLoadout(treeMYSTIC_FORTUNE_roots);
    assertEqual(loadout.length, 1);
    assertEqual(loadout[0].tier, 'Basic');
  });

  test("MYSTIC + FORTUNE with Third Time's the Charm synergy: 1 Basic + 1 Legendary", () => {
    const loadout = generateStartingLoadout(treeMYSTIC_FORTUNE_synergy);
    assertEqual(loadout.length, 2);
    assertEqual(loadout.filter(p => p.tier === 'Basic').length,     1);
    assertEqual(loadout.filter(p => p.tier === 'Legendary').length, 1);
  });

  test('synergy loadout entries all have required fields', () => {
    const loadout = generateStartingLoadout(treeMIND_MYSTIC_synergy);
    for (const p of loadout) {
      assert(p.instanceId, 'must have instanceId');
      assert(p.name,       'must have name');
      assert(p.tier,       'must have tier');
      assert(p.tree,       'must have tree');
      assert(p.scope,      'must have scope');
    }
  });

  test('synergy loadout has unique instanceIds', () => {
    const loadout = generateStartingLoadout(treeMIND_MYSTIC_synergy);
    const ids = new Set(loadout.map(p => p.instanceId));
    assertEqual(ids.size, loadout.length, 'all instanceIds must be unique');
  });

  // ── Negative synergy: L3 node without the partner tree root ──────────────────
  // Synergy requires BOTH: the L3 node AND the partner tree's root.
  // Having the L3 node alone must fall back to the single-tree loadout.

  test('MIND.1.1.2 without MYSTIC root: MIND-only loadout, no synergy Legendary', () => {
    const loadout = generateStartingLoadout({
      MIND: { 'MIND.1': true, 'MIND.1.1.2': true },
    });
    assertEqual(loadout.length, 5, 'MIND-only: 5 powerups');
    assertEqual(loadout.filter(p => p.tier === 'Basic').length,     4);
    assertEqual(loadout.filter(p => p.tier === 'Advanced').length,  1);
    assertEqual(loadout.filter(p => p.tier === 'Legendary').length, 0, 'Legendary requires MYSTIC root');
  });

  test("MYSTIC.1.1.2 without FORTUNE root: MYSTIC-only loadout (1 Basic), no synergy Legendary", () => {
    const loadout = generateStartingLoadout({
      MYSTIC: { 'MYSTIC.1': true, 'MYSTIC.1.1.2': true },
    });
    assertEqual(loadout.length, 1, 'MYSTIC-only: 1 powerup');
    assertEqual(loadout[0].tier, 'Basic', 'Legendary requires FORTUNE root');
  });

  test('FORTUNE.1.1.2 without MIND root: FORTUNE-only loadout (1 Basic), no synergy, no extra slot', () => {
    const ts = { FORTUNE: { 'FORTUNE.1': true, 'FORTUNE.1.1.2': true } };
    const loadout = generateStartingLoadout(ts);
    assertEqual(loadout.length, 1, 'FORTUNE-only: 1 powerup');
    assertEqual(loadout[0].tier, 'Basic');
    assertEqual(getMaxSlots(ts), 3, '6th slot requires MIND root');
  });

  test('MIND.1.1.2 + MYSTIC root WITH synergy beats MIND-only: Legendary present', () => {
    const withSynergy    = generateStartingLoadout(treeMIND_MYSTIC_synergy);
    const withoutSynergy = generateStartingLoadout({ MIND: { 'MIND.1': true, 'MIND.1.1.2': true } });
    assert(withSynergy.some(p => p.tier === 'Legendary'),    'synergy: has Legendary');
    assert(!withoutSynergy.some(p => p.tier === 'Legendary'), 'no partner root: no Legendary');
  });

});

// ── Probability Storm (MYSTIC.1.1.2.2) ───────────────────────────────────────
//
// When purchased, each non-Basic drop from generateDrops has a 50% chance of
// yielding a second copy of the same powerup. Basic drops are never duplicated.
// Roll sequence for generateDrops(1, treeProbStorm):
//   [0] resolveTier (Basic→Advanced check)
//   [1] pickRandomFromPool (index into candidates)
//   [2] createPowerupInstance instanceId
//   [3] PROBABILITY_STORM_CHANCE check (only if tier !== 'Basic')
//   [4] second instanceId (only if storm fires)

describe('Probability Storm (MYSTIC.1.1.2.2)', () => {

  test('constant is 50%', () => {
    assertEqual(PROBABILITY_STORM_CHANCE, 0.50);
  });

  test('storm not purchased: non-Basic drop yields 1 copy', () => {
    // treeMYSTIC has MYSTIC.1 but NOT MYSTIC.1.1.2.2
    // roll 0.20 → Advanced (0.10+0.15=0.25; 0.20<0.25)
    const drops = withRolls([0.20, 0, 0], () => generateDrops(1, treeMYSTIC));
    assertEqual(drops.length, 1, 'no storm: only 1 drop');
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('storm purchased, non-Basic, storm fires (0.49 < 0.50): 2 copies', () => {
    // treeProbStorm has MYSTIC.1 + MYSTIC.1.1.2.2
    const drops = withRolls([0.20, 0, 0, 0.49, 0.1], () => generateDrops(1, treeProbStorm));
    assertEqual(drops.length, 2, 'storm fires: 2 drops');
    assert(drops.every(d => d.tier === 'Advanced'), 'both copies are Advanced');
    assert(drops[0].name === drops[1].name, 'both copies are the same powerup');
  });

  test('storm purchased, non-Basic, storm does NOT fire at boundary (0.50 >= 0.50): 1 copy', () => {
    const drops = withRolls([0.20, 0, 0, 0.50], () => generateDrops(1, treeProbStorm));
    assertEqual(drops.length, 1, 'boundary: storm does not fire at 0.50');
  });

  test('storm purchased, Basic drop: no duplication regardless of roll', () => {
    // roll 0.25 >= advChance (0.10+0.15=0.25) → Basic, storm not checked
    const drops = withRolls([0.25, 0, 0], () => generateDrops(1, treeProbStorm));
    assertEqual(drops.length, 1, 'Basic never duplicated');
    assertEqual(drops[0].tier, 'Basic');
  });

  test('storm duplicates are independent instances (unique instanceIds)', () => {
    const drops = withRolls([0.20, 0, 0, 0.49, 0.9], () => generateDrops(1, treeProbStorm));
    assertEqual(drops.length, 2);
    assert(drops[0].instanceId !== drops[1].instanceId, 'duplicate copies have distinct instanceIds');
  });

  test('storm only fires once per drop (not recursive)', () => {
    // Two drops, storm fires on both — result is exactly 4, not 8 (no recursive storm)
    const rolls = [0.20, 0, 0, 0.49, 0.1,   // drop 1: Advanced + storm fires
                   0.20, 0, 0, 0.49, 0.2];   // drop 2: Advanced + storm fires
    const drops = withRolls(rolls, () => generateDrops(2, treeProbStorm));
    assertEqual(drops.length, 4, 'two drops + two storm dupes = 4 total, not 8');
  });

});

// ── generateBonusDrops ────────────────────────────────────────────────────────

describe('generateBonusDrops', () => {

  test('empty specs returns empty array', () => {
    const drops = withRolls([], () => generateBonusDrops([], treeMIND));
    assertEqual(drops.length, 0);
  });

  test('single Basic spec yields 1 drop', () => {
    // Each drop: 1 roll for pool selection + 1 roll for instanceId = 2 rolls
    const drops = withRolls([0.5, 0.5], () => generateBonusDrops([{ tier: 'Basic', count: 1 }], treeMIND));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].tier, 'Basic');
  });

  test('count=3 Basic spec yields 3 drops', () => {
    const drops = withRolls(Array(6).fill(0.5), () =>
      generateBonusDrops([{ tier: 'Basic', count: 3 }], treeMIND));
    assertEqual(drops.length, 3);
    assert(drops.every(d => d.tier === 'Basic'), 'all drops must be Basic');
  });

  test('Advanced spec yields an Advanced drop', () => {
    const drops = withRolls([0.5, 0.5], () =>
      generateBonusDrops([{ tier: 'Advanced', count: 1 }], treeMIND));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('Legendary spec yields a Legendary drop from a tree with Legendaries', () => {
    const drops = withRolls([0.5, 0.5], () =>
      generateBonusDrops([{ tier: 'Legendary', count: 1 }], treeMIND));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].tier, 'Legendary');
  });

  test('multiple specs generate cumulative drops', () => {
    // 1 Basic + 1 Advanced = 2 drops, each needs 2 rolls
    const drops = withRolls(Array(4).fill(0.5), () =>
      generateBonusDrops([{ tier: 'Basic', count: 1 }, { tier: 'Advanced', count: 1 }], treeMIND));
    assertEqual(drops.length, 2);
    assertEqual(drops.filter(d => d.tier === 'Basic').length,    1);
    assertEqual(drops.filter(d => d.tier === 'Advanced').length, 1);
  });

  test('every drop has all required fields', () => {
    const drops = withRolls(Array(6).fill(0.5), () =>
      generateBonusDrops([{ tier: 'Basic', count: 3 }], treeMIND));
    for (const d of drops) {
      assert(d.instanceId.startsWith('pu_'), 'instanceId must start with pu_');
      assert(d.name,  'must have name');
      assert(d.tier,  'must have tier');
      assert(d.tree,  'must have tree');
      assert(d.scope, 'must have scope');
    }
  });

  test('all instanceIds are unique across multiple drops', () => {
    // Use non-identical roll sequences to avoid duplicate hex strings
    const rolls = [];
    for (let i = 0; i < 10; i++) { rolls.push(0.3 + i * 0.05); rolls.push(0.5 + i * 0.04); }
    const drops = withRolls(rolls, () =>
      generateBonusDrops([{ tier: 'Basic', count: 5 }], treeMIND));
    const ids = new Set(drops.map(d => d.instanceId));
    assertEqual(ids.size, drops.length, 'instanceIds must be unique');
  });

  test('drops come from the correct tree pool', () => {
    const drops = withRolls(Array(6).fill(0.5), () =>
      generateBonusDrops([{ tier: 'Basic', count: 3 }], treeFORTUNE));
    for (const d of drops) {
      assert(['FORTUNE', 'UNIVERSAL'].includes(d.tree),
        `expected FORTUNE or UNIVERSAL, got ${d.tree}`);
    }
  });

  test('null treeState yields only universal drops', () => {
    const drops = withRolls([0.5, 0.5], () =>
      generateBonusDrops([{ tier: 'Basic', count: 1 }], null));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].tree, 'UNIVERSAL');
  });

});

// ── randomThrow ───────────────────────────────────────────────────────────────

describe('randomThrow', () => {

  test('roll 0.0 → rock (index 0)', () => {
    assertEqual(withRolls([0.0], () => randomThrow()), 'rock');
  });

  test('roll 0.34 → paper (index 1)', () => {
    // Math.floor(0.34 * 3) = Math.floor(1.02) = 1
    assertEqual(withRolls([0.34], () => randomThrow()), 'paper');
  });

  test('roll 0.67 → scissors (index 2)', () => {
    // Math.floor(0.67 * 3) = Math.floor(2.01) = 2
    assertEqual(withRolls([0.67], () => randomThrow()), 'scissors');
  });

  test('returns a valid throw for any roll value', () => {
    const valid = new Set(['rock', 'paper', 'scissors']);
    for (const r of [0, 0.1, 0.2, 0.33, 0.5, 0.66, 0.8, 0.99]) {
      const t = withRolls([r], () => randomThrow());
      assert(valid.has(t), `roll ${r} produced invalid throw: ${t}`);
    }
  });

  test('all three throws are reachable', () => {
    const seen = new Set();
    seen.add(withRolls([0.0],  () => randomThrow())); // rock
    seen.add(withRolls([0.34], () => randomThrow())); // paper
    seen.add(withRolls([0.67], () => randomThrow())); // scissors
    assertEqual(seen.size, 3, 'all three throws must be reachable');
  });

});

// ── randomCoinFlip ────────────────────────────────────────────────────────────

describe('randomCoinFlip', () => {

  test('roll 0.0 → heads (< 0.5)', () => {
    assertEqual(withRolls([0.0], () => randomCoinFlip()), 'heads');
  });

  test('roll 0.49 → heads (< 0.5)', () => {
    assertEqual(withRolls([0.49], () => randomCoinFlip()), 'heads');
  });

  test('roll 0.5 → tails (>= 0.5, boundary)', () => {
    assertEqual(withRolls([0.5], () => randomCoinFlip()), 'tails');
  });

  test('roll 0.99 → tails (>= 0.5)', () => {
    assertEqual(withRolls([0.99], () => randomCoinFlip()), 'tails');
  });

  test('returns only heads or tails', () => {
    const valid = new Set(['heads', 'tails']);
    for (const r of [0, 0.1, 0.49, 0.5, 0.9, 0.99]) {
      const result = withRolls([r], () => randomCoinFlip());
      assert(valid.has(result), `roll ${r} produced invalid result: ${result}`);
    }
  });

});

// ── POWERUP_CATALOG completeness ──────────────────────────────────────────────

describe('POWERUP_CATALOG completeness', () => {

  test('catalog contains exactly 37 powerups', () => {
    assertEqual(POWERUP_CATALOG.length, 37);
  });

  test('every catalog entry has required fields', () => {
    for (const p of POWERUP_CATALOG) {
      assert(p.name,            `missing name`);
      assert(p.tier,            `${p.name}: missing tier`);
      assert(p.scope,           `${p.name}: missing scope`);
      assert(p.tree,            `${p.name}: missing tree`);
      assert(p.effect,          `${p.name}: missing effect`);
      assert(p.activationPhase, `${p.name}: missing activationPhase`);
      assert(['Basic', 'Advanced', 'Legendary'].includes(p.tier),       `${p.name}: invalid tier`);
      assert(['round','match','tournament','season'].includes(p.scope),  `${p.name}: invalid scope`);
      assert(['either','gut_check'].includes(p.activationPhase),        `${p.name}: invalid activationPhase`);
    }
  });

  test('no duplicate names in catalog', () => {
    const names = POWERUP_CATALOG.map(p => p.name);
    const unique = new Set(names);
    assertEqual(unique.size, names.length, 'duplicate name detected');
  });

  test('tier distribution: 1 universal + 12 MIND + 12 MYSTIC + 12 FORTUNE', () => {
    const byTree = { UNIVERSAL: 0, MIND: 0, MYSTIC: 0, FORTUNE: 0 };
    for (const p of POWERUP_CATALOG) byTree[p.tree] = (byTree[p.tree] ?? 0) + 1;
    assertEqual(byTree.UNIVERSAL, 1,  'must be 1 universal powerup');
    assertEqual(byTree.MIND,      12, 'must be 12 MIND powerups');
    assertEqual(byTree.MYSTIC,    12, 'must be 12 MYSTIC powerups');
    assertEqual(byTree.FORTUNE,   12, 'must be 12 FORTUNE powerups');
  });

  test('Protein Shake is in POWERUP_IMPLEMENTED', () => {
    assert(POWERUP_IMPLEMENTED.has('Protein Shake'), 'Protein Shake must be implemented');
  });

  test('Jonesing to Help is in POWERUP_IMPLEMENTED', () => {
    assert(POWERUP_IMPLEMENTED.has('Jonesing to Help'), 'Jonesing to Help must be implemented');
  });

  test('POWERUP_NO_OP contains only Molasses and Padlock', () => {
    assertEqual(POWERUP_NO_OP.size, 2, 'exactly 2 no-op powerups');
    assert(POWERUP_NO_OP.has('Molasses'), 'Molasses must be no-op');
    assert(POWERUP_NO_OP.has('Padlock'),  'Padlock must be no-op');
    assert(!POWERUP_NO_OP.has('Clockwork Orange'), 'Clockwork Orange must NOT be no-op');
  });

  test('POWERUP_NO_OP is a subset of POWERUP_IMPLEMENTED', () => {
    for (const name of POWERUP_NO_OP) {
      assert(POWERUP_IMPLEMENTED.has(name),
        `${name} is in NO_OP but not in IMPLEMENTED`);
    }
  });

});

// ── Protein Shake — bonus drop condition ──────────────────────────────────────
// Mirrors the condition in match.js handleAdvanceFromReveal:
//   proteinShakeBonus = originalThrow !== null && currentThrow !== originalThrow && result === 'player'

describe('Protein Shake bonus drop condition', () => {

  function proteinShakeBonusFires(originalThrow, currentThrow, result) {
    return originalThrow !== null &&
           currentThrow !== originalThrow &&
           result === 'player';
  }

  test('fires when throw was changed and round won', () => {
    assert(proteinShakeBonusFires('rock', 'paper', 'player'));
  });

  test('does not fire when throw was not changed', () => {
    assert(!proteinShakeBonusFires('rock', 'rock', 'player'));
  });

  test('does not fire when round was lost', () => {
    assert(!proteinShakeBonusFires('rock', 'paper', 'opponent'));
  });

  test('does not fire when round tied', () => {
    assert(!proteinShakeBonusFires('rock', 'paper', 'tie'));
  });

  test('does not fire when not activated (null original)', () => {
    assert(!proteinShakeBonusFires(null, 'paper', 'player'));
  });

  test('bonus drop is 1 Basic from the player tree pool', () => {
    const treeMYSTIC = { MYSTIC: { 'MYSTIC.1': true } };
    const drops = withRolls([0.5, 0.5], () =>
      generateBonusDrops([{ tier: 'Basic', count: 1 }], treeMYSTIC));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].tier, 'Basic');
    assert(['MYSTIC', 'UNIVERSAL'].includes(drops[0].tree));
  });

});

// ── Jonesing to Help — match-start Advanced drop ──────────────────────────────

describe('Jonesing to Help — match-start Advanced drop', () => {

  const treeMYSTIC = { MYSTIC: { 'MYSTIC.1': true } };

  test('delivers exactly 1 Advanced drop', () => {
    const drops = withRolls([0.5, 0.5], () =>
      generateBonusDrops([{ tier: 'Advanced', count: 1 }], treeMYSTIC));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('drop comes from the MYSTIC pool (or UNIVERSAL)', () => {
    const drops = withRolls([0.5, 0.5], () =>
      generateBonusDrops([{ tier: 'Advanced', count: 1 }], treeMYSTIC));
    assert(['MYSTIC', 'UNIVERSAL'].includes(drops[0].tree),
      `unexpected tree: ${drops[0].tree}`);
  });

  test('drop has all required inventory fields', () => {
    const drops = withRolls([0.5, 0.5], () =>
      generateBonusDrops([{ tier: 'Advanced', count: 1 }], treeMYSTIC));
    const d = drops[0];
    assert(d.instanceId.startsWith('pu_'), 'instanceId must start with pu_');
    assert(d.name,  'must have name');
    assert(d.tier,  'must have tier');
    assert(d.tree,  'must have tree');
    assert(d.scope, 'must have scope');
  });

  test('Jonesing to Help catalog entry is jessieOnly and season-scoped', () => {
    const entry = POWERUP_CATALOG.find(p => p.name === 'Jonesing to Help');
    assert(entry,             'Jonesing to Help must be in catalog');
    assertEqual(entry.scope,  'season');
    assertEqual(entry.tree,   'MYSTIC');
    assert(entry.jessieOnly,  'must be jessieOnly');
  });

});
