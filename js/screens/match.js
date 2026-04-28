import { navigate } from '../main.js';
import { getNpcById } from '../main.js';
import { resolveRound } from '../systems/round.js';
import { initNpcMatchState, getNpcThrow } from '../systems/npc.js';
import { calcNewElo } from '../systems/elo.js';
import { ROUNDS_TO_WIN_MATCH } from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
  loadStats, saveStats, loadTournament, saveTournament,
} from '../storage.js';

const THROW_LABEL = { rock: '✊ ROCK', paper: '✋ PAPER', scissors: '✌ SCISSORS' };
const ROUND_WIN   = '■';
const ROUND_EMPTY = '□';

function scoreBar(won) {
  return Array.from({ length: ROUNDS_TO_WIN_MATCH }, (_, i) =>
    `<span style="color:${i < won ? 'var(--snes-yellow)' : 'var(--snes-border)'}">${i < won ? ROUND_WIN : ROUND_EMPTY}</span>`
  ).join(' ');
}

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const identity = loadIdentity(charId);
  const progress = loadProgress(charId);

  const tournamentData = loadTournament(charId);
  const cm = tournamentData.currentMatch;
  const npc = getNpcById(cm.opponentId);

  // In-memory match state — never persisted mid-round
  let playerRoundsWon   = 0;
  let opponentRoundsWon = 0;
  let roundNumber       = 1;
  let screenState       = 'picking'; // 'picking' | 'revealing' | 'match_over'
  let lastPlayerThrow   = null;
  let lastOpponentThrow = null;
  let lastRoundResult   = null;

  const npcMatchState = initNpcMatchState(npc);

  // ── Render ──────────────────────────────────────────────────────────────────

  function render() {
    const playerName  = identity?.name?.toUpperCase() ?? 'YOU';
    const playerPortrait = identity?.portraitId ?? 'male_1';
    const npcPortrait    = npc.portraitId;
    const npcName        = npc.name.toUpperCase();

    let bodyHTML = '';

    if (screenState === 'picking') {
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">
          ── ROUND ${roundNumber} ──
        </p>
        <p class="snes-small snes-muted" style="text-align:center;margin-bottom:4px">
          CHOOSE YOUR THROW
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="snes-btn" data-throw="rock"     style="width:100%">${THROW_LABEL.rock}</button>
          <button class="snes-btn" data-throw="paper"    style="width:100%">${THROW_LABEL.paper}</button>
          <button class="snes-btn" data-throw="scissors" style="width:100%">${THROW_LABEL.scissors}</button>
        </div>
      `;
    } else if (screenState === 'revealing') {
      const resultMsg   = lastRoundResult === 'player'   ? 'YOU WIN THIS ROUND!'
                        : lastRoundResult === 'opponent' ? 'YOU LOSE THIS ROUND.'
                        : 'TIE!';
      const resultColor = lastRoundResult === 'player'   ? 'snes-success'
                        : lastRoundResult === 'opponent' ? 'snes-error'
                        : 'snes-highlight';
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} ──</p>
        <div class="snes-panel" style="display:flex;justify-content:space-around;align-items:center;gap:8px">
          <div style="text-align:center">
            <p class="snes-small snes-muted">YOU</p>
            <p class="snes-label" style="margin-top:4px">${THROW_LABEL[lastPlayerThrow]}</p>
          </div>
          <p class="snes-label">VS</p>
          <div style="text-align:center">
            <p class="snes-small snes-muted">THEM</p>
            <p class="snes-label" style="margin-top:4px">${THROW_LABEL[lastOpponentThrow]}</p>
          </div>
        </div>
        <p class="snes-label ${resultColor}" style="text-align:center">${resultMsg}</p>
        <button class="snes-btn snes-btn-yellow" id="btn-next" style="width:100%">▶ NEXT</button>
      `;
    } else if (screenState === 'match_over') {
      const won = playerRoundsWon >= ROUNDS_TO_WIN_MATCH;
      bodyHTML = `
        <div class="snes-panel" style="text-align:center;display:flex;flex-direction:column;gap:12px">
          <p class="snes-label ${won ? 'snes-success' : 'snes-error'}" style="font-size:12px">
            ${won ? 'YOU WIN!' : 'YOU LOSE.'}
          </p>
          <p class="snes-small snes-muted">FINAL SCORE</p>
          <p class="snes-label">
            <span class="snes-highlight">${playerRoundsWon}</span>
            <span class="snes-muted"> – </span>
            <span>${opponentRoundsWon}</span>
          </p>
        </div>
        <button class="snes-btn snes-btn-yellow" id="btn-continue" style="width:100%">▶ CONTINUE</button>
      `;
    }

    // Round history log
    const historyHTML = tournamentData.currentMatch.roundHistory.length > 0
      ? tournamentData.currentMatch.roundHistory.map(r => {
          const won = r.winner === 'player';
          const tie = r.winner === 'tie';
          return `<span class="snes-small ${won ? 'snes-success' : tie ? 'snes-highlight' : 'snes-error'}">
            R${r.round}: ${r.playerThrow[0].toUpperCase()} vs ${r.opponentThrow[0].toUpperCase()}
            ${won ? '▲' : tie ? '─' : '▼'}
          </span>`;
        }).join('  ')
      : '';

    container.innerHTML = `
      <div class="screen fade-in" style="gap:14px">

        <!-- Scoreboard -->
        <div style="display:flex;align-items:center;gap:10px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
            <div class="portrait-frame portrait-frame--md">
              <img src="assets/portraits/${playerPortrait}.png" alt="">
            </div>
            <p class="snes-small snes-highlight" style="text-align:center;word-break:break-all">${playerName}</p>
            <p style="font-size:10px;text-align:center">${scoreBar(playerRoundsWon)}</p>
          </div>

          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
            <p class="snes-small snes-muted">${cm.matchType === 'final' ? 'FINAL' : 'SEMI'}</p>
            <p class="snes-label">VS</p>
          </div>

          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
            <div class="portrait-frame portrait-frame--md">
              <img src="assets/portraits/${npcPortrait}.png" alt="">
            </div>
            <p class="snes-small" style="text-align:center;word-break:break-all">${npcName}</p>
            <p style="font-size:10px;text-align:center">${scoreBar(opponentRoundsWon)}</p>
          </div>
        </div>

        <!-- Greeting (first screen only) -->
        ${screenState === 'picking' && roundNumber === 1
          ? `<div class="snes-panel">
               <p class="snes-small snes-muted" style="line-height:2">"${npc.greeting}"</p>
             </div>`
          : ''}

        <!-- Main action area -->
        ${bodyHTML}

        <!-- Round history -->
        ${historyHTML
          ? `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">${historyHTML}</div>`
          : ''}

      </div>
    `;

    attachListeners();
  }

  // ── Listeners ───────────────────────────────────────────────────────────────

  function attachListeners() {
    if (screenState === 'picking') {
      container.querySelectorAll('[data-throw]').forEach(btn => {
        btn.addEventListener('click', () => handleThrow(btn.dataset.throw));
      });
    } else if (screenState === 'revealing') {
      document.getElementById('btn-next')?.addEventListener('click', advanceRound);
    } else if (screenState === 'match_over') {
      document.getElementById('btn-continue')?.addEventListener('click', finishMatch);
    }
  }

  // ── Round logic ──────────────────────────────────────────────────────────────

  function handleThrow(playerThrow) {
    const opponentThrow = getNpcThrow(npcMatchState);
    const result        = resolveRound(playerThrow, opponentThrow);

    lastPlayerThrow   = playerThrow;
    lastOpponentThrow = opponentThrow;
    lastRoundResult   = result;

    if (result === 'player')   playerRoundsWon++;
    if (result === 'opponent') opponentRoundsWon++;

    // Update round history in currentMatch (persisted so resume/forfeit detection works)
    tournamentData.currentMatch.roundHistory.push({
      round:         roundNumber,
      playerThrow,
      opponentThrow,
      winner:        result,
    });
    tournamentData.currentMatch.playerRoundsWon   = playerRoundsWon;
    tournamentData.currentMatch.opponentRoundsWon = opponentRoundsWon;
    saveTournament(charId, tournamentData);

    // Update npc strategy state for mirror
    npcMatchState.lastPlayerThrow = playerThrow;

    screenState = 'revealing';
    render();
  }

  function advanceRound() {
    if (playerRoundsWon >= ROUNDS_TO_WIN_MATCH ||
        opponentRoundsWon >= ROUNDS_TO_WIN_MATCH) {
      screenState = 'match_over';
    } else {
      roundNumber++;
      screenState = 'picking';
    }
    render();
  }

  // ── Match completion ─────────────────────────────────────────────────────────

  function finishMatch() {
    const playerWon = playerRoundsWon >= ROUNDS_TO_WIN_MATCH;
    const matchResult = playerWon ? 'p1_won' : 'p2_won';
    const score       = [playerRoundsWon, opponentRoundsWon];

    // Write result into bracket
    const rounds = tournamentData.bracket.rounds;
    for (const round of rounds) {
      for (const match of round.matches) {
        if ((match.p1 === 'player' || match.p2 === 'player') && match.result === null) {
          // Flip p1_won/p2_won if player is p2
          match.result = match.p1 === 'player' ? matchResult : (playerWon ? 'p2_won' : 'p1_won');
          match.score  = match.p1 === 'player' ? score : [score[1], score[0]];
          break;
        }
      }
    }

    // Clear currentMatch
    tournamentData.currentMatch = null;
    saveTournament(charId, tournamentData);

    // Update player ELO
    const npcElo = npc.startingElo;
    const newElo = calcNewElo(progress.currentElo, npcElo, playerWon ? 1 : 0);
    progress.currentElo = newElo;
    progress.peakElo    = Math.max(progress.peakElo, newElo);
    saveProgress(charId, progress);

    // Update match stats
    const stats = loadStats(charId);
    stats.career.totalMatches++;
    stats.career[playerWon ? 'matchWins' : 'matchLosses']++;
    saveStats(charId, stats);

    navigate('tournament', { charId });
  }

  // ── Go ───────────────────────────────────────────────────────────────────────

  render();
}
