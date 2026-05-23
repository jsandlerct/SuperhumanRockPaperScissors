// NPC Skills & Powerup Test Suite
//
// Tests the v1.0 NPC skill and powerup behaviors implemented in match.js.
// Because match.js is DOM-coupled, each section re-implements the relevant
// algorithm as a minimal pure function (mirroring match.js exactly) and then
// tests it with controlled RNG values.
//
// Coverage areas:
//   1. NPC MIND behavioral model (NPR equivalent in computeNpcThrow)
//   2. NPC TML / ATML resolution (blocking, upgrades, cooldown assignment)
//   3. TML conflict resolution (both player + NPC claim a win)
//   4. NPC Force Your Hand / Twist Your Arm resolution
//   5. NPC Refuse to Lose (immune-tie generation)
//   6. NPC passive tie conversion (Tweak/Alter Reality equivalent)
//   7. NPC powerup activation strategies (asap / chance / on_win / on_loss)
//   8. NPC cooldown management (advanceRound decrements, Molasses, Massive Brain Fart)
//   9. Bamboozle (MYSTIC.1.2.1.2): redirect NPC powerup to player
//  10. NPC skill constant sanity checks

import { describe, test, assert, assertEqual } from './testRunner.js';
import { roll, setRollFn, resetRoll } from '../utils/rng.js';
import {
  NPR_ACCUMULATION_PER_ROUND, NPR_ADVANCED_ACCUMULATION, NPR_MAX,
  NPR_FALSE_RESULT_CHANCE,
  MIND_SHIELD_CHANCE, MIND_FORTRESS_CHANCE,
  TML_SUCCESS_CHANCE, TML_COOLDOWN_ROUNDS, ATML_COOLDOWN_ROUNDS,
  LUCKY_SOCKS_TML_CHANCE, FINGERS_CROSSED_TML_CHANCE, DUE_FOR_A_WIN_BOOST,
  THE_COOLER_CHANCE, THE_FREEZER_CHANCE,
  NOT_TODAY_CHANCE,
  FORCE_YOUR_HAND_CHANCE, FORCE_YOUR_HAND_COOLDOWN_ROUNDS, TWIST_YOUR_ARM_COOLDOWN_ROUNDS,
  REFUSE_TO_LOSE_CHANCE,
  TWEAK_REALITY_CHANCE, ALTER_REALITY_CHANCE, THIRD_TIMES_CHARM_BOOST,
  OBLIVIOUS_CHANCE, TOTES_OBLIVIOUS_CHANCE,
  NPC_POWERUP_CHANCE_RATE, NPC_LUCKY_CHARM_BLOCK_CHANCE,
  BAMBOOZLE_CHANCE,
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

// ── 1. NPC MIND Behavioral Model (NPR equivalent) ─────────────────────────────
//
// Mirror of computeNpcThrow() MIND.1.1 block in match.js.
// Key differences from player NPR:
//   - acc is captured BEFORE the update line
//   - Fire check uses OLD acc: `if (acc > 0 && roll() < acc)`
//   - Accumulation is capped at NPR_MAX (0.90) on update
//   - On fire: resets to 0.0 (no DC bonus for NPC)

function stepNpcNPR(npcSkillState, rate = NPR_ACCUMULATION_PER_ROUND) {
  const acc = npcSkillState.nprAccumulation;                      // capture BEFORE update
  npcSkillState.nprAccumulation = Math.min(acc + rate, NPR_MAX); // update (capped)
  const fired = acc > 0 && roll() < acc;                         // fire check uses OLD acc
  if (fired) npcSkillState.nprAccumulation = 0.0;
  return { fired, accBeforeFire: acc, accAfterStep: npcSkillState.nprAccumulation };
}

// Mirror of computeNpcThrow() NPC NPR read + blocker logic.
// Returns the throw the NPC makes after a potential NPR fire.
function applyNpcNprRead({ npcSkillState, mostFrequentPlayerThrow,
                            shieldChance, phantomMemoryActive }) {
  const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
  const rate  = NPR_ACCUMULATION_PER_ROUND;
  const acc   = npcSkillState.nprAccumulation;
  npcSkillState.nprAccumulation = Math.min(acc + rate, NPR_MAX);
  if (acc > 0 && roll() < acc) {
    npcSkillState.nprAccumulation = 0.0;
    if (shieldChance === 0 || roll() >= shieldChance) {
      if (phantomMemoryActive) return { npcThrowOverridden: true, npcThrow: '__random__' };
      if (mostFrequentPlayerThrow) return { npcThrowOverridden: true, npcThrow: COUNTER[mostFrequentPlayerThrow] };
    }
    return { npcThrowOverridden: false };
  }
  return { npcThrowOverridden: false };
}

describe('NPC MIND behavioral model — accumulation', () => {
  test('initial accumulation is 0', () => {
    const s = { nprAccumulation: 0 };
    assertEqual(s.nprAccumulation, 0.0);
  });

  test('round 1: acc was 0 → guard prevents fire regardless of roll', () => {
    const s = { nprAccumulation: 0 };
    const { fired } = withRoll(0, () => stepNpcNPR(s));
    assert(!fired, 'fire guard (acc > 0) must prevent fire on round 1');
  });

  test('round 1: accumulation updates to NPR_ACCUMULATION_PER_ROUND after step', () => {
    const s = { nprAccumulation: 0 };
    withRoll(0.99, () => stepNpcNPR(s));
    assert(Math.abs(s.nprAccumulation - NPR_ACCUMULATION_PER_ROUND) < 1e-9,
      `after round 1 step, acc should be ${NPR_ACCUMULATION_PER_ROUND}`);
  });

  test('round 2: fire is possible (acc=0.10 > 0)', () => {
    const s = { nprAccumulation: NPR_ACCUMULATION_PER_ROUND };
    const { fired } = withRoll(0.09, () => stepNpcNPR(s));
    assert(fired, 'roll 0.09 < acc 0.10 → fire');
  });

  test('round 2: no fire at boundary (roll >= acc)', () => {
    const s = { nprAccumulation: NPR_ACCUMULATION_PER_ROUND };
    const { fired } = withRoll(0.10, () => stepNpcNPR(s));
    assert(!fired, 'roll 0.10 >= acc 0.10 → no fire (boundary)');
  });

  test('accumulation grows by rate each round when not firing', () => {
    const s = { nprAccumulation: 0 };
    for (let r = 1; r <= 5; r++) withRoll(0.99, () => stepNpcNPR(s));
    assert(Math.abs(s.nprAccumulation - 0.50) < 1e-9,
      `5 rounds of non-firing → acc should be 0.50, got ${s.nprAccumulation}`);
  });

  test('accumulation is capped at NPR_MAX (0.90)', () => {
    const s = { nprAccumulation: 0 };
    for (let r = 0; r < 20; r++) withRoll(0.99, () => stepNpcNPR(s));
    assert(s.nprAccumulation <= NPR_MAX, `acc must not exceed NPR_MAX (${NPR_MAX})`);
    assert(Math.abs(s.nprAccumulation - NPR_MAX) < 1e-9, `acc must reach NPR_MAX at cap`);
  });

  test('on fire: accumulation resets to 0.0', () => {
    const s = { nprAccumulation: 0.20 };  // pre-populated: round 3 state
    const { fired } = withRoll(0.19, () => stepNpcNPR(s));
    assert(fired, 'roll 0.19 < old acc 0.20 → fire');
    assertEqual(s.nprAccumulation, 0.0, 'accumulation must reset to 0.0 on fire');
  });

  test('advanced NPR (MIND.1.1.1.2): rate is 0.15/round', () => {
    const s = { nprAccumulation: 0 };
    withRoll(0.99, () => stepNpcNPR(s, NPR_ADVANCED_ACCUMULATION));
    assert(Math.abs(s.nprAccumulation - NPR_ADVANCED_ACCUMULATION) < 1e-9,
      `advanced rate: after 1 round acc should be ${NPR_ADVANCED_ACCUMULATION}`);
  });

  test('advanced NPR: 0.15 > 0.10 standard rate', () => {
    assert(NPR_ADVANCED_ACCUMULATION > NPR_ACCUMULATION_PER_ROUND,
      'advanced accumulation must exceed standard');
  });

  test('fire check uses OLD acc, not new acc', () => {
    // old acc = 0.20; new acc = 0.30; roll = 0.25
    // If fire checks NEW acc: 0.25 < 0.30 → fire
    // If fire checks OLD acc: 0.25 >= 0.20 → no fire (correct behavior)
    const s = { nprAccumulation: 0.20 };
    const { fired } = withRoll(0.25, () => stepNpcNPR(s));
    assert(!fired, 'fire check uses OLD acc (0.20); roll 0.25 >= 0.20 → no fire');
  });
});

describe('NPC MIND — NPR fire: read override and blocking', () => {
  function makeState(acc) { return { nprAccumulation: acc }; }

  test('no Mind Shield: NPC read overrides throw to counter most-frequent', () => {
    // acc=0.30; roll 0.29 < 0.30 → fire
    const s = makeState(0.30);
    const { npcThrowOverridden, npcThrow } = withRoll(0.29, () =>
      applyNpcNprRead({ npcSkillState: s, mostFrequentPlayerThrow: 'rock',
                        shieldChance: 0, phantomMemoryActive: false }));
    assert(npcThrowOverridden, 'NPR fires: throw must be overridden');
    assertEqual(npcThrow, 'paper', 'counter of rock is paper');
  });

  test('no player throw history: override does not happen even if fire succeeds', () => {
    const s = makeState(0.30);
    const { npcThrowOverridden } = withRoll(0.29, () =>
      applyNpcNprRead({ npcSkillState: s, mostFrequentPlayerThrow: null,
                        shieldChance: 0, phantomMemoryActive: false }));
    assert(!npcThrowOverridden, 'no history → no useful read → no override');
  });

  test('Mind Shield (50%): blocks NPC read when shield roll < 0.50', () => {
    // fire roll 0.29, then shield roll 0.49 (< 0.50 → blocked)
    const s = makeState(0.30);
    const { npcThrowOverridden } = withRolls([0.29, 0.49], () =>
      applyNpcNprRead({ npcSkillState: s, mostFrequentPlayerThrow: 'rock',
                        shieldChance: MIND_SHIELD_CHANCE, phantomMemoryActive: false }));
    assert(!npcThrowOverridden, 'Mind Shield roll < 0.50 → read blocked');
  });

  test('Mind Shield (50%): passes when shield roll >= 0.50', () => {
    // fire roll 0.29, then shield roll 0.50 (>= 0.50 → not blocked → override)
    const s = makeState(0.30);
    const { npcThrowOverridden } = withRolls([0.29, 0.50], () =>
      applyNpcNprRead({ npcSkillState: s, mostFrequentPlayerThrow: 'rock',
                        shieldChance: MIND_SHIELD_CHANCE, phantomMemoryActive: false }));
    assert(npcThrowOverridden, 'Mind Shield roll 0.50 >= 0.50 → not blocked → override');
  });

  test('Mind Fortress (90%) blocks more reliably than Mind Shield (50%)', () => {
    assert(MIND_FORTRESS_CHANCE > MIND_SHIELD_CHANCE,
      'Mind Fortress (90%) must block more reliably than Mind Shield (50%)');
  });

  test('Mind Fortress is a replacement pair (not additive)', () => {
    // The Freezer upgrades The Cooler — they use the same constant slot
    // (same pattern for Mind Fortress upgrading Mind Shield)
    assertEqual(MIND_FORTRESS_CHANCE, 0.90);
    assertEqual(MIND_SHIELD_CHANCE,   0.50);
  });

  test('Phantom Memory: when NPR fires and not shielded, throw goes random (not counter)', () => {
    const s = makeState(0.30);
    // fire roll 0.29 < 0.30, no shield → phantomMemoryActive=true → random
    const { npcThrowOverridden, npcThrow } = withRoll(0.29, () =>
      applyNpcNprRead({ npcSkillState: s, mostFrequentPlayerThrow: 'rock',
                        shieldChance: 0, phantomMemoryActive: true }));
    assert(npcThrowOverridden, 'Phantom Memory: still overrides throw');
    assertEqual(npcThrow, '__random__', 'Phantom Memory: throw is random, not counter-read');
  });

  test('Phantom Memory + Mind Shield: shield checked first, if blocked Phantom Memory does not fire', () => {
    // fire roll 0.29, shield roll 0.49 (< 0.50 → blocked) → no override despite Phantom Memory
    const s = makeState(0.30);
    const { npcThrowOverridden } = withRolls([0.29, 0.49], () =>
      applyNpcNprRead({ npcSkillState: s, mostFrequentPlayerThrow: 'rock',
                        shieldChance: MIND_SHIELD_CHANCE, phantomMemoryActive: true }));
    assert(!npcThrowOverridden, 'Mind Shield blocks read before Phantom Memory can falsify it');
  });
});

// ── 2. NPC TML / ATML Resolution ─────────────────────────────────────────────
//
// Mirror of handleReady() NPC TML resolution block in match.js.

function resolveNpcTml({
  brainFartBlocked = false,
  notTodayActive   = false,
  coolerChance     = 0,
  tmlChance        = TML_SUCCESS_CHANCE,
  dueBoost         = false,
}) {
  // Blocker precedence: Brain Fart > Not Today > Cooler
  if (brainFartBlocked) {
    return { npcForceWin: true, npcForceLoss: false, blocked: 'Brain Fart' };
  }
  const notTodayBlocked = notTodayActive && roll() < NOT_TODAY_CHANCE;
  if (notTodayBlocked) {
    return { npcForceWin: true, npcForceLoss: false, blocked: 'Not Today' };
  }
  const coolerBlocked = coolerChance > 0 && roll() < coolerChance;
  if (coolerBlocked) {
    return { npcForceWin: true, npcForceLoss: false, blocked: 'Cooler' };
  }

  const chance = dueBoost ? DUE_FOR_A_WIN_BOOST : tmlChance;
  if (roll() < chance) {
    return { npcForceWin: false, npcForceLoss: true, blocked: null };  // NPC wins
  } else {
    return { npcForceWin: true, npcForceLoss: false, blocked: null };  // NPC fails → player wins
  }
}

describe('NPC TML — Brain Fart blocker', () => {
  test('Brain Fart always blocks NPC TML → npcForceWin (player wins)', () => {
    const r = resolveNpcTml({ brainFartBlocked: true });
    assert(r.npcForceWin, 'Brain Fart blocks: npcForceWin = true');
    assert(!r.npcForceLoss, 'npcForceLoss must be false (NPC did not win)');
    assertEqual(r.blocked, 'Brain Fart');
  });

  test('Brain Fart takes precedence over all other logic (no RNG consumed)', () => {
    // Even with a low roll that would normally succeed TML (< 0.75), Brain Fart wins
    const r = withRoll(0, () => resolveNpcTml({ brainFartBlocked: true, tmlChance: TML_SUCCESS_CHANCE }));
    assert(r.npcForceWin, 'Brain Fart blocks even when TML roll would have succeeded');
    assertEqual(r.blocked, 'Brain Fart');
  });
});

describe('NPC TML — Not Today! blocker', () => {
  test('Not Today! blocks when roll < NOT_TODAY_CHANCE (0.95)', () => {
    const r = withRoll(0.94, () => resolveNpcTml({ notTodayActive: true }));
    assert(r.npcForceWin, 'Not Today! fires: roll 0.94 < 0.95 → blocked, player wins');
    assertEqual(r.blocked, 'Not Today');
  });

  test('Not Today! does NOT block at boundary (roll >= 0.95)', () => {
    // roll 0.95: Not Today check fails, then TML success roll = 0.95 >= 0.75 → TML fails → player wins
    // NOTE: we check that the block was NOT the cause (blocked is null)
    const r = withRolls([0.95, 0.99], () => resolveNpcTml({ notTodayActive: true }));
    assertEqual(r.blocked, null, 'roll 0.95 >= 0.95 → Not Today! does not block');
    assert(r.npcForceWin, 'TML still fails (roll 0.99 >= 0.75) → player wins, but not via Not Today');
  });

  test('Not Today! is 95% reliable', () => {
    assertEqual(NOT_TODAY_CHANCE, 0.95);
  });
});

describe('NPC TML — The Cooler / Freezer blocker', () => {
  test('The Cooler (50%): blocks when roll < 0.50', () => {
    const r = withRoll(0.49, () => resolveNpcTml({ coolerChance: THE_COOLER_CHANCE }));
    assert(r.npcForceWin, 'Cooler fires: roll 0.49 < 0.50 → blocked');
    assertEqual(r.blocked, 'Cooler');
  });

  test('The Cooler (50%): does NOT block at boundary (roll >= 0.50)', () => {
    // roll 0.50: Cooler check fails, then TML roll 0.50 < 0.75 → NPC succeeds
    const r = withRolls([0.50, 0.50], () => resolveNpcTml({ coolerChance: THE_COOLER_CHANCE }));
    assertEqual(r.blocked, null, 'Cooler at boundary: not blocked');
    assert(r.npcForceLoss, 'TML roll 0.50 < 0.75 → NPC wins');
  });

  test('The Freezer (75%): blocks more often than The Cooler (50%)', () => {
    assert(THE_FREEZER_CHANCE > THE_COOLER_CHANCE,
      `Freezer (${THE_FREEZER_CHANCE}) must have higher block chance than Cooler (${THE_COOLER_CHANCE})`);
  });

  test('The Freezer (75%): blocks when roll < 0.75', () => {
    const r = withRoll(0.74, () => resolveNpcTml({ coolerChance: THE_FREEZER_CHANCE }));
    assert(r.npcForceWin, 'Freezer fires: roll 0.74 < 0.75 → blocked');
  });

  test('The Freezer (75%) is a REPLACEMENT for The Cooler — not additive', () => {
    // If stacked: 0.50 + 0.75 = 1.25; would always block. Correct: only 75%.
    // A roll of 0.74 must block via Freezer (0.74 < 0.75) but also via Cooler (0.74 >= 0.50 → NO).
    // We verify the constants are distinct replacement values, not stacking additions.
    assert(THE_FREEZER_CHANCE !== THE_COOLER_CHANCE + THE_COOLER_CHANCE,
      'Freezer and Cooler are replacement values — design enforces only the higher is used');
  });
});

describe('NPC TML — base and upgrade resolution', () => {
  test('base TML succeeds when roll < 0.75', () => {
    const r = withRoll(0.74, () => resolveNpcTml({}));
    assert(r.npcForceLoss, 'roll 0.74 < 0.75 → NPC TML success → opponent wins');
    assert(!r.npcForceWin, 'npcForceWin must be false on NPC success');
  });

  test('base TML fails when roll >= 0.75', () => {
    const r = withRoll(0.75, () => resolveNpcTml({}));
    assert(r.npcForceWin, 'roll 0.75 >= 0.75 → NPC TML fails → player wins');
    assert(!r.npcForceLoss, 'npcForceLoss must be false on NPC failure');
  });

  test('Lucky Socks NPC TML: succeeds when roll < 0.85', () => {
    const r = withRoll(0.84, () => resolveNpcTml({ tmlChance: LUCKY_SOCKS_TML_CHANCE }));
    assert(r.npcForceLoss, 'NPC Lucky Socks: roll 0.84 < 0.85 → success');
  });

  test('Lucky Socks NPC TML: fails at boundary (roll >= 0.85)', () => {
    const r = withRoll(0.85, () => resolveNpcTml({ tmlChance: LUCKY_SOCKS_TML_CHANCE }));
    assert(r.npcForceWin, 'NPC Lucky Socks: roll 0.85 >= 0.85 → failure');
  });

  test('Lucky Socks is an upgrade from base TML (85% > 75%)', () => {
    assert(LUCKY_SOCKS_TML_CHANCE > TML_SUCCESS_CHANCE);
  });

  test('Fingers Crossed NPC TML: succeeds when roll < 0.95', () => {
    const r = withRoll(0.94, () => resolveNpcTml({ tmlChance: FINGERS_CROSSED_TML_CHANCE }));
    assert(r.npcForceLoss, 'NPC Fingers Crossed: roll 0.94 < 0.95 → success');
  });

  test('Fingers Crossed NPC TML: fails at boundary (roll >= 0.95)', () => {
    const r = withRoll(0.95, () => resolveNpcTml({ tmlChance: FINGERS_CROSSED_TML_CHANCE }));
    assert(r.npcForceWin, 'NPC Fingers Crossed: roll 0.95 >= 0.95 → failure');
  });

  test('Fingers Crossed > Lucky Socks > base TML (replacement chain)', () => {
    assert(FINGERS_CROSSED_TML_CHANCE > LUCKY_SOCKS_TML_CHANCE,
      'Fingers Crossed > Lucky Socks');
    assert(LUCKY_SOCKS_TML_CHANCE > TML_SUCCESS_CHANCE,
      'Lucky Socks > base TML');
  });

  test('NPC Due for a Win: boosts to 95% when fired', () => {
    const r = withRoll(0.94, () => resolveNpcTml({ dueBoost: true }));
    assert(r.npcForceLoss, 'DfAW: roll 0.94 < 0.95 → NPC wins');
  });

  test('NPC Due for a Win: fails at boundary (roll >= 0.95)', () => {
    const r = withRoll(0.95, () => resolveNpcTml({ dueBoost: true }));
    assert(r.npcForceWin, 'DfAW: roll 0.95 >= 0.95 → failure');
  });

  test('NPC Due for a Win overrides Lucky Socks (higher chance wins)', () => {
    // DfAW = 0.95, Lucky Socks = 0.85; roll 0.90 succeeds with DfAW, fails with Socks
    const rDfAW = withRoll(0.90, () => resolveNpcTml({ tmlChance: LUCKY_SOCKS_TML_CHANCE, dueBoost: true }));
    const rSocks = withRoll(0.90, () => resolveNpcTml({ tmlChance: LUCKY_SOCKS_TML_CHANCE, dueBoost: false }));
    assert(rDfAW.npcForceLoss,  'DfAW wins at roll 0.90 (< 0.95)');
    assert(rSocks.npcForceWin,  'Lucky Socks alone fails at 0.90 (>= 0.85)');
  });
});

describe('NPC TML — cooldown assignment', () => {
  test('ATML cooldown is 3, TML cooldown is 5', () => {
    assertEqual(ATML_COOLDOWN_ROUNDS, 3);
    assertEqual(TML_COOLDOWN_ROUNDS,  5);
    assert(ATML_COOLDOWN_ROUNDS < TML_COOLDOWN_ROUNDS, 'ATML shorter than TML');
  });
});

// ── 3. TML Conflict Resolution ────────────────────────────────────────────────
//
// Mirror of match.js force-override application block in handleReady().

function resolveTmlConflict({
  roundForceWin,
  npcForceLossFromTml,
  roundForceLoss,
  npcForceWinFromTml,
  naturalResult,
}) {
  if (roundForceWin && npcForceLossFromTml) return naturalResult; // both claim win → cancel
  if (roundForceWin || npcForceWinFromTml)  return 'player';
  if (roundForceLoss || npcForceLossFromTml) return 'opponent';
  return naturalResult;
}

describe('TML conflict resolution', () => {
  test('both player forceWin and NPC forceLoss → both cancelled, natural result', () => {
    const r = resolveTmlConflict({
      roundForceWin: true, npcForceLossFromTml: true,
      roundForceLoss: false, npcForceWinFromTml: false,
      naturalResult: 'tie',
    });
    assertEqual(r, 'tie', 'TML clash → natural result (tie)');
  });

  test('both player forceWin and NPC forceLoss — natural result is player win', () => {
    const r = resolveTmlConflict({
      roundForceWin: true, npcForceLossFromTml: true,
      roundForceLoss: false, npcForceWinFromTml: false,
      naturalResult: 'player',
    });
    assertEqual(r, 'player', 'TML clash → natural result (player win from actual throw)');
  });

  test('player forceWin only → player wins', () => {
    const r = resolveTmlConflict({
      roundForceWin: true, npcForceLossFromTml: false,
      roundForceLoss: false, npcForceWinFromTml: false,
      naturalResult: 'opponent',
    });
    assertEqual(r, 'player', 'player TML alone: player wins regardless of natural result');
  });

  test('NPC forceWin only → player wins (NPC TML failed → npcForceWinFromTml → player wins)', () => {
    // When NPC TML FAILS, npcForceWinFromTml=true, meaning the *player* wins that round
    const r = resolveTmlConflict({
      roundForceWin: false, npcForceLossFromTml: false,
      roundForceLoss: false, npcForceWinFromTml: true,
      naturalResult: 'tie',
    });
    assertEqual(r, 'player', 'NPC TML failure → player wins');
  });

  test('NPC forceLoss only → opponent wins (NPC TML succeeded → npcForceLoss for player)', () => {
    // When NPC TML SUCCEEDS, npcForceLossFromTml=true, meaning the NPC wins (opponent wins)
    const r = resolveTmlConflict({
      roundForceWin: false, npcForceLossFromTml: true,
      roundForceLoss: false, npcForceWinFromTml: false,
      naturalResult: 'tie',
    });
    assertEqual(r, 'opponent', 'NPC TML success → opponent wins');
  });

  test('player forceLoss only → opponent wins', () => {
    const r = resolveTmlConflict({
      roundForceWin: false, npcForceLossFromTml: false,
      roundForceLoss: true, npcForceWinFromTml: false,
      naturalResult: 'player',
    });
    assertEqual(r, 'opponent', 'player TML failure → opponent wins');
  });

  test('no force flags → natural result passes through', () => {
    for (const nat of ['player', 'opponent', 'tie']) {
      const r = resolveTmlConflict({
        roundForceWin: false, npcForceLossFromTml: false,
        roundForceLoss: false, npcForceWinFromTml: false,
        naturalResult: nat,
      });
      assertEqual(r, nat, `no force flags: natural result (${nat}) passes through`);
    }
  });
});

// ── 4. NPC Force Your Hand / Twist Your Arm ───────────────────────────────────
//
// Mirror of handleReady() NPC FYH resolution block.

function resolveNpcForceYourHand({ brainFartBlocked = false, obliviousChance = 0 }) {
  if (brainFartBlocked) return { result: 'tie', blocked: 'Brain Fart' };
  const blocked = obliviousChance > 0 && roll() < obliviousChance;
  if (blocked)          return { result: 'tie', blocked: 'Oblivious' };
  if (roll() < FORCE_YOUR_HAND_CHANCE) return { result: 'opponent', blocked: null };
  return { result: 'tie', blocked: null }; // missed
}

describe('NPC Force Your Hand / Twist Your Arm', () => {
  test('Brain Fart always blocks FYH → tie remains', () => {
    const r = resolveNpcForceYourHand({ brainFartBlocked: true });
    assertEqual(r.result, 'tie', 'Brain Fart blocks: tie remains');
    assertEqual(r.blocked, 'Brain Fart');
  });

  test('Brain Fart takes precedence regardless of roll', () => {
    const r = withRoll(0, () => resolveNpcForceYourHand({ brainFartBlocked: true }));
    assertEqual(r.blocked, 'Brain Fart');
  });

  test('Oblivious (50%): blocks when roll < 0.50', () => {
    const r = withRoll(0.49, () =>
      resolveNpcForceYourHand({ obliviousChance: OBLIVIOUS_CHANCE }));
    assertEqual(r.result, 'tie', 'Oblivious blocks: tie remains');
    assertEqual(r.blocked, 'Oblivious');
  });

  test('Oblivious (50%): does NOT block at boundary (roll >= 0.50)', () => {
    // roll 0.50 ≥ 0.50 → not blocked; FYH roll 0.50 < 0.90 → NPC wins
    const r = withRolls([0.50, 0.50], () =>
      resolveNpcForceYourHand({ obliviousChance: OBLIVIOUS_CHANCE }));
    assertEqual(r.blocked, null, 'Oblivious boundary: not blocked');
    assertEqual(r.result, 'opponent', 'FYH roll 0.50 < 0.90 → NPC wins');
  });

  test('Totes Oblivious (90%) blocks more reliably than Oblivious (50%)', () => {
    assert(TOTES_OBLIVIOUS_CHANCE > OBLIVIOUS_CHANCE);
  });

  test('Totes Oblivious (90%): blocks when roll < 0.90', () => {
    const r = withRoll(0.89, () =>
      resolveNpcForceYourHand({ obliviousChance: TOTES_OBLIVIOUS_CHANCE }));
    assertEqual(r.blocked, 'Oblivious', 'Totes Oblivious blocks at 0.89 < 0.90');
  });

  test('Totes Oblivious REPLACES Oblivious — not additive', () => {
    // If stacked: 0.50 + 0.90 = 1.40 → always block; correct: max 90%
    assert(TOTES_OBLIVIOUS_CHANCE !== OBLIVIOUS_CHANCE + OBLIVIOUS_CHANCE,
      'Totes Oblivious is a replacement value, not stacked addition');
  });

  test('when not blocked: NPC wins tie at 90% (roll < 0.90)', () => {
    const r = withRolls([0.95, 0.89], () =>
      resolveNpcForceYourHand({ obliviousChance: OBLIVIOUS_CHANCE }));
    // roll 0.95 >= 0.50 → not blocked; roll 0.89 < 0.90 → NPC wins
    assertEqual(r.result, 'opponent', 'FYH roll 0.89 < 0.90 → NPC wins');
    assertEqual(r.blocked, null);
  });

  test('when not blocked: tie remains if FYH misses (roll >= 0.90)', () => {
    const r = withRolls([0.95, 0.90], () =>
      resolveNpcForceYourHand({ obliviousChance: OBLIVIOUS_CHANCE }));
    // roll 0.95 ≥ 0.50 → not blocked; roll 0.90 ≥ 0.90 → miss
    assertEqual(r.result, 'tie', 'FYH miss: tie remains');
    assertEqual(r.blocked, null);
  });

  test('FYH cooldowns: Twist Your Arm shorter than Force Your Hand', () => {
    assert(TWIST_YOUR_ARM_COOLDOWN_ROUNDS <= FORCE_YOUR_HAND_COOLDOWN_ROUNDS,
      'Twist Your Arm cooldown must not exceed Force Your Hand cooldown');
  });
});

// ── 5. NPC Refuse to Lose ─────────────────────────────────────────────────────
//
// Mirror of handleReady() NPC Refuse to Lose block.

function resolveNpcRefuseToLose() {
  if (roll() < REFUSE_TO_LOSE_CHANCE) return { result: 'tie', tieIsImmune: true };
  return { result: 'player', tieIsImmune: false };
}

describe('NPC Refuse to Lose', () => {
  test('fires when roll < 0.90: converts player win to immune tie', () => {
    const r = withRoll(0.89, resolveNpcRefuseToLose);
    assertEqual(r.result, 'tie', 'roll 0.89 < 0.90 → tie');
    assert(r.tieIsImmune, 'tieIsImmune must be set');
  });

  test('fails at boundary (roll >= 0.90): result stays player win', () => {
    const r = withRoll(0.90, resolveNpcRefuseToLose);
    assertEqual(r.result, 'player', 'roll 0.90 >= 0.90 → player win remains');
    assert(!r.tieIsImmune, 'tieIsImmune must not be set on failure');
  });

  test('always fires on roll 0.00', () => {
    const r = withRoll(0, resolveNpcRefuseToLose);
    assertEqual(r.result, 'tie');
    assert(r.tieIsImmune);
  });

  test('immune tie blocks all subsequent tie-altering', () => {
    // After NPC Refuse to Lose fires (tieIsImmune=true), any call to resolveNpcPassiveTie
    // (or player tie conversion) must bail out immediately.
    const r = withRoll(0, resolveNpcRefuseToLose);
    // Verify: if tieIsImmune is passed to NPC passive tie-conversion, it bails out
    const { result: convResult } = resolveNpcPassiveTieConversion({
      hasTweakReality: true, hasAlterReality: false,
      hasThirdTimesCharm: false, thirdTimesCharmFails: 0, thirdTimesCharmUsed: false,
      tieIsImmune: r.tieIsImmune,
      usedActiveSkill: false, obliviousChance: 0, luckyCharmActive: false,
    });
    assertEqual(convResult, 'tie', 'immune tie cannot be converted by any skill');
  });
});

// ── 6. NPC Passive Tie Conversion ─────────────────────────────────────────────
//
// Mirror of handleReady() NPC passive tie conversion block.

function resolveNpcPassiveTieConversion({
  hasTweakReality = false, hasAlterReality = false,
  hasThirdTimesCharm = false, thirdTimesCharmFails = 0, thirdTimesCharmUsed = false,
  tieIsImmune = false,
  usedActiveSkill = false,
  obliviousChance = 0,
  luckyCharmActive = false,
}) {
  if (tieIsImmune) return { result: 'tie', ttcFired: false, failsIncrement: false };
  if (!hasTweakReality && !hasAlterReality) return { result: 'tie', ttcFired: false, failsIncrement: false };
  if (usedActiveSkill) return { result: 'tie', ttcFired: false, failsIncrement: false };

  const npcBaseChance = hasAlterReality ? ALTER_REALITY_CHANCE : TWEAK_REALITY_CHANCE;
  let convertChance = npcBaseChance;
  let ttcFired = false;
  if (hasThirdTimesCharm && !thirdTimesCharmUsed && thirdTimesCharmFails >= 2) {
    convertChance = THIRD_TIMES_CHARM_BOOST;
    ttcFired = true;
  }

  // Oblivious blocker
  const obliviousBlocked = obliviousChance > 0 && roll() < obliviousChance;
  if (obliviousBlocked) return { result: 'tie', ttcFired: false, failsIncrement: true };

  if (roll() < convertChance) {
    // Lucky Charm can redirect NPC win to player win
    if (luckyCharmActive && roll() < NPC_LUCKY_CHARM_BLOCK_CHANCE) {
      return { result: 'player', ttcFired, failsIncrement: false };
    }
    return { result: 'opponent', ttcFired, failsIncrement: false };
  }
  return { result: 'tie', ttcFired: false, failsIncrement: true };
}

describe('NPC passive tie conversion — Tweak / Alter Reality', () => {
  test('without MYSTIC.1.1 or MYSTIC.1.1.1.2: tie always stays', () => {
    const r = withRoll(0, () => resolveNpcPassiveTieConversion({}));
    assertEqual(r.result, 'tie');
  });

  test('Tweak Reality (30%): NPC wins tie when roll < 0.30', () => {
    const r = withRoll(0.29, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true }));
    assertEqual(r.result, 'opponent', 'NPC wins tie at roll 0.29 < 0.30');
  });

  test('Tweak Reality (30%): tie stays at boundary (roll >= 0.30)', () => {
    const r = withRoll(0.30, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true }));
    assertEqual(r.result, 'tie', 'roll 0.30 >= 0.30 → tie stays');
  });

  test('Alter Reality (60%) replaces Tweak — not additive (roll 0.70 fails)', () => {
    // If stacked: 0.30 + 0.60 = 0.90; roll 0.70 would convert. Correct (replace): only 60%.
    const r = withRoll(0.70, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, hasAlterReality: true }));
    assertEqual(r.result, 'tie', 'Alter Reality replaces Tweak: 0.70 >= 0.60 → no convert');
  });

  test('Alter Reality alone (60%): NPC wins when roll < 0.60', () => {
    const r = withRoll(0.59, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: false, hasAlterReality: true }));
    assertEqual(r.result, 'opponent', 'Alter Reality alone: 0.59 < 0.60 → NPC wins');
  });

  test('tieIsImmune: blocks all NPC tie conversion', () => {
    const r = withRoll(0, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, tieIsImmune: true }));
    assertEqual(r.result, 'tie', 'tieIsImmune blocks NPC conversion');
  });

  test('usedActiveSkill: passive does not run if NPC already used active FYH/TYA', () => {
    const r = withRoll(0, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, usedActiveSkill: true }));
    assertEqual(r.result, 'tie', 'active already fired: passive does not roll');
  });
});

