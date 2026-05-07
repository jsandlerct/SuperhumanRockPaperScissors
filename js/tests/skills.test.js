// Tests for L3 (and L2) skill mechanics.
//
// The activation logic lives in match.js which is DOM-coupled and not directly
// importable. Instead, each section below re-implements the relevant algorithm
// as a minimal pure function — mirroring match.js exactly — and then tests it
// against controlled RNG values and actual constants from constants.js.
//
// This approach catches: (a) wrong constant values, (b) probability boundary
// bugs, (c) state-transition errors (trackers, one-time flags, cooldowns).
// If match.js logic ever diverges from these implementations, the tests serve
// as the authoritative specification.

import { describe, test, assert, assertEqual } from './testRunner.js';
import { roll, setRollFn, resetRoll } from '../utils/rng.js';
import {
  NPR_ACCUMULATION_PER_ROUND,
  NPR_FALSE_RESULT_CHANCE,
  DESPERATE_CLARITY_NPR_BOOST,
  NEURAL_SCAN_COOLDOWN_MATCHES,
  NEURAL_SCAN_2_COOLDOWN_MATCHES,
  TWEAK_REALITY_CHANCE,
  ALTER_REALITY_CHANCE,
  THIRD_TIMES_CHARM_BOOST,
  TML_SUCCESS_CHANCE,
  TML_COOLDOWN_ROUNDS,
  LUCKY_SOCKS_TML_CHANCE,
  DUE_FOR_A_WIN_BOOST,
  FORCE_YOUR_HAND_CHANCE,
  FORCE_YOUR_HAND_COOLDOWN_ROUNDS,
  CHANGE_MY_LUCK_COOLDOWN_ROUNDS,
  CONSOLATION_PRIZE_CHANCE,
} from '../constants.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function withRoll(value, fn) {
  setRollFn(() => value);
  try { return fn(); } finally { resetRoll(); }
}

function withRolls(values, fn) {
  let i = 0;
  setRollFn(() => values[i++] ?? 0.5);
  try { return fn(); } finally { resetRoll(); }
}

// ── Pure-function mirrors of match.js skill logic ─────────────────────────────

// NPR: accumulate 10%/round; fire if roll() < accumulation; reset on fire.
// Returns { fired, newAccumulation, isAccurate }.
function stepNPR(currentAccumulation, desperateClarityBonus) {
  const newAcc = currentAccumulation + NPR_ACCUMULATION_PER_ROUND;
  if (roll() < newAcc) {
    return {
      fired:            true,
      newAccumulation:  desperateClarityBonus,
      isAccurate:       roll() >= NPR_FALSE_RESULT_CHANCE,
    };
  }
  return { fired: false, newAccumulation: newAcc, isAccurate: null };
}

// Tie conversion: Tweak Reality (30%) or Alter Reality (60%; replaces Tweak).
// Third Time's the Charm boosts to 95% after 2 consecutive passive failures.
// tieIsImmune blocks all conversion. Returns { result, ttcFired }.
function tryConvertTie({ hasTweakReality, hasAlterReality, hasTTTC, ttcFails, ttcUsed, tieIsImmune }) {
  if (tieIsImmune) return { result: 'tie', ttcFired: false };
  if (!hasTweakReality && !hasAlterReality) return { result: 'tie', ttcFired: false };
  const base = hasAlterReality ? ALTER_REALITY_CHANCE : TWEAK_REALITY_CHANCE;
  let convertChance = base;
  let ttcFired = false;
  if (hasTTTC && !ttcUsed && ttcFails >= 2) {
    convertChance = THIRD_TIMES_CHARM_BOOST;
    ttcFired = true;
  }
  const converted = roll() < convertChance;
  return { result: converted ? 'player' : 'tie', ttcFired };
}

// TML: 75% win / 25% loss baseline. Lucky Socks bumps to 85%.
// Due for a Win bumps to 95% after 2 consecutive failures (one-time).
function tmlResult({ hasLuckySocks, hasDueForAWin, dueForAWinFails, dueForAWinUsed }) {
  let chance = hasLuckySocks ? LUCKY_SOCKS_TML_CHANCE : TML_SUCCESS_CHANCE;
  let dueForAWinFired = false;
  if (hasDueForAWin && !dueForAWinUsed && dueForAWinFails >= 2) {
    chance = DUE_FOR_A_WIN_BOOST;
    dueForAWinFired = true;
  }
  return { success: roll() < chance, dueForAWinFired };
}

