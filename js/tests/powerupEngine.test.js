import { describe, test, assert, assertEqual } from './testRunner.js';
import { calcDropCount, generateDrops, getMaxSlots } from '../systems/powerupEngine.js';
import { setRollFn, resetRoll } from '../utils/rng.js';

// Helper: queue of roll values; excess rolls fall back to 0.5.
function withRolls(values, fn) {
  let i = 0;
  setRollFn(() => values[i++] ?? 0.5);
  try { return fn(); } finally { resetRoll(); }
}

// ── calcDropCount ─────────────────────────────────────────────────────────────

describe('calcDropCount', () => {

  test('round 1: 0 drops when roll is above 10%', () => {
    assertEqual(withRolls([0.15], () => calcDropCount(1)), 0);
  });

  test('round 1: 1 drop when roll is below 10%', () => {
    assertEqual(withRolls([0.05], () => calcDropCount(1)), 1);
  });

  test('round 3: 0 drops when roll is above 40%', () => {
    assertEqual(withRolls([0.50], () => calcDropCount(3)), 0);
  });

  test('round 3: 1 drop when roll is below 40%', () => {
    assertEqual(withRolls([0.30], () => calcDropCount(3)), 1);
  });

  test('round 5: 2 drops when fractional roll passes (0.50 < 0.60)', () => {
    // chance=1.60 → guaranteed 1, fractional 0.60; roll 0.50 → extra
    assertEqual(withRolls([0.50], () => calcDropCount(5)), 2);
  });

  test('round 5: 1 drop when fractional roll fails (0.70 >= 0.60)', () => {
    assertEqual(withRolls([0.70], () => calcDropCount(5)), 1);
  });

  test('round 6: 4 drops when fractional roll passes (0.10 < 0.20)', () => {
    // chance=3.20 → guaranteed 3, fractional 0.20; roll 0.10 → extra
    assertEqual(withRolls([0.10], () => calcDropCount(6)), 4);
  });

  test('round 6: 3 drops when fractional roll fails (0.25 >= 0.20)', () => {
    assertEqual(withRolls([0.25], () => calcDropCount(6)), 3);
  });

  test('fortuneMultiplier=2 doubles base chance', () => {
    // round 1 base 0.10 * 2 = 0.20; roll 0.15 < 0.20 → 1 drop
    assertEqual(withRolls([0.15], () => calcDropCount(1, 2)), 1);
  });

  test('unknown round returns 0 drops', () => {
    assertEqual(withRolls([0.01], () => calcDropCount(99)), 0);
  });

});

// ── generateDrops ─────────────────────────────────────────────────────────────

describe('generateDrops', () => {

  test('count 0 returns empty array', () => {
    const drops = withRolls([], () => generateDrops(0));
    assertEqual(drops.length, 0);
  });

  test('count 1: returns Changed My Mind, Basic, UNIVERSAL, round', () => {
    // Two rolls: tier upgrade (0.50 >= 0.10 → Basic), instanceId hex
    const drops = withRolls([0.50, 0.50], () => generateDrops(1));
    assertEqual(drops.length, 1);
    assertEqual(drops[0].name, 'Changed My Mind');
    assertEqual(drops[0].tier, 'Basic');
    assertEqual(drops[0].tree, 'UNIVERSAL');
    assertEqual(drops[0].scope, 'round');
    assert(drops[0].instanceId.startsWith('pu_'), 'instanceId starts with pu_');
  });

  test('tier upgrade to Advanced when roll < 10%', () => {
    const drops = withRolls([0.05, 0.50], () => generateDrops(1));
    assertEqual(drops[0].tier, 'Advanced');
  });

  test('count 3 returns 3 drops with distinct instanceIds', () => {
    const drops = withRolls(
      [0.50, 0.10, 0.50, 0.20, 0.50, 0.30],
      () => generateDrops(3)
    );
    assertEqual(drops.length, 3);
    const ids = new Set(drops.map(d => d.instanceId));
    assertEqual(ids.size, 3);
  });

  test('upgradeChanceMod stacks with base: total 0.25, roll 0.20 → Advanced', () => {
    const drops = withRolls([0.20, 0.50], () => generateDrops(1, 0.15));
    assertEqual(drops[0].tier, 'Advanced');
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

  test('returns 3 when MIND.1 is false', () => {
    assertEqual(getMaxSlots({ MIND: { 'MIND.1': false } }), 3);
  });

  test('returns 5 when MIND.1 is purchased', () => {
    assertEqual(getMaxSlots({ MIND: { 'MIND.1': true } }), 5);
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
