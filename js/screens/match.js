import { navigate } from '../main.js';
import { getNpcById } from '../main.js';
import { resolveRound } from '../systems/round.js';
import { initNpcMatchState, getNpcThrow, recordPlayerThrow } from '../systems/npc.js';
import { calcNewElo } from '../systems/elo.js';
import { ROUNDS_TO_WIN_MATCH, ROUNDS_TO_WIN_MATCH_FINALS } from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
  loadStats, saveStats, loadTournament, saveTournament,
} from '../storage.js';

const THROW_NAME = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
const ROUND_WIN   = '■';
const ROUND_EMPTY = '□';

function scoreBar(won, target) {
  return Array.from({ length: target }, (_, i) =>
    `<span style="color:${i < won ? 'var(--snes-yellow)' : 'var(--snes-border)'}">${i < won ? ROUND_WIN : ROUND_EMPTY}</span>`
  ).join(' ');
}

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const identity = loadIdentity(charId);
  const progress = loadProgress(charId);

  const tournamentData  = loadTournament(charId);
  const cm              = tournamentData.currentMatch;
  const npc             = getNpcById(cm.opponentId);
  const roundsToWin     = cm.matchType === 'finals' ? ROUNDS_TO_WIN_MATCH_FINALS : ROUNDS_TO_WIN_MATCH;

  // In-memory match state — never persisted mid-round
  let playerRoundsWon   = 0;
  let opponentRoundsWon = 0;
  let roundNumber       = 1;
  // Round phase flow: powerup_stub → skill_stub → picking → revealing → match_over
  let screenState       = 'powerup_stub';
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

    if (screenState === 'powerup_stub') {
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} ──</p>
        <div class="snes-panel" style="opacity:0.5;text-align:center;display:flex;flex-direction:column;gap:10px">
          <p class="snes-small snes-muted">POWERUP PHASE</p>
          <p class="snes-small">NO POWERUPS IN INVENTORY</p>
          <p class="snes-small snes-muted">[UNLOCKS V0.2]</p>
        </div>
        <button class="snes-btn snes-btn-yellow" id="btn-powerup-done" style="width:100%">▶ CONTINUE</button>
      `;
    } else if (screenState === 'skill_stub') {
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} ──</p>
        <div class="snes-panel" style="opacity:0.5;text-align:center;display:flex;flex-direction:column;gap:10px">
          <p class="snes-small snes-muted">SKILL PHASE</p>
          <p class="snes-small">NO ACTIVE SKILLS EQUIPPED</p>
          <p class="snes-small snes-muted">[UNLOCKS V0.3]</p>
        </div>
        <button class="snes-btn snes-btn-yellow" id="btn-skill-done" style="width:100%">▶ CONTINUE</button>
      `;
    } else if (screenState === 'picking') {
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">
          ── ROUND ${roundNumber} ──
        </p>
        <p class="snes-small snes-muted" style="text-align:center;margin-bottom:4px">
          CHOOSE YOUR THROW
        </p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <button class="throw-btn" data-throw="rock">
            <img src="assets/hands/rock.png" alt="Rock" draggable="false">
            <span>ROCK</span>
          </button>
          <button class="throw-btn" data-throw="paper">
            <img src="assets/hands/paper.png" alt="Paper" draggable="false">
            <span>PAPER</span>
          </button>
          <button class="throw-btn" data-throw="scissors">
            <img src="assets/hands/scissors.png" alt="Scissors" draggable="false">
            <span>SCISSORS</span>
          </button>
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
        <div class="snes-panel">
          <div class="throw-reveal">
            <div class="throw-reveal-side">
              <img src="assets/hands/${lastPlayerThrow}.png" alt="${lastPlayerThrow}" draggable="false">
              <p class="snes-small snes-highlight">YOU</p>
              <p class="snes-small">${THROW_NAME[lastPlayerThrow]}</p>
            </div>
            <p class="snes-label" style="flex-shrink:0">VS</p>
            <div class="throw-reveal-side throw-reveal-side--flip">
              <img src="assets/hands/${lastOpponentThrow}.png" alt="${lastOpponentThrow}" draggable="false">
              <p class="snes-small snes-muted">THEM</p>
              <p class="snes-small">${THROW_NAME[lastOpponentThrow]}</p>
            </div>
          </div>
        </div>
        <p class="snes-label ${resultColor}" style="text-align:center">${resultMsg}</p>
        <button class="snes-btn snes-btn-yellow" id="btn-next" style="width:100%">▶ NEXT</button>
      `;
    } else if (screenState === 'match_over') {
      const won = playerRoundsWon >= roundsToWin;
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

    const greetingHTML = screenState === 'picking' && roundNumber === 1
      ? `<div class="snes-panel">
           <p class="snes-small snes-muted" style="line-height:2">"${npc.greeting}"</p>
         </div>`
      : '';

    container.innerHTML = `
      <div class="screen fade-in" style="gap:0">
        <div class="match-layout">

          <!-- Left panel: scoreboard + greeting + round history -->
          <div class="match-panel">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
                <div class="portrait-frame portrait-frame--match">
                  <img src="assets/portraits/${playerPortrait}.png" alt="">
                </div>
                <p class="snes-small snes-highlight" style="text-align:center;word-break:break-all">${playerName}</p>
                <p style="font-size:10px;text-align:center">${scoreBar(playerRoundsWon, roundsToWin)}</p>
              </div>

              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
                <p class="snes-small snes-muted">${(cm.roundName ?? '').toUpperCase()}</p>
                <p class="snes-label">VS</p>
              </div>

              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
                <div class="portrait-frame portrait-frame--match">
                  <img src="assets/portraits/${npcPortrait}.png" alt="">
                </div>
                <p class="snes-small" style="text-align:center;word-break:break-all">${npcName}</p>
                <p style="font-size:10px;text-align:center">${scoreBar(opponentRoundsWon, roundsToWin)}</p>
              </div>
            </div>

            ${greetingHTML}

            ${historyHTML
              ? `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">${historyHTML}</div>`
              : ''}
          </div>

          <!-- Right panel: action area -->
          <div class="match-panel">
            ${bodyHTML}
          </div>

        </div>
      </div>
    `;

    attachListeners();
  }

  // ── Listeners ───────────────────────────────────────────────────────────────

  function attachListeners() {
    if (screenState === 'powerup_stub') {
      document.getElementById('btn-powerup-done')?.addEventListener('click', () => {
        screenState = 'skill_stub';
        render();
      });
    } else if (screenState === 'skill_stub') {
      document.getElementById('btn-skill-done')?.addEventListener('click', () => {
        screenState = 'picking';
        render();
      });
    } else if (screenState === 'picking') {
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
    const opponentThrow = getNpcThrow(npcMatchState, lastRoundResult);
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

    // Record player throw for history-reading strategies (streaker, mimic, historian)
    recordPlayerThrow(npcMatchState, playerThrow);

    screenState = 'revealing';
    render();
  }

  function advanceRound() {
    if (playerRoundsWon >= roundsToWin || opponentRoundsWon >= roundsToWin) {
      screenState = 'match_over';
    } else {
      roundNumber++;
      screenState = 'powerup_stub';
    }
    render();
  }

  // ── Match completion ─────────────────────────────────────────────────────────

  function finishMatch() {
    const playerWon = playerRoundsWon >= roundsToWin;
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