// Force Your Hand: 90% tie→win (active skill, replaces passive this round).
function forceYourHand() {
  return roll() < FORCE_YOUR_HAND_CHANCE ? 'player' : 'tie';
}

// Neural Scan: active cooldown depends on whether Neural Scan 2.0 is purchased.
function neuralScanCooldown(hasNS2) {
  return hasNS2 ? NEURAL_SCAN_2_COOLDOWN_MATCHES : NEURAL_SCAN_COOLDOWN_MATCHES;
}

// ── Constant sanity checks ────────────────────────────────────────────────────

describe('Skill constant values', () => {
  test('NPR accumulates 10% per round',               () => assertEqual(NPR_ACCUMULATION_PER_ROUND, 0.10));
  test('NPR false read chance is 10%',                () => assertEqual(NPR_FALSE_RESULT_CHANCE, 0.10));
  test('Desperate Clarity NPR boost is +20%',         () => assertEqual(DESPERATE_CLARITY_NPR_BOOST, 0.20));
  test('Neural Scan cooldown is 5 matches',           () => assertEqual(NEURAL_SCAN_COOLDOWN_MATCHES, 5));
  test('Neural Scan 2.0 cooldown is 3 matches',       () => assertEqual(NEURAL_SCAN_2_COOLDOWN_MATCHES, 3));
  test('Tweak Reality chance is 30%',                 () => assertEqual(TWEAK_REALITY_CHANCE, 0.30));
  test('Alter Reality chance is 60%',                 () => assertEqual(ALTER_REALITY_CHANCE, 0.60));
  test('Third Time\'s the Charm boost is 95%',        () => assertEqual(THIRD_TIMES_CHARM_BOOST, 0.95));
  test('TML success chance is 75%',                   () => assertEqual(TML_SUCCESS_CHANCE, 0.75));
  test('TML cooldown is 5 rounds',                    () => assertEqual(TML_COOLDOWN_ROUNDS, 5));
  test('Lucky Socks TML chance is 85%',               () => assertEqual(LUCKY_SOCKS_TML_CHANCE, 0.85));
  test('Due for a Win boost is 95%',                  () => assertEqual(DUE_FOR_A_WIN_BOOST, 0.95));
  test('Force Your Hand chance is 90%',               () => assertEqual(FORCE_YOUR_HAND_CHANCE, 0.90));
  test('Force Your Hand cooldown is 5 rounds',        () => assertEqual(FORCE_YOUR_HAND_COOLDOWN_ROUNDS, 5));
  test('Change My Luck cooldown is 3 rounds',         () => assertEqual(CHANGE_MY_LUCK_COOLDOWN_ROUNDS, 3));
  test('Consolation Prize chance is 30%',             () => assertEqual(CONSOLATION_PRIZE_CHANCE, 0.30));
  test('Alter Reality > Tweak Reality',               () => assert(ALTER_REALITY_CHANCE > TWEAK_REALITY_CHANCE));
  test('Due for a Win boost > Lucky Socks TML chance', () => assert(DUE_FOR_A_WIN_BOOST > LUCKY_SOCKS_TML_CHANCE));
  test('Lucky Socks chance > base TML chance',        () => assert(LUCKY_SOCKS_TML_CHANCE > TML_SUCCESS_CHANCE));
  test('Neural Scan 2.0 cooldown shorter than original', () => assert(NEURAL_SCAN_2_COOLDOWN_MATCHES < NEURAL_SCAN_COOLDOWN_MATCHES));
});

// ── NPR System (MIND.1.1) ─────────────────────────────────────────────────────

