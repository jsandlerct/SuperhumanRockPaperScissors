// Maps each throw to what it defeats
export const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

// Returns 'player' | 'opponent' | 'tie'
export function resolveRound(playerThrow, opponentThrow) {
  if (playerThrow === opponentThrow) return 'tie';
  return BEATS[playerThrow] === opponentThrow ? 'player' : 'opponent';
}
