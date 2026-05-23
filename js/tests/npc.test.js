import { describe, test, assert, assertEqual, assertOneOf } from './testRunner.js';
import { setRollFn, resetRoll } from '../utils/rng.js';
import {
  initNpcMatchState, initNpcSkillState, getNpcThrow, recordPlayerThrow,
  npcDecideActiveSkill, mostFrequentThrow,
} from '../systems/npc.js';
import {
  THE_FREEZER_CHANCE, NOT_TODAY_CHANCE,
  TML_COOLDOWN_ROUNDS, ATML_COOLDOWN_ROUNDS,
  FORCE_YOUR_HAND_COOLDOWN_ROUNDS, TWIST_YOUR_ARM_COOLDOWN_ROUNDS,
} from '../constants.js';

const THROWS = ['rock', 'paper', 'scissors'];
const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

// Helper: build a minimal NPC object with the given strategy
function npc(strategy) {
  return { primaryStrategy: strategy };
}

// Helper: force roll() to return a fixed value for the duration of fn(), then reset
function withRoll(value, fn) {
  setRollFn(() => value);
  try { return fn(); } finally { resetRoll(); }
}

// ── Purist strategies ─────────────────────────────────────────────────────────

describe('puristRock', () => {
  test('always throws rock', () => {
    const state = initNpcMatchState(npc('puristRock'));
    for (let i = 0; i < 10; i++) assertEqual(getNpcThrow(state), 'rock');
  });
});

describe('puristPaper', () => {
  test('always throws paper', () => {
    const state = initNpcMatchState(npc('puristPaper'));
    for (let i = 0; i < 10; i++) assertEqual(getNpcThrow(state), 'paper');
  });
});

describe('puristScissors', () => {
  test('always throws scissors', () => {
    const state = initNpcMatchState(npc('puristScissors'));
    for (let i = 0; i < 10; i++) assertEqual(getNpcThrow(state), 'scissors');
  });
});

// ── puristRandom ──────────────────────────────────────────────────────────────

describe('puristRandom', () => {
  test('locks on one throw for entire match', () => {
    const state = initNpcMatchState(npc('puristRandom'));
    const locked = state.lockedThrow;
    assertOneOf(locked, THROWS, 'lockedThrow must be a valid throw');
    for (let i = 0; i < 10; i++) assertEqual(getNpcThrow(state), locked);
  });

  test('lock is set at match init, not per-round', () => {
    // Roll returns 0 → rock (index 0)
    const state = withRoll(0, () => initNpcMatchState(npc('puristRandom')));
    assertEqual(state.lockedThrow, 'rock');
    // Even if roll changes after init, throw stays locked
    setRollFn(() => 0.99); // would pick scissors
    assertEqual(getNpcThrow(state), 'rock');
    resetRoll();
  });

  test('each match init can produce a different throw', () => {
    const s1 = withRoll(0,    () => initNpcMatchState(npc('puristRandom'))); // rock
    const s2 = withRoll(0.34, () => initNpcMatchState(npc('puristRandom'))); // paper
    const s3 = withRoll(0.67, () => initNpcMatchState(npc('puristRandom'))); // scissors
    assertEqual(s1.lockedThrow, 'rock');
    assertEqual(s2.lockedThrow, 'paper');
    assertEqual(s3.lockedThrow, 'scissors');
  });
});

// ── random ────────────────────────────────────────────────────────────────────

describe('random', () => {
  test('always returns a valid throw', () => {
    const state = initNpcMatchState(npc('random'));
    for (let i = 0; i < 20; i++) assertOneOf(getNpcThrow(state), THROWS);
  });

  test('maps rolls deterministically to all three throws', () => {
    // Verifies that the roll→throw mapping covers all three values without relying
    // on probabilistic sampling. Index math: floor(roll * 3) → 0=rock, 1=paper, 2=scissors.
    const cases = [[0.0, 'rock'], [0.34, 'paper'], [0.67, 'scissors']];
    for (const [rollVal, expected] of cases) {
      const state = initNpcMatchState(npc('random'));
      assertEqual(withRoll(rollVal, () => getNpcThrow(state)), expected,
        `roll ${rollVal} → ${expected}`);
    }
  });
});