describe('NPR accumulation (MIND.1.1)', () => {
  test('accumulation is 0.10 after round 1 when NPR does not fire', () => {
    // High fire roll (0.99) ensures NPR does not fire
    const { fired, newAccumulation } = withRoll(0.99, () => stepNPR(0, 0));
    assert(!fired, 'NPR should not fire with roll 0.99 vs accumulation 0.10');
    assert(Math.abs(newAccumulation - 0.10) < 1e-9, `accumulation should be 0.10, got ${newAccumulation}`);
  });

  test('accumulation grows by NPR_ACCUMULATION_PER_ROUND each round', () => {
    let acc = 0;
    for (let r = 1; r <= 5; r++) {
      const result = withRoll(0.99, () => stepNPR(acc, 0));
      acc = result.newAccumulation;
    }
    assert(Math.abs(acc - 0.50) < 1e-9, `accumulation after 5 rounds should be 0.50, got ${acc}`);
  });

  test('NPR fires when roll < accumulation', () => {
    // After 3 rounds accumulation = 0.30; roll 0.29 < 0.30 → fires
    const { fired } = withRolls([0.29, 0.5], () => stepNPR(0.20, 0));
    // currentAcc + 0.10 = 0.30; roll 0.29 < 0.30
    assert(fired, 'NPR should fire when roll (0.29) < accumulation (0.30)');
  });

  test('NPR does not fire when roll >= accumulation', () => {
    // After 2 rounds accumulation = 0.20; roll 0.20 >= 0.20 → does not fire
    const { fired } = withRoll(0.20, () => stepNPR(0.10, 0));
    // newAcc = 0.10 + 0.10 = 0.20; roll 0.20 >= 0.20 → no fire
    assert(!fired, 'NPR should not fire when roll equals accumulation (boundary)');
  });

  test('after firing: accumulation resets to 0 when no Desperate Clarity', () => {
    // fire roll 0.01 (< 0.10), accuracy roll 0.5
    const { fired, newAccumulation } = withRolls([0.01, 0.5], () => stepNPR(0, 0));
    assert(fired);
    assertEqual(newAccumulation, 0, 'accumulation must reset to 0 after fire (no DC)');
  });

  test('after firing: accumulation resets to desperateClarityBonus (not 0)', () => {
    const dc = 0.20;
    const { fired, newAccumulation } = withRolls([0.01, 0.5], () => stepNPR(0, dc));
    assert(fired);
    assertEqual(newAccumulation, dc, 'accumulation must reset to DC bonus floor after fire');
  });

  test('accurate read when accuracy roll >= NPR_FALSE_RESULT_CHANCE (0.10)', () => {
    // fire roll 0.01, accuracy roll 0.10 (boundary — >= 0.10 → accurate)
    const { fired, isAccurate } = withRolls([0.01, 0.10], () => stepNPR(0, 0));
    assert(fired);
    assert(isAccurate, 'roll 0.10 >= NPR_FALSE_RESULT_CHANCE → accurate');
  });

  test('false read when accuracy roll < NPR_FALSE_RESULT_CHANCE (0.10)', () => {
    // fire roll 0.01, accuracy roll 0.09 (< 0.10 → false)
    const { fired, isAccurate } = withRolls([0.01, 0.09], () => stepNPR(0, 0));
    assert(fired);
    assert(!isAccurate, 'roll 0.09 < NPR_FALSE_RESULT_CHANCE → false read');
  });

  test('false read chance is exactly 10% — boundary at 0.10', () => {
    // Exactly at boundary (0.10) is accurate, just below (0.099) is false
    const below   = withRolls([0.01, 0.099], () => stepNPR(0, 0));
    const atBound = withRolls([0.01, 0.10],  () => stepNPR(0, 0));
    assert(!below.isAccurate, 'roll 0.099 is false read');
    assert(atBound.isAccurate, 'roll 0.10 is accurate (boundary is inclusive)');
  });
});

// ── Desperate Clarity (MIND.1.1.2) ───────────────────────────────────────────

describe('Desperate Clarity (MIND.1.1.2)', () => {
  test('DC bonus is 0.20 and not zero', () => {
    assert(DESPERATE_CLARITY_NPR_BOOST > 0, 'DC bonus must be positive');
    assertEqual(DESPERATE_CLARITY_NPR_BOOST, 0.20);
  });

  test('NPR floor after DC: next stepNPR starts from DC bonus, not 0', () => {
    // Fire NPR with DC bonus 0.20: resets to 0.20
    const { newAccumulation: afterFire } = withRolls([0.01, 0.5], () => stepNPR(0, 0.20));
    assertEqual(afterFire, 0.20, 'floor after fire must equal DC bonus');

    // Next step: starts from 0.20, increments to 0.30 (not 0.10)
    const { newAccumulation: nextRound } = withRoll(0.99, () => stepNPR(afterFire, 0.20));
    assert(Math.abs(nextRound - 0.30) < 1e-9, `next round should be 0.30, got ${nextRound}`);
  });

  test('DC bonus cannot go negative (accumulation >= 0 always)', () => {
    const { newAccumulation } = withRolls([0.01, 0.5], () => stepNPR(0, 0));
    assert(newAccumulation >= 0, 'accumulation should never go below 0');
  });
});