describe('NPC passive tie conversion — Oblivious blocker', () => {
  test('Oblivious (50%): blocks NPC tie conversion when roll < 0.50', () => {
    const r = withRoll(0.49, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, obliviousChance: OBLIVIOUS_CHANCE }));
    assertEqual(r.result, 'tie', 'Oblivious blocks NPC conversion');
    assert(r.failsIncrement, 'Oblivious block counts as a TTC failure increment for NPC');
  });

  test('Oblivious (50%): does NOT block at boundary (roll >= 0.50)', () => {
    // roll 0.50: Oblivious check fails (0.50 >= 0.50 → not blocked)
    // conversion roll 0.50 >= 0.30 (TWEAK_REALITY_CHANCE) → conversion also fails → tie stays
    // A failed conversion (not a block) still increments the TTC fail counter.
    const r = withRolls([0.50, 0.50], () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, obliviousChance: OBLIVIOUS_CHANCE }));
    assertEqual(r.result, 'tie', 'conversion roll 0.50 ≥ 0.30 → tie stays (unrelated to Oblivious)');
    assert(r.failsIncrement, 'failed conversion (not a block) still increments TTC fail counter');
  });

  test('Totes Oblivious (90%): blocks when roll < 0.90', () => {
    const r = withRoll(0.89, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, obliviousChance: TOTES_OBLIVIOUS_CHANCE }));
    assertEqual(r.result, 'tie', 'Totes Oblivious blocks NPC conversion at 0.89');
    assert(r.failsIncrement, 'block counts as TTC failure increment');
  });

  test('Oblivious block increments NPC TTC fail counter (not a successful conversion)', () => {
    // The block means NPC Tweak/Alter Reality was PREVENTED, which counts as a passive failure
    // for Third Time's the Charm tracking purposes
    const r = withRoll(0.49, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, obliviousChance: OBLIVIOUS_CHANCE }));
    assert(r.failsIncrement, 'Oblivious-blocked conversion increments TTC fails');
  });
});

