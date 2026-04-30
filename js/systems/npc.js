import { roll } from '../utils/rng.js';

const THROWS = ['rock', 'paper', 'scissors'];

// What throw beats each key
const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

function randomThrow() {
  return THROWS[Math.floor(roll() * 3)];
}

// Returns the most frequent throw in an array, or null if empty
function mostFrequent(throwHistory) {
  if (!throwHistory.length) return null;
  const counts = { rock: 0, paper: 0, scissors: 0 };
  for (const t of throwHistory) counts[t]++;
  return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a)[0];
}

// Call once at match start. Returns a matchState object passed to getNpcThrow each round.
export function initNpcMatchState(npc) {
  const strategy = npc.primaryStrategy;
  return {
    strategy,
    // puristRandom
    lockedThrow:      strategy === 'puristRandom' ? randomThrow() : null,
    // mirror / counter / tilted
    lastPlayerThrow:  null,
    // momentum
    lastNpcThrow:     null,
    // cycler
    cycleIndex:       0,
    // tilted: track round win differential from NPC perspective
    npcRoundsWon:     0,
    playerRoundsWon:  0,
    tilted:           false,
    // streaker / mimic / historian: full player throw history
    // maskedThrows param (v0.3: Blank Slate masks last N throws from these strategies)
    playerThrowHistory: [],
  };
}

// Returns 'rock' | 'paper' | 'scissors'.
// maskedThrows: number of recent throws to hide from history-reading strategies (v0.3 Blank Slate).
export function getNpcThrow(matchState, lastRoundResult = null, maskedThrows = 0) {
  // Update round win tracking for tilted
  if (lastRoundResult === 'opponent') matchState.npcRoundsWon++;
  if (lastRoundResult === 'player')   matchState.playerRoundsWon++;

  // Check tilt trigger (NPC losing by 2+ rounds)
  if (!matchState.tilted &&
      matchState.strategy === 'tilted' &&
      matchState.playerRoundsWon - matchState.npcRoundsWon >= 2) {
    matchState.tilted = true;
  }

  let throw_;

  switch (matchState.strategy) {
    case 'random':
      throw_ = randomThrow();
      break;

    case 'puristRock':      throw_ = 'rock';    break;
    case 'puristPaper':     throw_ = 'paper';   break;
    case 'puristScissors':  throw_ = 'scissors'; break;

    case 'puristRandom':
      throw_ = matchState.lockedThrow;
      break;

    case 'mirror':
      throw_ = matchState.lastPlayerThrow ?? randomThrow();
      break;

    case 'counter':
      throw_ = matchState.lastPlayerThrow
        ? COUNTER[matchState.lastPlayerThrow]
        : randomThrow();
      break;

    case 'cycler':
      throw_ = THROWS[matchState.cycleIndex % 3];
      matchState.cycleIndex++;
      break;

    case 'momentum':
      // Repeat winning throw until they lose, then random
      throw_ = (lastRoundResult === 'opponent' && matchState.lastNpcThrow)
        ? matchState.lastNpcThrow
        : randomThrow();
      break;

    case 'tilted':
      // Pre-tilt: counter strategy; post-tilt: pure panic random
      throw_ = matchState.tilted
        ? randomThrow()
        : (matchState.lastPlayerThrow ? COUNTER[matchState.lastPlayerThrow] : randomThrow());
      break;

    case 'streaker': {
      // Counter detected player streaks (same throw 2+ times in a row)
      const history = matchState.playerThrowHistory.slice(0, matchState.playerThrowHistory.length - maskedThrows);
      if (history.length >= 2) {
        const last  = history[history.length - 1];
        const prev  = history[history.length - 2];
        if (last === prev) {
          throw_ = COUNTER[last]; // counter the streak
          break;
        }
      }
      throw_ = randomThrow();
      break;
    }

    case 'mimic': {
      // Counter the player's most-thrown sign
      const history = matchState.playerThrowHistory.slice(0, matchState.playerThrowHistory.length - maskedThrows);
      const top = mostFrequent(history);
      throw_ = top ? COUNTER[top] : randomThrow();
      break;
    }

    case 'historian': {
      // Like mimic but only reads confidently after enough data (improves with sample size)
      const history = matchState.playerThrowHistory.slice(0, matchState.playerThrowHistory.length - maskedThrows);
      const top = mostFrequent(history);
      if (!top || history.length < 3) {
        // Too little data — random
        throw_ = randomThrow();
      } else if (history.length < 6) {
        // Partial confidence — 50% chance to use the read
        throw_ = roll() < 0.5 ? COUNTER[top] : randomThrow();
      } else {
        // Full confidence
        throw_ = COUNTER[top];
      }
      break;
    }

    default:
      throw_ = randomThrow();
  }

  // Update momentum tracking
  matchState.lastNpcThrow = throw_;

  return throw_;
}

// Call after the player's throw is known each round, before getNpcThrow for the next round.
export function recordPlayerThrow(matchState, playerThrow) {
  matchState.lastPlayerThrow = playerThrow;
  matchState.playerThrowHistory.push(playerThrow);
}