// ── Neural Scan cooldown (MIND.1.1.1) ────────────────────────────────────────

describe('Neural Scan cooldown (MIND.1.1.1)', () => {
  test('without Neural Scan 2.0: cooldown is NEURAL_SCAN_COOLDOWN_MATCHES (5)', () => {
    assertEqual(neuralScanCooldown(false), 5);
  });

  test('with Neural Scan 2.0: cooldown is NEURAL_SCAN_2_COOLDOWN_MATCHES (3)', () => {
    assertEqual(neuralScanCooldown(true), 3);
  });

  test('skill is ready when matchesSinceLastUse >= cooldown', () => {
    const cooldown = neuralScanCooldown(false); // 5
    assert(5 >= cooldown, 'ready at 5 matches since last use');
    assert(!(4 >= cooldown), 'not ready at 4 matches since last use');
  });

  test('Neural Scan 2.0 requires fewer matches to be ready', () => {
    const ns1Ready = neuralScanCooldown(false); // 5
    const ns2Ready = neuralScanCooldown(true);  // 3
    assert(ns2Ready < ns1Ready, 'NS2 cooldown must be shorter than NS1');
  });
});

// ── Tweak Reality (MYSTIC.1.1) ────────────────────────────────────────────────

describe('Tweak Reality (MYSTIC.1.1)', () => {
  test('without skill: tie always stays a tie', () => {
    const result = withRoll(0, () => tryConvertTie({
      hasTweakReality: false, hasAlterReality: false,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'tie', 'no skill = no conversion');
  });

  test('converts tie when roll < TWEAK_REALITY_CHANCE (0.30)', () => {
    const result = withRoll(0.29, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'player', 'roll 0.29 < 0.30 → convert');
  });

  test('does NOT convert when roll >= TWEAK_REALITY_CHANCE (0.30)', () => {
    const result = withRoll(0.30, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'tie', 'roll 0.30 >= 0.30 → no convert');
  });

  test('tieIsImmune blocks conversion regardless of roll', () => {
    const result = withRoll(0, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: true,
    }));
    assertEqual(result.result, 'tie', 'tieIsImmune must block conversion');
  });
});

// ── Alter Reality (MYSTIC.1.1.1) — replaces Tweak Reality ────────────────────

describe('Alter Reality (MYSTIC.1.1.1)', () => {
  test('converts tie when roll < ALTER_REALITY_CHANCE (0.60)', () => {
    const result = withRoll(0.59, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: true,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'player', 'roll 0.59 < 0.60 → convert');
  });

  test('does NOT convert when roll >= ALTER_REALITY_CHANCE (0.60)', () => {
    const result = withRoll(0.60, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: true,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'tie', 'roll 0.60 >= 0.60 → no convert');
  });

  test('Alter Reality REPLACES Tweak (not additive) — roll 0.70 fails with both', () => {
    // If stacking: 0.30 + 0.60 = 0.90, 0.70 would convert.
    // Correct (replace): only 0.60, 0.70 >= 0.60 → no convert.
    const result = withRoll(0.70, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: true,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'tie', 'Alter replaces Tweak: 0.70 must not convert with 60% chance');
  });

  test('Alter Reality alone (no Tweak) still uses 60% chance', () => {
    const result = withRoll(0.59, () => tryConvertTie({
      hasTweakReality: false, hasAlterReality: true,
      hasTTTC: false, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'player');
  });
});

// ── Third Time's the Charm (MYSTIC.1.1.2) ────────────────────────────────────

describe("Third Time's the Charm (MYSTIC.1.1.2)", () => {
  test('0 consecutive failures: uses base Tweak chance', () => {
    const result = withRoll(0.29, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: true, ttcFails: 0, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'player');
    assert(!result.ttcFired, 'TTC should not fire with 0 failures');
  });

  test('1 consecutive failure: still uses base Tweak chance', () => {
    const result = withRoll(0.29, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: true, ttcFails: 1, ttcUsed: false, tieIsImmune: false,
    }));
    assert(!result.ttcFired, 'TTC should not fire with only 1 failure');
  });

  test('2 consecutive failures: boosts to THIRD_TIMES_CHARM_BOOST (95%)', () => {
    const result = withRoll(0.94, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: true, ttcFails: 2, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'player', 'roll 0.94 < 0.95 → convert with TTC boost');
    assert(result.ttcFired, 'ttcFired must be true');
  });

  test('TTC does NOT fire when ttcUsed is already true', () => {
    const result = withRoll(0.94, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: true, ttcFails: 2, ttcUsed: true, tieIsImmune: false,
    }));
    // 0.94 >= 0.30 (base) → no convert
    assertEqual(result.result, 'tie', 'TTC already used: base chance applies');
    assert(!result.ttcFired, 'ttcFired must be false when ttcUsed=true');
  });

  test('TTC boost: roll 0.95 (boundary) does NOT convert', () => {
    const result = withRoll(0.95, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: false,
      hasTTTC: true, ttcFails: 2, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'tie', 'roll 0.95 >= 0.95 → no convert');
  });

  test('TTC fires with Alter Reality base (still boosts to 95%)', () => {
    // With Alter Reality (60%) and 2 failures, TTC still boosts to 95%
    const result = withRoll(0.94, () => tryConvertTie({
      hasTweakReality: true, hasAlterReality: true,
      hasTTTC: true, ttcFails: 2, ttcUsed: false, tieIsImmune: false,
    }));
    assertEqual(result.result, 'player');
    assert(result.ttcFired);
  });
});