// ── mirror ────────────────────────────────────────────────────────────────────

describe('mirror', () => {
  test('round 1 returns a valid throw', () => {
    const state = initNpcMatchState(npc('mirror'));
    assertOneOf(getNpcThrow(state), THROWS);
  });

  test('copies each player throw exactly', () => {
    const state = initNpcMatchState(npc('mirror'));
    getNpcThrow(state); // round 1
    for (const throw_ of ['rock', 'paper', 'scissors', 'rock']) {
      recordPlayerThrow(state, throw_);
      assertEqual(getNpcThrow(state), throw_);
    }
  });
});

// ── counter ───────────────────────────────────────────────────────────────────

describe('counter', () => {
  test('round 1 returns a valid throw', () => {
    const state = initNpcMatchState(npc('counter'));
    assertOneOf(getNpcThrow(state), THROWS);
  });

  test('throws the counter to each player throw', () => {
    const state = initNpcMatchState(npc('counter'));
    getNpcThrow(state); // round 1
    for (const [playerThrow, expected] of Object.entries(COUNTER)) {
      recordPlayerThrow(state, playerThrow);
      assertEqual(getNpcThrow(state), expected, `counter(${playerThrow}) should be ${expected}`);
    }
  });

  test('counter map is complete and correct', () => {
    // rock loses to paper, paper loses to scissors, scissors loses to rock
    assertEqual(COUNTER.rock,     'paper');
    assertEqual(COUNTER.paper,    'scissors');
    assertEqual(COUNTER.scissors, 'rock');
  });
});

// ── cycler ────────────────────────────────────────────────────────────────────

describe('cycler', () => {
  test('cycles rock → paper → scissors and repeats', () => {
    const state = initNpcMatchState(npc('cycler'));
    const expected = ['rock', 'paper', 'scissors', 'rock', 'paper', 'scissors'];
    for (const exp of expected) assertEqual(getNpcThrow(state), exp);
  });

  test('cycle is unaffected by player throws', () => {
    const state = initNpcMatchState(npc('cycler'));
    getNpcThrow(state); // rock
    recordPlayerThrow(state, 'scissors'); // player threw scissors
    assertEqual(getNpcThrow(state), 'paper'); // still follows its cycle
  });
});

// ── momentum ──────────────────────────────────────────────────────────────────

describe('momentum', () => {
  test('repeats winning throw after an NPC win', () => {
    const state = initNpcMatchState(npc('momentum'));
    const first = withRoll(0, () => getNpcThrow(state)); // force 'rock'
    assertEqual(first, 'rock');
    // Pass 'opponent' as lastRoundResult → NPC won → should repeat
    assertEqual(getNpcThrow(state, 'opponent'), 'rock');
    assertEqual(getNpcThrow(state, 'opponent'), 'rock');
  });

  test('returns a valid throw after a loss', () => {
    const state = initNpcMatchState(npc('momentum'));
    getNpcThrow(state); // round 1
    const t = getNpcThrow(state, 'player'); // player won → NPC lost
    assertOneOf(t, THROWS);
  });

  test('returns a valid throw after a tie', () => {
    const state = initNpcMatchState(npc('momentum'));
    getNpcThrow(state);
    assertOneOf(getNpcThrow(state, 'tie'), THROWS);
  });

  test('resets streak after a loss', () => {
    const state = initNpcMatchState(npc('momentum'));
    withRoll(0, () => getNpcThrow(state)); // force rock
    getNpcThrow(state, 'opponent'); // NPC wins — rock streak
    // NPC loses next round — streak breaks
    const t = getNpcThrow(state, 'player');
    assertOneOf(t, THROWS); // valid, no longer locked to rock
  });
});

// ── tilted ────────────────────────────────────────────────────────────────────

