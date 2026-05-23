import { roll } from '../utils/rng.js';
import {
  TML_COOLDOWN_ROUNDS, ATML_COOLDOWN_ROUNDS,
  FORCE_YOUR_HAND_COOLDOWN_ROUNDS, TWIST_YOUR_ARM_COOLDOWN_ROUNDS,
} from '../constants.js';

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

// Returns per-match NPC skill state object (in-memory, not persisted).
export function initNpcSkillState() {
  return {
    tmlCooldown:           0,   // FORTUNE.1.1 / ATML (FORTUNE.1.1.1.1)
    forceYourHandCooldown: 0,   // MYSTIC.1.1.1 / Twist Your Arm (MYSTIC.1.1.1.1)
    refuseToLoseCooldown:  0,   // MYSTIC.1.1.2.1 equivalent
    thirdTimesCharmFails:  0,   // MYSTIC.1.1.2 consecutive failed tie conversions
    thirdTimesCharmUsed:   false,
    dueForAWinFails:       0,   // FORTUNE.1.1.2 consecutive TML failures
    dueForAWinUsed:        false,
    nprAccumulation:       0.0, // MIND.1.1 behavioral accuracy model (accumulates per round)
    powerupBlockedRounds:  0,   // Padlock: number of rounds NPC powerup is blocked
  };
}

// Call once at match start. Returns a matchState object passed to getNpcThrow each round.
export function initNpcMatchState(npc) {
  const strategy = npc.primaryStrategy;
  return {
    strategy,
    secondaryStrategy: npc.secondaryStrategy ?? null,
    switchTrigger:     npc.switchTrigger     ?? null,
    strategySwapped:   false,
    // puristRandom
    lockedThrow:       strategy === 'puristRandom' ? randomThrow() : null,
    // mirror / counter / tilted
    lastPlayerThrow:   null,
    // momentum
    lastNpcThrow:      null,
    // cycler
    cycleIndex:        0,
    // tilted: track round win differential from NPC perspective
    npcRoundsWon:      0,
    playerRoundsWon:   0,
    tilted:            false,
    // streaker / mimic / historian: full player throw history
    playerThrowHistory: [],
  };
}

// Returns 'rock' | 'paper' | 'scissors'.
// maskedThrows: number of recent throws to hide from history-reading strategies (Blank Slate).
// roundCtx: { roundNumber, playerRoundsWon, npcRoundsWon } — used for secondary strategy switch.
export function getNpcThrow(matchState, lastRoundResult = null, maskedThrows = 0, roundCtx = null) {
  // Update round win tracking for tilted
  if (lastRoundResult === 'opponent') matchState.npcRoundsWon++;
  if (lastRoundResult === 'player')   matchState.playerRoundsWon++;

  // Secondary strategy switching
  if (matchState.secondaryStrategy && !matchState.strategySwapped && roundCtx) {
    const t = matchState.switchTrigger;
    if (t) {
      const triggered =
        (t.condition === 'reach_round' && roundCtx.roundNumber >= t.value) ||
        (t.condition === 'losing_by'   && roundCtx.playerRoundsWon - roundCtx.npcRoundsWon >= t.value) ||
        (t.condition === 'winning_by'  && roundCtx.npcRoundsWon - roundCtx.playerRoundsWon >= t.value);
      if (triggered) {
        matchState.strategy = matchState.secondaryStrategy;
        matchState.strategySwapped = true;
        // puristRandom re-rolls at strategy switch
        if (matchState.strategy === 'puristRandom') {
          matchState.lockedThrow = randomThrow();
        }
      }
    }
  }

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

// Decides which NPC active skill to use this round, if any.
// Returns 'TML' | 'ATML' | 'forceYourHand' | 'twistYourArm' | null.
// npcHasSkill: function(nodeId) => boolean (reads NPC's treeState from world bucket)
// ctx: { roundNumber, playerRoundsWon, npcRoundsWon }
export function npcDecideActiveSkill(matchState, npcHasSkill, ctx, skillState) {
  const { playerRoundsWon, npcRoundsWon } = ctx;

  // TML / ATML: use when behind (player has more rounds) or in a dire situation
  if (skillState.tmlCooldown === 0) {
    const hasTML  = npcHasSkill('FORTUNE.1.1');
    const hasATML = npcHasSkill('FORTUNE.1.1.1.1');
    if (hasTML || hasATML) {
      // Use TML when losing, or when tied and strategy suggests risk
      if (playerRoundsWon > npcRoundsWon || (playerRoundsWon === npcRoundsWon && roll() < 0.3)) {
        return hasATML ? 'ATML' : 'TML';
      }
    }
  }

  // Force Your Hand / Twist Your Arm: use when tied with a random/purist strategy (tie-prone)
  if (skillState.forceYourHandCooldown === 0) {
    const hasTYA = npcHasSkill('MYSTIC.1.1.1.1');
    const hasFYH = npcHasSkill('MYSTIC.1.1.1');
    if (hasTYA || hasFYH) {
      // Use when likely to tie (purist strategies, or randomly 20% of the time)
      const tieProne = ['puristRock', 'puristPaper', 'puristScissors', 'puristRandom']
        .includes(matchState.strategy);
      if (tieProne || roll() < 0.20) {
        return hasTYA ? 'twistYourArm' : 'forceYourHand';
      }
    }
  }

  // Refuse to Lose (MYSTIC.1.1.2.1 equivalent): use when losing a round seems likely
  if (skillState.refuseToLoseCooldown === 0 && npcHasSkill('MYSTIC.1.1.2.1')) {
    // Use when behind or randomly 15% of the time as a defensive hedge
    if (playerRoundsWon > npcRoundsWon || roll() < 0.15) {
      return 'refuseToLose';
    }
  }

  return null;
}

// Returns the most frequent throw, exported for use in match.js MIND behavioral model.
export function mostFrequentThrow(history) {
  return mostFrequent(history);
}

// Call after the player's throw is known each round, before getNpcThrow for the next round.
export function recordPlayerThrow(matchState, playerThrow) {
  matchState.lastPlayerThrow = playerThrow;
  matchState.playerThrowHistory.push(playerThrow);
}
