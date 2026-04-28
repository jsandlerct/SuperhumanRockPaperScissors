import { navigate } from '../main.js';
import { getNpcById, getNpcsByTier } from '../main.js';
import { roll } from '../utils/rng.js';
import { winProbability } from '../systems/elo.js';
import {
  loadSession, loadIdentity, loadProgress,
  loadTournament, saveTournament,
} from '../storage.js';

// ── Bracket helpers ───────────────────────────────────────────────────────────

function playerWon(match) {
  return (match.p1 === 'player' && match.result === 'p1_won') ||
         (match.p2 === 'player' && match.result === 'p2_won');
}

function npcMatchResult(npc1, npc2) {
  const p = winProbability(npc1.startingElo, npc2.startingElo);
  return roll() < p ? 'p1_won' : 'p2_won';
}

function generateBracket() {
  const tier1 = getNpcsByTier(1);
  // Shuffle tier 1 pool and pick 3
  const shuffled = [...tier1].sort(() => roll() - 0.5);
  const [oppA, oppB, oppC] = shuffled;

  const nvcResult = npcMatchResult(oppB, oppC);
  const nvcWinner = nvcResult === 'p1_won' ? oppB.id : oppC.id;

  return {
    currentTournamentLevel: 1,
    tournamentStatus: 'in_progress',
    bracket: {
      rounds: [
        {
          round: 1,
          matches: [
            { p1: 'player', p2: oppA.id,  result: null,      score: null },
            { p1: oppB.id,  p2: oppC.id,  result: nvcResult, score: null },
          ],
        },
        {
          round: 2,
          matches: [
            // p1 filled when player wins R1; p2 is the NPC bracket winner
            { p1: null, p2: nvcWinner, result: null, score: null },
          ],
        },
      ],
    },
    currentMatch: null,
  };
}

