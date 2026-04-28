import { ELO_K_FACTOR } from '../constants.js';

export function winProbability(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// score: 1 = win, 0.5 = draw, 0 = loss
export function calcNewElo(currentElo, opponentElo, score) {
  const expected = winProbability(currentElo, opponentElo);
  return Math.round(currentElo + ELO_K_FACTOR * (score - expected));
}
