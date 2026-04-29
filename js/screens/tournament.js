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

function renderSlot(id, slotKey, match, playerName, playerPortraitId) {
  const isPlayer = id === 'player';
  const isPending = id === null;
  const portrait = participantPortrait(id, playerPortraitId);
  const name = participantName(id, playerName);

  let slotClass = '';
  let scoreVal = '';
  let scoreClass = '';

  if (match.result) {
    const won = (slotKey === 'p1' && match.result === 'p1_won') ||
                (slotKey === 'p2' && match.result === 'p2_won');
    slotClass = won ? 'bracket-slot--winner' : 'bracket-slot--loser';
    if (match.score) {
      scoreVal = String(slotKey === 'p1' ? match.score[0] : match.score[1]);
      scoreClass = won ? 'bracket-score--win' : 'bracket-score--loss';
    } else {
      scoreVal = won ? '✓' : '';
    }
  }

  const portraitHTML = isPending
    ? `<div class="bracket-portrait"><span style="font-size:10px;color:var(--snes-border)">?</span></div>`
    : `<div class="bracket-portrait"><img src="assets/portraits/${portrait}.png" alt=""></div>`;

  const scoreHTML = scoreVal !== ''
    ? `<span class="bracket-score ${scoreClass}">${scoreVal}</span>`
    : '';

  return `
    <div class="bracket-slot ${slotClass}">
      ${portraitHTML}
      <span class="bracket-name ${isPlayer ? 'bracket-name--player' : ''}">${name}</span>
      ${scoreHTML}
    </div>
  `;
}

function renderBracket(data, playerName, playerPortraitId, stateInfo) {
  const r1 = data.bracket.rounds[0].matches;
  const r2 = data.bracket.rounds[1].matches[0];
  const playerR1 = r1.find(m => m.p1 === 'player' || m.p2 === 'player');
  const npcR1    = r1.find(m => m.p1 !== 'player' && m.p2 !== 'player');

  const r1Active = stateInfo.state === 'r1_pending';
  const r2Active = stateInfo.state === 'final_pending';
  const r1Done   = !!playerR1.result;

  return `
    <div>
      <div class="bracket-round-headers">
        <div class="bracket-round-header">SEMIFINAL</div>
        <div class="bracket-conn-gap"></div>
        <div class="bracket-round-header">FINAL</div>
      </div>
      <div class="bracket-body">
        <div class="bracket-col">
          <div class="bracket-match ${r1Active ? 'bracket-match--active' : ''} ${r1Done ? 'bracket-match--complete' : ''}">
            ${renderSlot(playerR1.p1, 'p1', playerR1, playerName, playerPortraitId)}
            ${renderSlot(playerR1.p2, 'p2', playerR1, playerName, playerPortraitId)}
          </div>
          <div class="bracket-match ${npcR1.result ? 'bracket-match--complete' : ''}">
            ${renderSlot(npcR1.p1, 'p1', npcR1, playerName, playerPortraitId)}
            ${renderSlot(npcR1.p2, 'p2', npcR1, playerName, playerPortraitId)}
          </div>
        </div>
        <div class="bracket-conn">
          <div class="bracket-conn-top"></div>
          <div class="bracket-conn-bot"></div>
        </div>
        <div class="bracket-col bracket-col--final">
          <div class="bracket-match ${r2Active ? 'bracket-match--active' : ''} ${r2.result ? 'bracket-match--complete' : ''}">
            ${renderSlot(r2.p1, 'p1', r2, playerName, playerPortraitId)}
            ${renderSlot(r2.p2, 'p2', r2, playerName, playerPortraitId)}
          </div>
        </div>
      </div>
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

        ${renderBracket(data, playerName, playerPortraitId, stateInfo)}

        <hr class="snes-divider">

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