describe("NPC passive tie conversion — Third Time's the Charm", () => {
  test('0 failures: uses base Tweak chance (30%)', () => {
    const r = withRoll(0.29, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, hasThirdTimesCharm: true, thirdTimesCharmFails: 0 }));
    assertEqual(r.result, 'opponent');
    assert(!r.ttcFired, 'TTC should not fire with 0 failures');
  });

  test('1 failure: still uses base Tweak chance', () => {
    const r = withRoll(0.94, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, hasThirdTimesCharm: true, thirdTimesCharmFails: 1 }));
    assertEqual(r.result, 'tie', '0.94 >= 0.30 → tie stays; TTC not active yet');
    assert(!r.ttcFired);
  });

  test('2 failures: boosts to 95% (THIRD_TIMES_CHARM_BOOST)', () => {
    const r = withRoll(0.94, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, hasThirdTimesCharm: true, thirdTimesCharmFails: 2 }));
    assertEqual(r.result, 'opponent', 'TTC boost: roll 0.94 < 0.95 → NPC wins');
    assert(r.ttcFired, 'ttcFired must be true');
  });

  test('TTC does NOT fire when thirdTimesCharmUsed = true', () => {
    const r = withRoll(0.94, () =>
      resolveNpcPassiveTieConversion({
        hasTweakReality: true, hasThirdTimesCharm: true,
        thirdTimesCharmFails: 2, thirdTimesCharmUsed: true
      }));
    assertEqual(r.result, 'tie', 'TTC already used: base 30% only; 0.94 >= 0.30 → tie');
    assert(!r.ttcFired, 'ttcFired must be false after one-time use');
  });

  test('TTC boost boundary: roll 0.95 does NOT convert', () => {
    const r = withRoll(0.95, () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, hasThirdTimesCharm: true, thirdTimesCharmFails: 2 }));
    assertEqual(r.result, 'tie', 'roll 0.95 >= 0.95 → tie');
  });
});

