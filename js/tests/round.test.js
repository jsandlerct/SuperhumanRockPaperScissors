import { describe, test, assert, assertEqual } from './testRunner.js';
import { resolveRound, BEATS } from '../systems/round.js';

// ── BEATS map ─────────────────────────────────────────────────────────────────

describe('BEATS map', () => {
  test('rock beats scissors', () => assertEqual(BEATS.rock, 'scissors'));
  test('scissors beats paper', () => assertEqual(BEATS.scissors, 'paper'));
  test('paper beats rock',    () => assertEqual(BEATS.paper, 'rock'));

  test('every entry points to a valid throw', () => {
    const valid = new Set(['rock', 'paper', 'scissors']);
    for (const [from, to] of Object.entries(BEATS)) {
      assert(valid.has(to), `BEATS.${from} must be a valid throw, got: ${to}`);
    }
  });

  test('no throw beats itself', () => {
    for (const [from, to] of Object.entries(BEATS)) {
      assert(from !== to, `${from} must not beat itself`);
    }
  });

  test('BEATS covers all three throws', () => {
    assertEqual(Object.keys(BEATS).length, 3);
  });
});

// ── resolveRound — ties ───────────────────────────────────────────────────────

describe('resolveRound — ties', () => {
  test('rock vs rock is a tie',         () => assertEqual(resolveRound('rock', 'rock'), 'tie'));
  test('paper vs paper is a tie',       () => assertEqual(resolveRound('paper', 'paper'), 'tie'));
  test('scissors vs scissors is a tie', () => assertEqual(resolveRound('scissors', 'scissors'), 'tie'));
});

// ── resolveRound — player wins ────────────────────────────────────────────────

describe('resolveRound — player wins', () => {
  test('rock beats scissors → player', () => assertEqual(resolveRound('rock', 'scissors'), 'player'));
  test('scissors beats paper → player', () => assertEqual(resolveRound('scissors', 'paper'), 'player'));
  test('paper beats rock → player',     () => assertEqual(resolveRound('paper', 'rock'), 'player'));
});

// ── resolveRound — opponent wins ──────────────────────────────────────────────

describe('resolveRound — opponent wins', () => {
  test('scissors loses to rock → opponent',  () => assertEqual(resolveRound('scissors', 'rock'), 'opponent'));
  test('rock loses to paper → opponent',     () => assertEqual(resolveRound('rock', 'paper'), 'opponent'));
  test('paper loses to scissors → opponent', () => assertEqual(resolveRound('paper', 'scissors'), 'opponent'));
});

// ── resolveRound — symmetry ───────────────────────────────────────────────────

describe('resolveRound — symmetry', () => {
  test('swapping player and opponent always flips the winner', () => {
    const cases = [
      ['rock', 'scissors'],
      ['scissors', 'paper'],
      ['paper', 'rock'],
    ];
    for (const [p, o] of cases) {
      assertEqual(resolveRound(p, o), 'player',   `${p} vs ${o}: player should win`);
      assertEqual(resolveRound(o, p), 'opponent', `${o} vs ${p}: opponent should win`);
    }
  });

  test('all same-throw matchups are ties', () => {
    for (const t of ['rock', 'paper', 'scissors']) {
      assertEqual(resolveRound(t, t), 'tie', `${t} vs ${t} must be a tie`);
    }
  });

  test('exactly 3 wins, 3 losses, 3 ties across all 9 matchups', () => {
    const throws = ['rock', 'paper', 'scissors'];
    let wins = 0, losses = 0, ties = 0;
    for (const p of throws) {
      for (const o of throws) {
        const r = resolveRound(p, o);
        if (r === 'player')   wins++;
        else if (r === 'opponent') losses++;
        else ties++;
      }
    }
    assertEqual(wins,   3, 'must be exactly 3 player-win matchups');
    assertEqual(losses, 3, 'must be exactly 3 player-loss matchups');
    assertEqual(ties,   3, 'must be exactly 3 tie matchups');
  });
});
