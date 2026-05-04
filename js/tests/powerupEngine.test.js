import { describe, test, assert, assertEqual } from './testRunner.js';
import {
  calcDropCount, generateDrops, getMaxSlots,
  getDropMultiplier, getUpgradeBonus, getDropPool,
  generateStartingLoadout,
} from '../systems/powerupEngine.js';
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

});