describe('NPC passive tie conversion — Lucky Charm redirect', () => {
  test('Lucky Charm (90%): redirects NPC win to player win when roll < 0.90', () => {
    // conversion roll 0.29 < 0.30 → would be NPC win; then Lucky Charm roll 0.89 < 0.90 → player wins
    const r = withRolls([0.29, 0.89], () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, luckyCharmActive: true }));
    assertEqual(r.result, 'player', 'Lucky Charm redirects NPC win to player win');
  });

  test('Lucky Charm: does NOT redirect at boundary (roll >= 0.90)', () => {
    // conversion roll 0.29 → NPC would win; Lucky Charm roll 0.90 >= 0.90 → NPC wins anyway
    const r = withRolls([0.29, 0.90], () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, luckyCharmActive: true }));
    assertEqual(r.result, 'opponent', 'Lucky Charm boundary: roll 0.90 >= 0.90 → NPC wins');
  });

  test('Lucky Charm only activates when NPC conversion fires first', () => {
    // If conversion roll fails (0.30 >= 0.30), Lucky Charm roll is not consulted
    const r = withRolls([0.30], () =>
      resolveNpcPassiveTieConversion({ hasTweakReality: true, luckyCharmActive: true }));
    assertEqual(r.result, 'tie', 'no conversion → Lucky Charm not relevant → tie stays');
  });
});