describe('tilted', () => {
  test('does not tilt at 0 deficit', () => {
    const state = initNpcMatchState(npc('tilted'));
    getNpcThrow(state); // round 1
    assertEqual(state.tilted, false);
  });

  test('does not tilt at 1-round deficit', () => {
    const state = initNpcMatchState(npc('tilted'));
    getNpcThrow(state, null);
    getNpcThrow(state, 'player'); // player wins round 1 → deficit = 1
    assertEqual(state.tilted, false);
  });

  test('tilts exactly when player leads by 2', () => {
    const state = initNpcMatchState(npc('tilted'));
    getNpcThrow(state, null);
    getNpcThrow(state, 'player'); // player wins round 1
    getNpcThrow(state, 'player'); // player wins round 2 → deficit = 2 → TILT
    assertEqual(state.tilted, true);
  });

  test('stays tilted for rest of match', () => {
    const state = initNpcMatchState(npc('tilted'));
    getNpcThrow(state, null);
    getNpcThrow(state, 'player');
    getNpcThrow(state, 'player'); // tilt triggers
    // Even if NPC wins next round, stays tilted
    getNpcThrow(state, 'opponent');
    assertEqual(state.tilted, true);
  });

  test('pre-tilt: uses counter logic against known player throw', () => {
    const state = initNpcMatchState(npc('tilted'));
    getNpcThrow(state, null); // round 1
    recordPlayerThrow(state, 'rock');
    // Only 1 player win → not tilted → counter rock = paper
    assertEqual(getNpcThrow(state, 'player'), 'paper');
  });

  test('post-tilt: returns valid throws', () => {
    const state = initNpcMatchState(npc('tilted'));
    getNpcThrow(state, null);
    getNpcThrow(state, 'player');
    getNpcThrow(state, 'player'); // tilt
    for (let i = 0; i < 10; i++) assertOneOf(getNpcThrow(state), THROWS);
  });
});

// ── streaker ──────────────────────────────────────────────────────────────────

describe('streaker', () => {
  test('round 1 (no history): returns a valid throw', () => {
    const state = initNpcMatchState(npc('streaker'));
    assertOneOf(getNpcThrow(state), THROWS);
  });

  test('1 throw in history (no streak possible): returns valid throw', () => {
    const state = initNpcMatchState(npc('streaker'));
    recordPlayerThrow(state, 'rock');
    assertOneOf(getNpcThrow(state), THROWS);
  });

  test('counters a rock streak', () => {
    const state = initNpcMatchState(npc('streaker'));
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'rock');
    assertEqual(getNpcThrow(state), 'paper');
  });

  test('counters a paper streak', () => {
    const state = initNpcMatchState(npc('streaker'));
    recordPlayerThrow(state, 'paper');
    recordPlayerThrow(state, 'paper');
    assertEqual(getNpcThrow(state), 'scissors');
  });

  test('counters a scissors streak', () => {
    const state = initNpcMatchState(npc('streaker'));
    recordPlayerThrow(state, 'scissors');
    recordPlayerThrow(state, 'scissors');
    assertEqual(getNpcThrow(state), 'rock');
  });

  test('no counter when last two throws differ', () => {
    const state = initNpcMatchState(npc('streaker'));
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'paper'); // alternating — no streak
    assertOneOf(getNpcThrow(state), THROWS);
  });

  test('reacts to streak regardless of earlier history', () => {
    const state = initNpcMatchState(npc('streaker'));
    recordPlayerThrow(state, 'scissors');
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'paper'); // earlier mixed history
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'rock'); // last two = rock streak
    assertEqual(getNpcThrow(state), 'paper');
  });
});

// ── mimic ─────────────────────────────────────────────────────────────────────