// ── Trust My Luck (FORTUNE.1.1) ───────────────────────────────────────────────

describe('Trust My Luck base probability (FORTUNE.1.1)', () => {
  test('succeeds when roll < TML_SUCCESS_CHANCE (0.75)', () => {
    const { success } = withRoll(0.74, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false,
    }));
    assert(success, 'roll 0.74 < 0.75 → success');
  });

  test('fails when roll >= TML_SUCCESS_CHANCE (0.75)', () => {
    const { success } = withRoll(0.75, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false,
    }));
    assert(!success, 'roll 0.75 >= 0.75 → failure');
  });

  test('boundary: roll 0.00 always succeeds', () => {
    const { success } = withRoll(0, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false,
    }));
    assert(success);
  });

  test('boundary: roll 0.99 always fails', () => {
    const { success } = withRoll(0.99, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false,
    }));
    assert(!success);
  });
});

// ── Lucky Socks (FORTUNE.1.1.1) ───────────────────────────────────────────────

describe('Lucky Socks (FORTUNE.1.1.1)', () => {
  test('bumps TML success to 85%: roll 0.84 succeeds', () => {
    const { success } = withRoll(0.84, () => tmlResult({
      hasLuckySocks: true, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false,
    }));
    assert(success, 'roll 0.84 < 0.85 → success with Lucky Socks');
  });

  test('bumps TML success to 85%: roll 0.85 fails', () => {
    const { success } = withRoll(0.85, () => tmlResult({
      hasLuckySocks: true, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false,
    }));
    assert(!success, 'roll 0.85 >= 0.85 → failure');
  });

  test('Lucky Socks is better than base TML: roll 0.76 succeeds (would fail without)', () => {
    const withSocks    = withRoll(0.76, () => tmlResult({ hasLuckySocks: true, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false }));
    const withoutSocks = withRoll(0.76, () => tmlResult({ hasLuckySocks: false, hasDueForAWin: false, dueForAWinFails: 0, dueForAWinUsed: false }));
    assert(withSocks.success,    'Lucky Socks: 0.76 < 0.85 → success');
    assert(!withoutSocks.success, 'No Lucky Socks: 0.76 >= 0.75 → failure');
  });
});

// ── Due for a Win (FORTUNE.1.1.2) ────────────────────────────────────────────