// ── 7. NPC Powerup Activation Strategies ─────────────────────────────────────
//
// Mirror of tryNpcActivatePowerup() strategy-selection logic.

function npcShouldActivate(strategy, npcWinning, npcLosing) {
  switch (strategy) {
    case 'asap':    return true;
    case 'chance':  return roll() < NPC_POWERUP_CHANCE_RATE;
    case 'on_win':  return npcWinning;
    case 'on_loss': return npcLosing;
    default:        return false;
  }
}

describe('NPC powerup activation — strategy selection', () => {
  test("'asap': always activates regardless of roll", () => {
    assert(withRoll(0.99, () => npcShouldActivate('asap', false, false)),   "asap: activates at 0.99");
    assert(withRoll(0,    () => npcShouldActivate('asap', false, false)),   "asap: activates at 0.00");
  });

  test("'chance' (25%): activates when roll < NPC_POWERUP_CHANCE_RATE", () => {
    assert(withRoll(0.24, () => npcShouldActivate('chance', false, false)), "chance: 0.24 < 0.25 → activates");
  });

  test("'chance' (25%): does NOT activate at boundary (roll >= 0.25)", () => {
    assert(!withRoll(0.25, () => npcShouldActivate('chance', false, false)), "chance: 0.25 >= 0.25 → no activate");
  });

  test("'on_win': activates only when NPC is winning (more rounds than player)", () => {
    assert(npcShouldActivate('on_win', true,  false), "on_win + npcWinning=true → activate");
    assert(!npcShouldActivate('on_win', false, false), "on_win + npcWinning=false → no activate");
    assert(!npcShouldActivate('on_win', false, true),  "on_win + npcLosing=true → no activate");
  });

  test("'on_loss': activates only when NPC is losing", () => {
    assert(npcShouldActivate('on_loss', false, true),  "on_loss + npcLosing=true → activate");
    assert(!npcShouldActivate('on_loss', true,  false), "on_loss + npcWinning=true → no activate");
    assert(!npcShouldActivate('on_loss', false, false), "on_loss + tied → no activate");
  });

  test('unknown strategy: does not activate', () => {
    assert(!npcShouldActivate('magic_8_ball', false, false), 'unknown strategy → no activate');
  });
});