describe('mimic', () => {
  test('no history: returns a valid throw', () => {
    const state = initNpcMatchState(npc('mimic'));
    assertOneOf(getNpcThrow(state), THROWS);
  });

  test('counters the most frequent throw', () => {
    const state = initNpcMatchState(npc('mimic'));
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'paper');
    // rock: 2, paper: 1 → counter rock = paper
    assertEqual(getNpcThrow(state), 'paper');
  });

  test('switches when distribution changes', () => {
    const state = initNpcMatchState(npc('mimic'));
    recordPlayerThrow(state, 'scissors');
    recordPlayerThrow(state, 'scissors');
    recordPlayerThrow(state, 'scissors');
    assertEqual(getNpcThrow(state), 'rock'); // counter scissors

    recordPlayerThrow(state, 'paper');
    recordPlayerThrow(state, 'paper');
    recordPlayerThrow(state, 'paper');
    recordPlayerThrow(state, 'paper');
    // paper: 4, scissors: 3 → counter paper = scissors
    assertEqual(getNpcThrow(state), 'scissors');
  });

  test('handles tie in frequency (returns valid throw)', () => {
    const state = initNpcMatchState(npc('mimic'));
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'paper'); // tied 1–1
    assertOneOf(getNpcThrow(state), THROWS);
  });
});

// ── historian ─────────────────────────────────────────────────────────────────

describe('historian', () => {
  test('fewer than 3 throws: returns valid throw (random phase)', () => {
    const state = initNpcMatchState(npc('historian'));
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'rock');
    assertOneOf(getNpcThrow(state), THROWS);
  });

  test('6+ throws: always counters most frequent', () => {
    const state = initNpcMatchState(npc('historian'));
    for (let i = 0; i < 5; i++) recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'paper');
    // rock × 5, paper × 1 → counter rock = paper
    assertEqual(getNpcThrow(state), 'paper');
  });

  test('3-5 throws: low roll → uses read (counters most frequent throw)', () => {
    // A roll of 0.0 should always fall within whatever threshold historian uses for the
    // read path, so this deterministically proves the read branch is reachable.
    const state = initNpcMatchState(npc('historian'));
    for (let j = 0; j < 4; j++) recordPlayerThrow(state, 'rock');
    assertEqual(withRoll(0, () => getNpcThrow(state)), 'paper',
      'low roll: historian uses read → counter of rock = paper');
  });

  test('3-5 throws: high roll → goes random (does not always counter)', () => {
    // A roll of 0.99 should always fall outside the read threshold, proving the
    // random fallback branch is reachable.
    const state = initNpcMatchState(npc('historian'));
    for (let j = 0; j < 4; j++) recordPlayerThrow(state, 'rock');
    // With roll 0.99, historian skips the read and returns a throw based on random logic.
    // We can't assert the exact throw (random branch), but it must be a valid one.
    assertOneOf(withRoll(0.99, () => getNpcThrow(state)), THROWS,
      'high roll: historian falls back to random → still a valid throw');
  });

  test('6+ throws: low roll → always uses the read (higher threshold than 3-5)', () => {
    // At 6+ throws, a roll of 0.0 deterministically takes the read path.
    const state = initNpcMatchState(npc('historian'));
    for (let j = 0; j < 7; j++) recordPlayerThrow(state, 'rock');
    assertEqual(withRoll(0, () => getNpcThrow(state)), 'paper',
      'low roll at 7 throws: historian uses read → counter of rock = paper');
  });
});

// ── maskedThrows (Blank Slate stub, v0.3) ────────────────────────────────────

describe('maskedThrows parameter', () => {
  test('streaker: masking last 2 throws hides a streak', () => {
    const state = initNpcMatchState(npc('streaker'));
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'rock'); // rock streak — last 2 throws
    // Mask those 2 → visible history is empty → no streak detected → valid throw
    assertOneOf(getNpcThrow(state, null, 2), THROWS);
  });

  test('mimic: masking reduces visible sample', () => {
    const state = initNpcMatchState(npc('mimic'));
    recordPlayerThrow(state, 'rock');  // rock × 1 (oldest — visible after mask of 2)
    recordPlayerThrow(state, 'paper'); // paper × 1 (masked — most recent 2)
    recordPlayerThrow(state, 'paper'); // paper × 1 (masked)
    // Visible history = ['rock'] → counter rock = paper
    assertEqual(getNpcThrow(state, null, 2), 'paper');
  });

  test('mimic: masking all throws → random', () => {
    const state = initNpcMatchState(npc('mimic'));
    recordPlayerThrow(state, 'rock');
    recordPlayerThrow(state, 'rock');
    // Mask all 2 → no history → random
    assertOneOf(getNpcThrow(state, null, 2), THROWS);
  });

  test('historian: masking drops below 3-throw threshold → random phase', () => {
    const state = initNpcMatchState(npc('historian'));
    for (let j = 0; j < 7; j++) recordPlayerThrow(state, 'rock');
    // 7 throws, mask 5 → 2 visible → falls into random phase
    assertOneOf(getNpcThrow(state, null, 5), THROWS);
  });
});