function getTournamentState(data) {
  const r1 = data.bracket.rounds[0].matches;
  const r2 = data.bracket.rounds[1].matches[0];

  const playerR1 = r1.find(m => m.p1 === 'player' || m.p2 === 'player');

  if (!playerR1.result) return { state: 'r1_pending', match: playerR1, round: 1 };

  if (!playerWon(playerR1)) return { state: 'eliminated' };

  // Advance bracket if not yet done
  if (r2.p1 === null) {
    r2.p1 = 'player';
    return { state: 'advance_needed' };
  }

  if (!r2.result) return { state: 'final_pending', match: r2, round: 2 };

  return { state: playerWon(r2) ? 'champion' : 'runner_up' };
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

function participantName(id, playerName) {
  if (id === 'player') return playerName.toUpperCase();
  if (id === null) return '???';
  return getNpcById(id)?.name?.toUpperCase() ?? id.toUpperCase();
}

function participantPortrait(id, playerPortraitId) {
  if (id === 'player') return playerPortraitId;
  if (id === null) return null;
  return getNpcById(id)?.portraitId ?? null;
}

function portraitImg(portraitId, size = 'sm') {
  if (!portraitId) {
    return `<div class="portrait-frame portrait-frame--${size}" style="background:var(--snes-panel)">
      <span class="snes-label" style="font-size:16px;text-align:center">?</span>
    </div>`;
  }
  return `<div class="portrait-frame portrait-frame--${size}">
    <img src="assets/portraits/${portraitId}.png" alt="">
  </div>`;
}

function matchResultLabel(match, playerName) {
  if (!match.result) return `<span class="snes-small snes-muted">PENDING</span>`;
  const winnerName = participantName(
    match.result === 'p1_won' ? match.p1 : match.p2,
    playerName
  );
  const isPlayer = (match.result === 'p1_won' && match.p1 === 'player') ||
                   (match.result === 'p2_won' && match.p2 === 'player');
  return `<span class="snes-small ${isPlayer ? 'snes-success' : 'snes-error'}">${winnerName} WINS</span>`;
}

function renderMatchCard(match, playerName, playerPortraitId, label, highlight) {
  const p1Name    = participantName(match.p1, playerName);
  const p2Name    = participantName(match.p2, playerName);
  const p1Portait = participantPortrait(match.p1, playerPortraitId);
  const p2Portait = participantPortrait(match.p2, playerPortraitId);
  const p1IsPlayer = match.p1 === 'player';
  const p2IsPlayer = match.p2 === 'player';
  const borderStyle = highlight ? 'border-color:var(--snes-yellow)' : '';

  return `
    <div class="snes-panel" style="${borderStyle}">
      <p class="snes-small snes-highlight" style="margin-bottom:10px">${label}</p>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
          ${portraitImg(p1Portait, 'sm')}
          <p class="snes-small ${p1IsPlayer ? 'snes-highlight' : ''}" style="text-align:center;word-break:break-all">${p1Name}</p>
        </div>
        <p class="snes-label" style="flex-shrink:0">VS</p>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
          ${portraitImg(p2Portait, 'sm')}
          <p class="snes-small ${p2IsPlayer ? 'snes-highlight' : ''}" style="text-align:center;word-break:break-all">${p2Name}</p>
        </div>
      </div>
      <div style="margin-top:8px;text-align:center">${matchResultLabel(match, playerName)}</div>
    </div>
  `;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mount(container, options = {}) {
  const session    = loadSession();
  const charId     = options.charId ?? session?.activeCharId;
  const identity   = loadIdentity(charId);
  const playerName = identity?.name ?? 'YOU';
  const playerPortraitId = identity?.portraitId ?? 'male_1';

  // Load or generate tournament
  let data = loadTournament(charId);
  if (!data || data.tournamentStatus !== 'in_progress') {
    data = generateBracket();
    saveTournament(charId, data);
  }

  // Advance bracket if needed (player just won R1)
  const stateInfo = getTournamentState(data);
  if (stateInfo.state === 'advance_needed') {
    saveTournament(charId, data);
    // Re-evaluate after saving
    const updated = getTournamentState(data);
    renderScreen(updated);
  } else if (stateInfo.state === 'champion' || stateInfo.state === 'runner_up') {
    data.tournamentStatus = 'complete';
    saveTournament(charId, data);
    navigate('summary', { charId });
    return;
  } else {
    renderScreen(stateInfo);
  }

  function renderScreen(stateInfo) {
    const r1 = data.bracket.rounds[0].matches;
    const r2 = data.bracket.rounds[1].matches[0];
    const playerR1Match = r1.find(m => m.p1 === 'player' || m.p2 === 'player');
    const npcR1Match    = r1.find(m => m.p1 !== 'player' && m.p2 !== 'player');

    let statusHTML = '';
    let actionHTML = '';

    switch (stateInfo.state) {
      case 'r1_pending':
        statusHTML = `<p class="snes-label" style="text-align:center">YOUR FIRST MATCH AWAITS.</p>`;
        actionHTML = `<button class="snes-btn snes-btn-yellow" id="btn-fight" style="width:100%">▶ ENTER ARENA</button>`;
        break;
      case 'eliminated':
        statusHTML = `<p class="snes-label snes-error" style="text-align:center">YOU HAVE BEEN ELIMINATED.</p>`;
        actionHTML = `<button class="snes-btn" id="btn-continue" style="width:100%">▶ SEE RESULTS</button>`;
        break;
      case 'final_pending':
        statusHTML = `<p class="snes-label snes-success" style="text-align:center">YOU ARE IN THE FINAL!</p>`;
        actionHTML = `<button class="snes-btn snes-btn-yellow" id="btn-fight" style="width:100%">▶ ENTER FINAL</button>`;
        break;
    }

    container.innerHTML = `
      <div class="screen fade-in" style="gap:16px">
        <p class="snes-title" style="text-align:center;font-size:10px">LOCAL CHAMPIONSHIP</p>
        <p class="snes-small snes-muted" style="text-align:center">TOURNAMENT 1</p>

        <hr class="snes-divider">

        <p class="snes-small snes-highlight">SEMIFINAL</p>
        ${renderMatchCard(playerR1Match, playerName, playerPortraitId, 'MATCH 1', stateInfo.state === 'r1_pending')}
        ${renderMatchCard(npcR1Match,    playerName, playerPortraitId, 'MATCH 2', false)}

        <hr class="snes-divider">

        <p class="snes-small snes-highlight">FINAL</p>
        ${renderMatchCard(r2, playerName, playerPortraitId, 'CHAMPIONSHIP', stateInfo.state === 'final_pending')}

        ${statusHTML}
        ${actionHTML}
      </div>
    `;

    document.getElementById('btn-fight')?.addEventListener('click', () => startMatch(stateInfo));
    document.getElementById('btn-continue')?.addEventListener('click', () => {
      navigate('summary', { charId });
    });
  }

  function startMatch(stateInfo) {
    const matchToPlay = stateInfo.match;
    const opponentId  = matchToPlay.p1 === 'player' ? matchToPlay.p2 : matchToPlay.p1;

    data.currentMatch = {
      opponentId,
      matchType:          stateInfo.round === 2 ? 'final' : 'semifinal',
      round:              stateInfo.round,
      playerRoundsWon:    0,
      opponentRoundsWon:  0,
      roundHistory:       [],
    };
    saveTournament(charId, data);
    navigate('match', { charId });
  }
}