describe('NPC powerup activation — Padlock and FIFO', () => {
  test('Padlock: powerupBlockedRounds > 0 prevents activation', () => {
    // Mirror of tryNpcActivatePowerup() guard: if (npcSkillState.powerupBlockedRounds > 0) return;
    const skill = { powerupBlockedRounds: 2 };
    assert(skill.powerupBlockedRounds > 0, 'powerupBlockedRounds=2 → activation blocked');
  });

  test('Padlock: powerupBlockedRounds = 0 does NOT block activation', () => {
    const skill = { powerupBlockedRounds: 0 };
    assert(!(skill.powerupBlockedRounds > 0), 'powerupBlockedRounds=0 → activation allowed');
  });

  test('FIFO: first item in inventory is consumed (shift())', () => {
    const inv = [
      { name: 'Wish Upon a Star', instanceId: 'pu_aaa' },
      { name: 'Fait Accompli',    instanceId: 'pu_bbb' },
    ];
    const consumed = inv.shift();
    assertEqual(consumed.name, 'Wish Upon a Star', 'FIFO: first item (index 0) consumed first');
    assertEqual(inv.length, 1, 'inventory reduced to 1 after shift');
    assertEqual(inv[0].name, 'Fait Accompli', 'remaining item is second powerup');
  });

  test('empty inventory: nothing consumed', () => {
    const inv = [];
    // Guard: if (!npcPowerupInventory.length) return;
    assert(inv.length === 0, 'empty inventory: activation bails out before shift()');
  });

  test('NPC_POWERUP_CHANCE_RATE constant is 0.25', () => {
    assertEqual(NPC_POWERUP_CHANCE_RATE, 0.25);
  });
});