// ── mostFrequentThrow ─────────────────────────────────────────────────────────

describe('mostFrequentThrow', () => {
  test('empty array returns null', () => {
    assertEqual(mostFrequentThrow([]), null);
  });

  test('single throw returns that throw', () => {
    assertEqual(mostFrequentThrow(['rock']), 'rock');
  });

  test('clear majority', () => {
    assertEqual(mostFrequentThrow(['rock','rock','paper']), 'rock');
  });

  test('all same', () => {
    assertEqual(mostFrequentThrow(['scissors','scissors','scissors']), 'scissors');
  });
});

// ── initNpcSkillState ─────────────────────────────────────────────────────────

describe('initNpcSkillState', () => {
  test('all cooldowns start at 0', () => {
    const s = initNpcSkillState();
    assertEqual(s.tmlCooldown,           0);
    assertEqual(s.forceYourHandCooldown, 0);
    assertEqual(s.refuseToLoseCooldown,  0);
  });

  test('charm/win trackers start at 0 / false', () => {
    const s = initNpcSkillState();
    assertEqual(s.thirdTimesCharmFails, 0);
    assertEqual(s.thirdTimesCharmUsed,  false);
    assertEqual(s.dueForAWinFails,      0);
    assertEqual(s.dueForAWinUsed,       false);
  });

  test('NPR accumulation starts at 0', () => {
    const s = initNpcSkillState();
    assertEqual(s.nprAccumulation, 0.0);
  });

  test('powerupBlockedRounds starts at 0', () => {
    const s = initNpcSkillState();
    assertEqual(s.powerupBlockedRounds, 0);
  });
});

// ── initNpcMatchState — secondary strategy fields ─────────────────────────────

describe('initNpcMatchState secondary strategy fields', () => {
  function npcWithSwitch(opts = {}) {
    return {
      primaryStrategy:   opts.primary   ?? 'random',
      secondaryStrategy: opts.secondary ?? null,
      switchTrigger:     opts.trigger   ?? null,
    };
  }

  test('no secondary strategy → fields are null/false', () => {
    const ms = initNpcMatchState(npcWithSwitch());
    assertEqual(ms.secondaryStrategy, null);
    assertEqual(ms.switchTrigger,     null);
    assertEqual(ms.strategySwapped,   false);
  });

  test('secondary strategy stored on matchState', () => {
    const ms = initNpcMatchState(npcWithSwitch({
      secondary: 'counter',
      trigger: { condition: 'reach_round', value: 3 },
    }));
    assertEqual(ms.secondaryStrategy, 'counter');
    assertEqual(ms.switchTrigger.condition, 'reach_round');
    assertEqual(ms.strategySwapped, false);
  });
});

// ── Secondary strategy switching ──────────────────────────────────────────────

