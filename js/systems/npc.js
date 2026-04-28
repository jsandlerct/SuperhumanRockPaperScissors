import { roll } from '../utils/rng.js';

const THROWS = ['rock', 'paper', 'scissors'];

function randomThrow() {
  return THROWS[Math.floor(roll() * 3)];
}

// Call once at match start. Returns a matchState object passed to getNpcThrow each round.
export function initNpcMatchState(npc) {
  const strategy = npc.primaryStrategy;
  return {
    strategy,
    lockedThrow:     strategy === 'puristRandom' ? randomThrow() : null,
    lastPlayerThrow: null,
  };
}

// Returns 'rock' | 'paper' | 'scissors'.
// Call AFTER updating matchState.lastPlayerThrow from the previous round.
export function getNpcThrow(matchState) {
  switch (matchState.strategy) {
    case 'random':          return randomThrow();
    case 'puristRock':      return 'rock';
    case 'puristPaper':     return 'paper';
    case 'puristScissors':  return 'scissors';
    case 'puristRandom':    return matchState.lockedThrow;
    case 'mirror':
      // Throw whatever player threw last round; round 1 has no history so random
      return matchState.lastPlayerThrow ?? randomThrow();
    default:
      return randomThrow();
  }
}