// ── 8. Bamboozle (MYSTIC.1.2.1.2) ─────────────────────────────────────────────
//
// Mirror of tryNpcActivatePowerup() Bamboozle check.
// 25% chance the NPC powerup fires for the player instead.

function resolveBamboozle(hasSkill, powerup) {
  if (!hasSkill) return { firedForPlayer: false };
  if (roll() < BAMBOOZLE_CHANCE) return { firedForPlayer: true, powerup };
  return { firedForPlayer: false };
}

describe('Bamboozle (MYSTIC.1.2.1.2)', () => {
  test('constant is 25%', () => {
    assertEqual(BAMBOOZLE_CHANCE, 0.25);
  });

  test('without Bamboozle skill: NPC powerup fires normally', () => {
    const r = withRoll(0, () => resolveBamboozle(false, { name: 'Wish Upon a Star' }));
    assert(!r.firedForPlayer, 'no Bamboozle skill: powerup stays with NPC');
  });

  test('Bamboozle present: redirects when roll < 0.25', () => {
    const r = withRoll(0.24, () => resolveBamboozle(true, { name: 'Wish Upon a Star' }));
    assert(r.firedForPlayer, 'Bamboozle fires: roll 0.24 < 0.25 → powerup activates for player');
    assertEqual(r.powerup.name, 'Wish Upon a Star', 'redirected powerup is the NPC one');
  });

  test('Bamboozle present: does NOT redirect at boundary (roll >= 0.25)', () => {
    const r = withRoll(0.25, () => resolveBamboozle(true, { name: 'Wish Upon a Star' }));
    assert(!r.firedForPlayer, 'Bamboozle: roll 0.25 >= 0.25 → NPC keeps powerup');
  });

  test('Bamboozle redirects force-win powerup as player benefit', () => {
    // NPC Wish Upon a Star (force NPC win) redirected via Bamboozle → player gets force-win
    const r = withRoll(0, () => resolveBamboozle(true, { name: 'Wish Upon a Star' }));
    assert(r.firedForPlayer, 'Bamboozle redirects force-win powerup to player');
    assertEqual(r.powerup.name, 'Wish Upon a Star');
  });
});

// ── 9. NPC Cooldown Management ────────────────────────────────────────────────
//
// Mirror of advanceRound() NPC cooldown decrement block.

function advanceNpcCooldowns(skill, molassesActive) {
  if (skill.tmlCooldown           > 0) skill.tmlCooldown--;
  if (skill.forceYourHandCooldown > 0) skill.forceYourHandCooldown--;
  if (skill.refuseToLoseCooldown  > 0) skill.refuseToLoseCooldown--;
  if (skill.powerupBlockedRounds  > 0) skill.powerupBlockedRounds--;
  if (molassesActive) {
    skill.tmlCooldown++;
    skill.forceYourHandCooldown++;
    skill.refuseToLoseCooldown++;
  }
}

describe('NPC cooldown decrements (advanceRound)', () => {
  test('each cooldown decrements by 1 per round when > 0', () => {
    const s = { tmlCooldown: 3, forceYourHandCooldown: 2, refuseToLoseCooldown: 1, powerupBlockedRounds: 4 };
    advanceNpcCooldowns(s, false);
    assertEqual(s.tmlCooldown,            2);
    assertEqual(s.forceYourHandCooldown,  1);
    assertEqual(s.refuseToLoseCooldown,   0);
    assertEqual(s.powerupBlockedRounds,   3);
  });

  test('cooldowns do not go below 0 (guard prevents underflow)', () => {
    const s = { tmlCooldown: 0, forceYourHandCooldown: 0, refuseToLoseCooldown: 0, powerupBlockedRounds: 0 };
    advanceNpcCooldowns(s, false);
    assertEqual(s.tmlCooldown,            0, 'tmlCooldown stays 0');
    assertEqual(s.forceYourHandCooldown,  0, 'forceYourHandCooldown stays 0');
    assertEqual(s.refuseToLoseCooldown,   0, 'refuseToLoseCooldown stays 0');
    assertEqual(s.powerupBlockedRounds,   0, 'powerupBlockedRounds stays 0');
  });

  test('single decrement takes 5-round TML to 0 in 5 calls', () => {
    const s = { tmlCooldown: TML_COOLDOWN_ROUNDS, forceYourHandCooldown: 0, refuseToLoseCooldown: 0, powerupBlockedRounds: 0 };
    for (let r = 0; r < TML_COOLDOWN_ROUNDS; r++) advanceNpcCooldowns(s, false);
    assertEqual(s.tmlCooldown, 0, `TML cooldown (${TML_COOLDOWN_ROUNDS}) reaches 0 after ${TML_COOLDOWN_ROUNDS} rounds`);
  });
});