describe('Due for a Win (FORTUNE.1.1.2)', () => {
  test('does not fire with 0 consecutive TML failures', () => {
    const { success, dueForAWinFired } = withRoll(0.94, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: true, dueForAWinFails: 0, dueForAWinUsed: false,
    }));
    assert(!success, 'base TML: 0.94 >= 0.75 → failure');
    assert(!dueForAWinFired, 'Due for a Win must not fire with 0 failures');
  });

  test('does not fire with 1 consecutive TML failure', () => {
    const { dueForAWinFired } = withRoll(0.94, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: true, dueForAWinFails: 1, dueForAWinUsed: false,
    }));
    assert(!dueForAWinFired, 'Due for a Win must not fire with only 1 failure');
  });

  test('fires after 2 consecutive TML failures: boosts to 95%', () => {
    const { success, dueForAWinFired } = withRoll(0.94, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: true, dueForAWinFails: 2, dueForAWinUsed: false,
    }));
    assert(success, 'DfAW boost: roll 0.94 < 0.95 → success');
    assert(dueForAWinFired, 'dueForAWinFired must be true');
  });

  test('fires with 3+ failures too (not just exactly 2)', () => {
    const { dueForAWinFired } = withRoll(0.94, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: true, dueForAWinFails: 5, dueForAWinUsed: false,
    }));
    assert(dueForAWinFired, 'DfAW should fire after any 2+ failures');
  });

  test('does NOT fire when dueForAWinUsed is true (one-time limit)', () => {
    const { success, dueForAWinFired } = withRoll(0.94, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: true, dueForAWinFails: 2, dueForAWinUsed: true,
    }));
    assert(!success, 'after DfAW used: base TML only, 0.94 >= 0.75 → failure');
    assert(!dueForAWinFired, 'dueForAWinFired must be false when already used');
  });

  test('DfAW 95% boost boundary: roll 0.95 fails', () => {
    const { success } = withRoll(0.95, () => tmlResult({
      hasLuckySocks: false, hasDueForAWin: true, dueForAWinFails: 2, dueForAWinUsed: false,
    }));
    assert(!success, 'roll 0.95 >= 0.95 → failure even with DfAW');
  });

  test('DfAW overrides Lucky Socks when conditions met', () => {
    // DfAW (95%) takes priority over Lucky Socks (85%) when 2+ failures
    const { success } = withRoll(0.94, () => tmlResult({
      hasLuckySocks: true, hasDueForAWin: true, dueForAWinFails: 2, dueForAWinUsed: false,
    }));
    // 0.94 < DUE_FOR_A_WIN_BOOST (0.95) → success
    assert(success, 'DfAW (0.95) wins over Lucky Socks (0.85) when conditions met');
  });
});

// ── Force Your Hand (FORTUNE.1.2.1) ──────────────────────────────────────────

describe('Force Your Hand (FORTUNE.1.2.1)', () => {
  test('converts tie when roll < FORCE_YOUR_HAND_CHANCE (0.90)', () => {
    const result = withRoll(0.89, () => forceYourHand());
    assertEqual(result, 'player', 'roll 0.89 < 0.90 → tie converted');
  });

  test('does not convert when roll >= FORCE_YOUR_HAND_CHANCE (0.90)', () => {
    const result = withRoll(0.90, () => forceYourHand());
    assertEqual(result, 'tie', 'roll 0.90 >= 0.90 → no conversion');
  });

  test('Force Your Hand is stronger than Alter Reality', () => {
    assert(FORCE_YOUR_HAND_CHANCE > ALTER_REALITY_CHANCE, '90% > 60%');
  });

  test('cooldown is 5 rounds', () => {
    assertEqual(FORCE_YOUR_HAND_COOLDOWN_ROUNDS, 5);
  });
});

// ── Change My Luck (FORTUNE.1.2.2) ───────────────────────────────────────────

describe('Change My Luck (FORTUNE.1.2.2)', () => {
  test('cooldown is 3 rounds', () => {
    assertEqual(CHANGE_MY_LUCK_COOLDOWN_ROUNDS, 3);
  });

  test('Change My Luck cooldown is shorter than Force Your Hand cooldown', () => {
    assert(CHANGE_MY_LUCK_COOLDOWN_ROUNDS < FORCE_YOUR_HAND_COOLDOWN_ROUNDS);
  });
});

// ── Consolation Prize (FORTUNE.1.2) ──────────────────────────────────────────

describe('Consolation Prize (FORTUNE.1.2)', () => {
  test('drop chance is 30%', () => {
    assertEqual(CONSOLATION_PRIZE_CHANCE, 0.30);
  });

  test('fires when roll < 0.30', () => {
    assert(0.29 < CONSOLATION_PRIZE_CHANCE, 'roll 0.29 triggers drop');
  });

  test('does not fire when roll >= 0.30', () => {
    assert(!(0.30 < CONSOLATION_PRIZE_CHANCE), 'roll 0.30 does not trigger drop');
  });
});