describe('secondary strategy switching', () => {
  function makeState(primary, secondary, trigger) {
    return initNpcMatchState({
      primaryStrategy:   primary,
      secondaryStrategy: secondary,
      switchTrigger:     trigger,
    });
  }

  test('reach_round: switches at the specified round', () => {
    const ms = makeState('puristRock', 'puristPaper', { condition: 'reach_round', value: 3 });
    // Round 2 — should still be puristRock
    getNpcThrow(ms, null, 0, { roundNumber: 2, playerRoundsWon: 0, npcRoundsWon: 0 });
    assertEqual(ms.strategy, 'puristRock');

    // Round 3 — should switch
    getNpcThrow(ms, null, 0, { roundNumber: 3, playerRoundsWon: 0, npcRoundsWon: 0 });
    assertEqual(ms.strategy, 'puristPaper');
    assertEqual(ms.strategySwapped, true);
  });

  test('reach_round: does not switch early', () => {
    const ms = makeState('puristRock', 'random', { condition: 'reach_round', value: 5 });
    for (let r = 1; r < 5; r++) {
      getNpcThrow(ms, null, 0, { roundNumber: r, playerRoundsWon: 0, npcRoundsWon: 0 });
    }
    assertEqual(ms.strategySwapped, false);
  });

  test('losing_by: switches when player leads by trigger amount', () => {
    const ms = makeState('puristRock', 'random', { condition: 'losing_by', value: 2 });
    // Player leads by 1 — no switch
    getNpcThrow(ms, null, 0, { roundNumber: 1, playerRoundsWon: 1, npcRoundsWon: 0 });
    assertEqual(ms.strategySwapped, false);
    // Player leads by 2 — switch
    getNpcThrow(ms, null, 0, { roundNumber: 2, playerRoundsWon: 2, npcRoundsWon: 0 });
    assertEqual(ms.strategySwapped, true);
  });

  test('winning_by: switches when NPC leads by trigger amount', () => {
    const ms = makeState('random', 'puristScissors', { condition: 'winning_by', value: 2 });
    getNpcThrow(ms, null, 0, { roundNumber: 1, playerRoundsWon: 0, npcRoundsWon: 1 });
    assertEqual(ms.strategySwapped, false);
    getNpcThrow(ms, null, 0, { roundNumber: 2, playerRoundsWon: 0, npcRoundsWon: 2 });
    assertEqual(ms.strategySwapped, true);
    assertEqual(ms.strategy, 'puristScissors');
  });

  test('switch fires only once', () => {
    const ms = makeState('puristRock', 'puristPaper', { condition: 'reach_round', value: 2 });
    getNpcThrow(ms, null, 0, { roundNumber: 2, playerRoundsWon: 0, npcRoundsWon: 0 });
    assertEqual(ms.strategySwapped, true);
    assertEqual(ms.strategy, 'puristPaper');
    // Continue playing — strategy stays at secondary
    getNpcThrow(ms, null, 0, { roundNumber: 3, playerRoundsWon: 0, npcRoundsWon: 0 });
    assertEqual(ms.strategy, 'puristPaper');
  });

  test('puristRandom re-rolls lockedThrow at switch', () => {
    const ms = makeState('puristRock', 'puristRandom', { condition: 'reach_round', value: 2 });
    assertEqual(ms.lockedThrow, null); // starts null (primary is not puristRandom)
    getNpcThrow(ms, null, 0, { roundNumber: 2, playerRoundsWon: 0, npcRoundsWon: 0 });
    assertEqual(ms.strategySwapped, true);
    assertOneOf(ms.lockedThrow, THROWS); // now set
  });
});

// ── npcDecideActiveSkill ──────────────────────────────────────────────────────