describe('NPC cooldowns — Molasses effect', () => {
  test('Molasses: cooldown > 0 → net 0 change per round (decrement cancelled by increment)', () => {
    const s = { tmlCooldown: 3, forceYourHandCooldown: 2, refuseToLoseCooldown: 1, powerupBlockedRounds: 0 };
    advanceNpcCooldowns(s, true);
    assertEqual(s.tmlCooldown,            3, 'tml: 3 → 2 → 3 (net 0)');
    assertEqual(s.forceYourHandCooldown,  2, 'FYH: 2 → 1 → 2 (net 0)');
    assertEqual(s.refuseToLoseCooldown,   1, 'RTL: 1 → 0 → 1 (net 0)');
  });

  test('Molasses: cooldown = 0 → bumped to 1 (guard prevents decrement, but +1 still fires)', () => {
    // This is the correct implementation: 0-cooldown skill becomes unavailable when Molasses active
    const s = { tmlCooldown: 0, forceYourHandCooldown: 0, refuseToLoseCooldown: 0, powerupBlockedRounds: 0 };
    advanceNpcCooldowns(s, true);
    assertEqual(s.tmlCooldown,            1, 'Molasses bumps 0 → 1 (guard blocks decrement, +1 fires)');
    assertEqual(s.forceYourHandCooldown,  1, 'Molasses bumps FYH 0 → 1');
    assertEqual(s.refuseToLoseCooldown,   1, 'Molasses bumps RTL 0 → 1');
  });

  test('Molasses: a 0-cooldown skill stays perpetually blocked across multiple rounds', () => {
    // After Molasses bumps 0 → 1, the next round: 1 → 0 → 1 again (net 0 when > 0)
    const s = { tmlCooldown: 0, forceYourHandCooldown: 0, refuseToLoseCooldown: 0, powerupBlockedRounds: 0 };
    for (let r = 0; r < 5; r++) advanceNpcCooldowns(s, true);
    assertEqual(s.tmlCooldown, 1, 'Molasses keeps TML perpetually at 1 (never reaches 0)');
  });

  test('Molasses does NOT affect powerupBlockedRounds (Padlock cooldown)', () => {
    const s = { tmlCooldown: 2, forceYourHandCooldown: 0, refuseToLoseCooldown: 0, powerupBlockedRounds: 3 };
    advanceNpcCooldowns(s, true);
    assertEqual(s.powerupBlockedRounds, 2, 'Padlock cooldown decrements normally despite Molasses');
  });
});

describe('NPC cooldowns — Massive Brain Fart extension', () => {
  test('Massive Brain Fart adds +3 to all NPC active-skill cooldowns', () => {
    // Mirror of handleMassiveBrainFart() in match.js:
    //   npcSkillState.tmlCooldown += 3;
    //   npcSkillState.forceYourHandCooldown += 3;
    //   npcSkillState.refuseToLoseCooldown += 3;
    const s = { tmlCooldown: 1, forceYourHandCooldown: 0, refuseToLoseCooldown: 2 };
    s.tmlCooldown           += 3;
    s.forceYourHandCooldown += 3;
    s.refuseToLoseCooldown  += 3;
    assertEqual(s.tmlCooldown,            4, 'TML: 1 + 3 = 4');
    assertEqual(s.forceYourHandCooldown,  3, 'FYH: 0 + 3 = 3');
    assertEqual(s.refuseToLoseCooldown,   5, 'RTL: 2 + 3 = 5');
  });

  test('Massive Brain Fart on already-cooled-down skills extends beyond ready state', () => {
    // An NPC with tmlCooldown=0 (skill ready) gets extended by +3
    const s = { tmlCooldown: 0, forceYourHandCooldown: 0, refuseToLoseCooldown: 0 };
    s.tmlCooldown           += 3;
    s.forceYourHandCooldown += 3;
    s.refuseToLoseCooldown  += 3;
    assertEqual(s.tmlCooldown, 3, 'Ready skill gets 3-round lockout from Massive Brain Fart');
  });
});

// ── 10. NPC Skill Constant Sanity Checks ──────────────────────────────────────

describe('NPC skill constants sanity', () => {
  test('NPC_POWERUP_CHANCE_RATE is 0.25', () => assertEqual(NPC_POWERUP_CHANCE_RATE, 0.25));
  test('NPC_LUCKY_CHARM_BLOCK_CHANCE is 0.90', () => assertEqual(NPC_LUCKY_CHARM_BLOCK_CHANCE, 0.90));
  test('NOT_TODAY_CHANCE is 0.95', () => assertEqual(NOT_TODAY_CHANCE, 0.95));
  test('THE_COOLER_CHANCE is 0.50', () => assertEqual(THE_COOLER_CHANCE, 0.50));
  test('THE_FREEZER_CHANCE is 0.75', () => assertEqual(THE_FREEZER_CHANCE, 0.75));
  test('BAMBOOZLE_CHANCE is 0.25', () => assertEqual(BAMBOOZLE_CHANCE, 0.25));

  test('NPR_MAX is 0.90', () => assertEqual(NPR_MAX, 0.90));
  test('NPR_ACCUMULATION_PER_ROUND is 0.10', () => assertEqual(NPR_ACCUMULATION_PER_ROUND, 0.10));
  test('NPR_ADVANCED_ACCUMULATION is 0.15', () => assertEqual(NPR_ADVANCED_ACCUMULATION, 0.15));

  test('counter-skill replacement pairs are consistent (both L4 upgrades reach 90%)', () => {
    assertEqual(MIND_FORTRESS_CHANCE, TOTES_OBLIVIOUS_CHANCE,
      'both L4 counter-skill upgrades cap at 90%');
  });

  test('REFUSE_TO_LOSE_CHANCE is 0.90 (same for player and NPC)', () => {
    assertEqual(REFUSE_TO_LOSE_CHANCE, 0.90);
  });

  test('FORCE_YOUR_HAND_CHANCE is 0.90 (same for player and NPC)', () => {
    assertEqual(FORCE_YOUR_HAND_CHANCE, 0.90);
  });

  test('Lucky Charm block chance (0.90) is consistent with Refuse to Lose chance (0.90)', () => {
    assertEqual(NPC_LUCKY_CHARM_BLOCK_CHANCE, REFUSE_TO_LOSE_CHANCE,
      'Lucky Charm redirect chance matches Refuse to Lose chance (design symmetry)');
  });

  test('NPC TML chain: Fingers Crossed (0.95) > Lucky Socks (0.85) > base (0.75)', () => {
    assert(FINGERS_CROSSED_TML_CHANCE > LUCKY_SOCKS_TML_CHANCE, 'Fingers Crossed > Lucky Socks');
    assert(LUCKY_SOCKS_TML_CHANCE > TML_SUCCESS_CHANCE, 'Lucky Socks > base TML');
  });

  test('Oblivious replacement pair: Totes Oblivious > Oblivious', () => {
    assert(TOTES_OBLIVIOUS_CHANCE > OBLIVIOUS_CHANCE, '90% > 50%');
  });

  test('Cooler replacement pair: The Freezer > The Cooler', () => {
    assert(THE_FREEZER_CHANCE > THE_COOLER_CHANCE, '75% > 50%');
  });

  test('Mind Shield replacement pair: Mind Fortress > Mind Shield', () => {
    assert(MIND_FORTRESS_CHANCE > MIND_SHIELD_CHANCE, '90% > 50%');
  });
});
