import { describe, test, assert, assertEqual, assertOneOf } from './testRunner.js';
import { setRollFn, resetRoll } from '../utils/rng.js';
import { initNpcMatchState, getNpcThrow, recordPlayerThrow } from '../systems/npc.js';

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

  test('produces all three throws over enough trials', () => {
    const state = initNpcMatchState(npc('random'));
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(getNpcThrow(state));
    assertEqual(seen.size, 3, 'should produce all 3 throws in 100 rounds');
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

  test('3-5 throws: sometimes uses read, sometimes random', () => {
    // Run many independent trials; both outcomes must appear
    let usedRead = false, usedRandom = false;
    for (let i = 0; i < 40; i++) {
      const state = initNpcMatchState(npc('historian'));
      for (let j = 0; j < 4; j++) recordPlayerThrow(state, 'rock'); // 4 throws
      const t = getNpcThrow(state);
      if (t === 'paper') usedRead = true;   // paper = counter to rock
      else               usedRandom = true;
    }
    assert(usedRead,   '3–5 throw window: should use the read at least once in 40 trials');
    assert(usedRandom, '3–5 throw window: should go random at least once in 40 trials');
  });

  test('accuracy increases with sample size (more reads at 6+ vs 3–5)', () => {
    let readsAt4 = 0, readsAt7 = 0;
    const TRIALS = 60;
    for (let i = 0; i < TRIALS; i++) {
      const s4 = initNpcMatchState(npc('historian'));
      for (let j = 0; j < 4; j++) recordPlayerThrow(s4, 'rock');
      if (getNpcThrow(s4) === 'paper') readsAt4++;

      const s7 = initNpcMatchState(npc('historian'));
      for (let j = 0; j < 7; j++) recordPlayerThrow(s7, 'rock');
      if (getNpcThrow(s7) === 'paper') readsAt7++;
    }
    assert(readsAt7 > readsAt4, `historian should read more accurately at 7 throws (${readsAt7}) than 4 (${readsAt4})`);
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