describe('npcDecideActiveSkill', () => {
  const ctx0 = { roundNumber: 1, playerRoundsWon: 0, npcRoundsWon: 0 };
  const ctxBehind = { roundNumber: 3, playerRoundsWon: 2, npcRoundsWon: 0 };

  function buildMatchState(strategy = 'random') {
    return initNpcMatchState({ primaryStrategy: strategy });
  }

  test('returns null when no skills', () => {
    const ms = buildMatchState();
    const ss = initNpcSkillState();
    const result = npcDecideActiveSkill(ms, () => false, ctx0, ss);
    assertEqual(result, null);
  });

  test('returns TML when has FORTUNE.1.1 and player is winning', () => {
    const ms = buildMatchState();
    const ss = initNpcSkillState();
    const has = (id) => id === 'FORTUNE.1.1';
    const result = npcDecideActiveSkill(ms, has, ctxBehind, ss);
    assertEqual(result, 'TML');
  });

  test('returns ATML when has FORTUNE.1.1.1.1 and player is winning', () => {
    const ms = buildMatchState();
    const ss = initNpcSkillState();
    const has = (id) => id === 'FORTUNE.1.1.1.1';
    const result = npcDecideActiveSkill(ms, has, ctxBehind, ss);
    assertEqual(result, 'ATML');
  });

  test('TML/ATML not used when cooldown > 0', () => {
    const ms = buildMatchState();
    const ss = initNpcSkillState();
    ss.tmlCooldown = 3;
    const has = (id) => id === 'FORTUNE.1.1';
    const result = npcDecideActiveSkill(ms, has, ctxBehind, ss);
    assertEqual(result, null);
  });

  test('Force Your Hand fires for purist strategy (tie-prone)', () => {
    const ms = buildMatchState('puristRock');
    const ss = initNpcSkillState();
    const has = (id) => id === 'MYSTIC.1.1.1';
    // Force roll to avoid the random 20% path interfering — use withRoll(0)
    const result = withRoll(0, () => npcDecideActiveSkill(ms, has, ctx0, ss));
    assertEqual(result, 'forceYourHand');
  });

  test('twistYourArm preferred over Force Your Hand when both owned', () => {
    const ms = buildMatchState('puristRock');
    const ss = initNpcSkillState();
    const has = (id) => id === 'MYSTIC.1.1.1' || id === 'MYSTIC.1.1.1.1';
    const result = withRoll(0, () => npcDecideActiveSkill(ms, has, ctx0, ss));
    assertEqual(result, 'twistYourArm');
  });

  test('Force Your Hand not used when cooldown > 0', () => {
    const ms = buildMatchState('puristRock');
    const ss = initNpcSkillState();
    ss.forceYourHandCooldown = 2;
    const has = (id) => id === 'MYSTIC.1.1.1';
    const result = withRoll(0, () => npcDecideActiveSkill(ms, has, ctx0, ss));
    assertEqual(result, null);
  });

  test('refuseToLose fires when behind and cooldown = 0', () => {
    const ms = buildMatchState();
    const ss = initNpcSkillState();
    const has = (id) => id === 'MYSTIC.1.1.2.1';
    const result = npcDecideActiveSkill(ms, has, ctxBehind, ss);
    assertEqual(result, 'refuseToLose');
  });

  test('refuseToLose not used when cooldown > 0', () => {
    const ms = buildMatchState();
    const ss = initNpcSkillState();
    ss.refuseToLoseCooldown = 1;
    const has = (id) => id === 'MYSTIC.1.1.2.1';
    const result = npcDecideActiveSkill(ms, has, ctxBehind, ss);
    assertEqual(result, null);
  });
});

// ── Constants sanity checks ───────────────────────────────────────────────────

describe('NPC skill constants', () => {
  test('THE_FREEZER_CHANCE is 0.75', () => {
    assertEqual(THE_FREEZER_CHANCE, 0.75);
  });

  test('NOT_TODAY_CHANCE is 0.95', () => {
    assertEqual(NOT_TODAY_CHANCE, 0.95);
  });

  test('TML_COOLDOWN_ROUNDS is defined and positive', () => {
    assert(TML_COOLDOWN_ROUNDS > 0, 'TML_COOLDOWN_ROUNDS must be positive');
  });

  test('ATML_COOLDOWN_ROUNDS < TML_COOLDOWN_ROUNDS (ATML is shorter)', () => {
    assert(ATML_COOLDOWN_ROUNDS < TML_COOLDOWN_ROUNDS, 'ATML should have shorter cooldown than TML');
  });

  test('TWIST_YOUR_ARM_COOLDOWN_ROUNDS <= FORCE_YOUR_HAND_COOLDOWN_ROUNDS', () => {
    assert(
      TWIST_YOUR_ARM_COOLDOWN_ROUNDS <= FORCE_YOUR_HAND_COOLDOWN_ROUNDS,
      'Twist Your Arm should not have a longer cooldown than Force Your Hand'
    );
  });
});
