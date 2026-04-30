import { navigate }                          from '../main.js';
import { getNpcById, getAllNpcs }              from '../main.js';
import { roll }                               from '../utils/rng.js';
import { winProbability }                     from '../systems/elo.js';
import { TOURNAMENT_CONFIG }                  from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress,
  loadTournament, saveTournament, loadWorld,
} from '../storage.js';

// ── NPC helpers ───────────────────────────────────────────────────────────────

function getNpcElo(npc, worldData) {
  return worldData?.npcs?.[npc.id]?.currentElo ?? npc.startingElo;
}

// ── Bracket seeding ───────────────────────────────────────────────────────────

// Returns an array of seed indices (0-based) in bracket slot order.
// Consecutive pairs of slots are first-round matchups.
// Guarantees seeds 0 and 1 can only meet in the final.
function getBracketSlots(n) {
  if (n === 2) return [0, 1];
  const prev = getBracketSlots(n / 2);
  const result = [];
  for (const seed of prev) {
    result.push(seed);
    result.push(n - 1 - seed);
  }
  return result;
}

// ── Participant selection ─────────────────────────────────────────────────────

function selectParticipants(tier, playerElo, worldData, roster, prevFinalists) {
  const config    = TOURNAMENT_CONFIG[tier - 1];
  const total     = config.players;
  const eligible  = roster.filter(n => n.tournamentLevel <= tier);

  if (tier === 1) {
    // T1: player + 3 random T1 NPCs
    const pool     = roster.filter(n => n.tournamentLevel === 1);
    const shuffled = [...pool].sort(() => roll() - 0.5);
    const picked   = shuffled.slice(0, total - 1);
    return [
      { id: 'player', elo: playerElo },
      ...picked.map(n => ({ id: n.id, elo: getNpcElo(n, worldData) })),
    ].sort((a, b) => b.elo - a.elo);
  }

  // T2–T5: guaranteed entrants + random fill
  const guaranteed = new Set();

  // Previous finalist NPC
  if (prevFinalists) {
    const prevNpc = prevFinalists.find(id => id !== 'player');
    if (prevNpc) guaranteed.add(prevNpc);
  }

  // Top 5 ELO from eligible pool (excluding already guaranteed)
  [...eligible]
    .filter(n => !guaranteed.has(n.id))
    .sort((a, b) => getNpcElo(b, worldData) - getNpcElo(a, worldData))
    .slice(0, 5)
    .forEach(n => guaranteed.add(n.id));

  // Random fill for remaining slots
  const remaining    = eligible.filter(n => !guaranteed.has(n.id));
  const slotsNeeded  = total - 1 - guaranteed.size;
  const randomFill   = [...remaining].sort(() => roll() - 0.5).slice(0, slotsNeeded);

  const allNpcIds = [...guaranteed, ...randomFill.map(n => n.id)];
  const allNpcs   = allNpcIds.map(id => {
    const npc = roster.find(n => n.id === id);
    return { id, elo: getNpcElo(npc, worldData) };
  });

  return [
    { id: 'player', elo: playerElo },
    ...allNpcs,
  ].sort((a, b) => b.elo - a.elo); // seed 0 = highest ELO
}

// ── Bracket generation ────────────────────────────────────────────────────────

function generateTournamentData(tier, participants) {
  const config = TOURNAMENT_CONFIG[tier - 1];
  const n      = participants.length;
  const slots  = getBracketSlots(n);

  // Round 1: pair up participants by seeding
  const round1Matches = [];
  for (let i = 0; i < n; i += 2) {
    round1Matches.push({
      p1: participants[slots[i]].id,
      p2: participants[slots[i + 1]].id,
      result: null,
      score:  null,
    });
  }

  // Build rounds array; rounds after round 1 start empty
  const rounds = config.roundNames.map((roundName, ri) => ({
    roundIndex: ri,
    roundName,
    matches: ri === 0 ? round1Matches : [],
  }));

  return {
    currentTournamentLevel: tier,
    tournamentStatus:       'in_progress',
    currentRoundIndex:      0,
    bracket:                { participants, rounds },
    currentMatch:           null,
  };
}

// ── Match simulation (NPC vs NPC) ─────────────────────────────────────────────

function simulateNvN(p1Id, p2Id, worldData, roster) {
  const p1 = roster.find(n => n.id === p1Id);
  const p2 = roster.find(n => n.id === p2Id);
  const prob = winProbability(getNpcElo(p1, worldData), getNpcElo(p2, worldData));
  return roll() < prob ? 'p1_won' : 'p2_won';
}

function resolveNvNMatches(rounds, roundIndex, worldData, roster) {
  for (const match of rounds[roundIndex].matches) {
    if (!match.result && match.p1 !== 'player' && match.p2 !== 'player') {
      match.result = simulateNvN(match.p1, match.p2, worldData, roster);
    }
  }
}

function advanceWinners(rounds, roundIndex) {
  const currentRound = rounds[roundIndex];
  const nextRound    = rounds[roundIndex + 1];
  if (!nextRound) return;

  const winners = currentRound.matches.map(m =>
    m.result === 'p1_won' ? m.p1 : m.p2
  );

  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({ p1: winners[i], p2: winners[i + 1], result: null, score: null });
  }
  nextRound.matches = nextMatches;
}

// ── State detection ───────────────────────────────────────────────────────────

function detectState(data) {
  const { currentRoundIndex, bracket } = data;
  const rounds      = bracket.rounds;
  const isLastRound = currentRoundIndex === rounds.length - 1;
  const round       = rounds[currentRoundIndex];
  const playerMatch = round.matches.find(m => m.p1 === 'player' || m.p2 === 'player');

  if (!playerMatch?.result) return { state: 'fight', playerMatch, isLastRound };

  const playerWon = (playerMatch.p1 === 'player' && playerMatch.result === 'p1_won') ||
                    (playerMatch.p2 === 'player' && playerMatch.result === 'p2_won');

  if (!playerWon) return { state: isLastRound ? 'runner_up' : 'eliminated' };
  if (isLastRound) return { state: 'champion' };

  // Player won a non-final round — check if NPC matches are all resolved
  const allResolved = round.matches.every(m => m.result !== null);
  if (!allResolved) return { state: 'simulate_concurrent' };

  return { state: 'show_concurrent', roundIndex: currentRoundIndex };
}

// ── Display helpers ───────────────────────────────────────────────────────────

function pName(id, playerName) {
  if (id === 'player') return playerName.toUpperCase();
  if (!id) return '???';
  return getNpcById(id)?.name?.toUpperCase() ?? id.toUpperCase();
}

function pPortrait(id, playerPortraitId) {
  if (id === 'player') return playerPortraitId;
  if (!id) return null;
  return getNpcById(id)?.portraitId ?? null;
}

function renderSlot(id, slotKey, match, playerName, playerPortraitId) {
  const portrait   = pPortrait(id, playerPortraitId);
  const name       = pName(id, playerName);
  const isPending  = !id;
  const isPlayer   = id === 'player';

  let slotClass = '', scoreHTML = '';
  if (match.result) {
    const won = (slotKey === 'p1' && match.result === 'p1_won') ||
                (slotKey === 'p2' && match.result === 'p2_won');
    slotClass = won ? 'bracket-slot--winner' : 'bracket-slot--loser';
    if (match.score) {
      const val = slotKey === 'p1' ? match.score[0] : match.score[1];
      scoreHTML = `<span class="bracket-score ${won ? 'bracket-score--win' : 'bracket-score--loss'}">${val}</span>`;
    } else {
      scoreHTML = won ? `<span class="bracket-score bracket-score--win">✓</span>` : '';
    }
  }

  const portraitHTML = isPending
    ? `<div class="bracket-portrait"><span style="font-size:10px;color:var(--snes-border)">?</span></div>`
    : `<div class="bracket-portrait"><img src="assets/portraits/${portrait}.png" alt=""></div>`;

  return `
    <div class="bracket-slot ${slotClass}">
      ${portraitHTML}
      <span class="bracket-name ${isPlayer ? 'bracket-name--player' : ''}">${name}</span>
      ${scoreHTML}
    </div>`;
}

// ── Bracket path renderer ─────────────────────────────────────────────────────
// Shows the player's path through all rounds as a horizontal sequence of columns.

function renderBracketPath(data, playerName, playerPortraitId, currentStateInfo) {
  const { currentRoundIndex, bracket } = data;
  const rounds  = bracket.rounds;
  const columns = [];

  for (let ri = 0; ri < rounds.length; ri++) {
    const round       = rounds[ri];
    const playerMatch = round.matches.find(m => m.p1 === 'player' || m.p2 === 'player');

    // For rounds not yet reached, show a pending match card
    const match = playerMatch ?? { p1: 'player', p2: null, result: null, score: null };

    const isActive   = ri === currentRoundIndex && currentStateInfo.state === 'fight';
    const isComplete = !!playerMatch?.result;

    columns.push(`
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0">
        <p class="snes-small" style="color:var(--snes-yellow);white-space:nowrap;font-size:8px">
          ${round.roundName.toUpperCase()}
        </p>
        <div class="bracket-match ${isActive ? 'bracket-match--active' : ''} ${isComplete ? 'bracket-match--complete' : ''}">
          ${renderSlot(match.p1, 'p1', match, playerName, playerPortraitId)}
          ${renderSlot(match.p2, 'p2', match, playerName, playerPortraitId)}
        </div>
      </div>
    `);

    // Arrow connector between columns (not after the last)
    if (ri < rounds.length - 1) {
      columns.push(`
        <div style="display:flex;align-items:center;padding:0 4px;color:var(--snes-border);font-size:16px;margin-top:20px">
          ▶
        </div>
      `);
    }
  }

  return `
    <div style="overflow-x:auto;padding-bottom:4px">
      <div style="display:flex;align-items:flex-start;gap:0;min-width:max-content;padding:4px">
        ${columns.join('')}
      </div>
    </div>
  `;
}

// ── Full bracket renderer ─────────────────────────────────────────────────────
// Compact text-only view showing every match in every round.

function renderCompactSlot(id, slotKey, match, playerName) {
  const name     = pName(id, playerName);
  const isPlayer = id === 'player';
  const isPending = !id;

  let cls = 'snes-small';
  let extraStyle = 'font-size:7px;line-height:1.6;white-space:nowrap;';

  if (match.result) {
    const won = (slotKey === 'p1' && match.result === 'p1_won') ||
                (slotKey === 'p2' && match.result === 'p2_won');
    cls += won ? ' snes-success' : '';
    extraStyle += won ? '' : 'opacity:0.35;';
    return `<div class="${cls}" style="${extraStyle}">${won ? '▶ ' : '  '}${name}</div>`;
  }

  if (isPending) cls += ' snes-muted';
  else if (isPlayer) cls += ' snes-highlight';
  return `<div class="${cls}" style="${extraStyle}">  ${name}</div>`;
}

function renderFullBracket(data, playerName) {
  const { bracket } = data;
  const rounds           = bracket.rounds;
  const totalParticipants = bracket.participants.length;
  const columns          = [];

  for (let ri = 0; ri < rounds.length; ri++) {
    const round         = rounds[ri];
    const expectedCount = Math.max(1, totalParticipants / Math.pow(2, ri + 1));

    let matchCards;
    if (round.matches.length > 0) {
      matchCards = round.matches.map(match => `
        <div style="border:2px solid var(--snes-border);padding:3px 8px;background:var(--snes-panel-dark)">
          ${renderCompactSlot(match.p1, 'p1', match, playerName)}
          <div style="height:1px;background:var(--snes-border);margin:2px 0;opacity:0.5"></div>
          ${renderCompactSlot(match.p2, 'p2', match, playerName)}
        </div>`).join('');
    } else {
      matchCards = Array.from({ length: expectedCount }, () => `
        <div style="border:2px solid var(--snes-border);padding:3px 8px;background:var(--snes-panel-dark);opacity:0.35">
          <div class="snes-small snes-muted" style="font-size:7px;line-height:1.6">  ???</div>
          <div style="height:1px;background:var(--snes-border);margin:2px 0;opacity:0.5"></div>
          <div class="snes-small snes-muted" style="font-size:7px;line-height:1.6">  ???</div>
        </div>`).join('');
    }

    columns.push(`
      <div style="display:flex;flex-direction:column;align-items:stretch;gap:4px;flex-shrink:0">
        <p class="snes-small" style="color:var(--snes-yellow);white-space:nowrap;font-size:8px;text-align:center">
          ${round.roundName.toUpperCase()}
        </p>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${matchCards}
        </div>
      </div>`);

    if (ri < rounds.length - 1) {
      columns.push(`
        <div style="display:flex;align-items:flex-start;padding:0 4px;color:var(--snes-border);font-size:12px;padding-top:22px">▶</div>`);
    }
  }

  return `
    <div style="overflow-x:auto;padding-bottom:4px">
      <div style="display:flex;align-items:flex-start;gap:0;min-width:max-content;padding:4px">
        ${columns.join('')}
      </div>
    </div>`;
}

// ── Concurrent results renderer ───────────────────────────────────────────────

function renderConcurrentResults(rounds, roundIndex, playerName) {
  const round        = rounds[roundIndex];
  const roundName    = round.roundName.toUpperCase();
  const npcMatches   = round.matches.filter(m => m.p1 !== 'player' && m.p2 !== 'player');

  if (!npcMatches.length) return '';

  const lines = npcMatches.map(m => {
    const winner = m.result === 'p1_won' ? m.p1 : m.p2;
    const loser  = m.result === 'p1_won' ? m.p2 : m.p1;
    const wName  = pName(winner, playerName);
    const lName  = pName(loser,  playerName);
    return `<p class="snes-small" style="line-height:2">
      <span class="snes-success">■</span> ${wName}
      <span class="snes-muted"> def. </span>${lName}
    </p>`;
  }).join('');

  return `
    <div class="snes-panel" style="display:flex;flex-direction:column;gap:4px">
      <p class="snes-small snes-muted">MEANWHILE IN ${roundName}…</p>
      ${lines}
    </div>
  `;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mount(container, options = {}) {
  const session         = loadSession();
  const charId          = options.charId ?? session?.activeCharId;
  const identity        = loadIdentity(charId);
  const progress        = loadProgress(charId);
  const worldData       = loadWorld(charId);
  const roster          = getAllNpcs();
  const playerName      = identity?.name ?? 'YOU';
  const playerPortrait  = identity?.portraitId ?? 'male_1';
  const tier            = progress?.currentTournamentTier ?? 1;
  const config          = TOURNAMENT_CONFIG[tier - 1];

  // Load or generate tournament
  let data = loadTournament(charId);
  if (!data || data.tournamentStatus !== 'in_progress' || data.currentTournamentLevel !== tier) {
    const participants = selectParticipants(
      tier, progress.currentElo, worldData, roster, progress.previousFinalists
    );
    data = generateTournamentData(tier, participants);
    saveTournament(charId, data);
  }

  // Auto-handle: simulate NPC concurrent matches if player already played this round
  let stateInfo = detectState(data);
  if (stateInfo.state === 'simulate_concurrent') {
    resolveNvNMatches(data.bracket.rounds, data.currentRoundIndex, worldData, roster);
    saveTournament(charId, data);
    stateInfo = detectState(data);
  }

  // Terminal states: route to summary
  if (stateInfo.state === 'champion' || stateInfo.state === 'runner_up' || stateInfo.state === 'eliminated') {
    data.tournamentStatus = 'complete';
    saveTournament(charId, data);
    navigate('summary', { charId });
    return;
  }

  let showFullBracket = false;

  renderScreen(stateInfo);

  // ── Screen rendering ───────────────────────────────────────────────────────

  function renderScreen(info) {
    let statusHTML = '';
    let actionHTML = '';

    if (info.state === 'fight') {
      const label = info.isLastRound ? 'ENTER THE FINAL' : 'ENTER ARENA';
      statusHTML  = `<p class="snes-label" style="text-align:center">
        ${info.isLastRound ? 'YOU ARE IN THE FINAL!' : 'YOUR NEXT MATCH AWAITS.'}
      </p>`;
      actionHTML = `<button class="snes-btn snes-btn-yellow" id="btn-fight" style="width:100%">▶ ${label}</button>`;
    } else if (info.state === 'show_concurrent') {
      const nextRoundName = data.bracket.rounds[info.roundIndex + 1]?.roundName ?? '';
      statusHTML = renderConcurrentResults(data.bracket.rounds, info.roundIndex, playerName);
      actionHTML = `<button class="snes-btn snes-btn-yellow" id="btn-advance" style="width:100%">▶ CONTINUE TO ${nextRoundName.toUpperCase()}</button>`;
    }

    const bracketHTML = showFullBracket
      ? renderFullBracket(data, playerName)
      : renderBracketPath(data, playerName, playerPortrait, info);

    container.innerHTML = `
      <div class="screen fade-in" style="gap:16px">
        <p class="snes-title" style="text-align:center;font-size:10px">
          ${config.name.toUpperCase()}
        </p>
        <p class="snes-small snes-muted" style="text-align:center">
          TOURNAMENT ${tier}
        </p>

        <hr class="snes-divider">

        <div style="display:flex;gap:8px;justify-content:center">
          <button class="snes-btn${!showFullBracket ? ' snes-btn-yellow' : ''}" id="btn-view-path"
            style="font-size:8px;padding:6px 12px">MY PATH</button>
          <button class="snes-btn${showFullBracket ? ' snes-btn-yellow' : ''}" id="btn-view-full"
            style="font-size:8px;padding:6px 12px">FULL BRACKET</button>
        </div>

        ${bracketHTML}

        <hr class="snes-divider">

        ${statusHTML}
        ${actionHTML}
      </div>
    `;

    document.getElementById('btn-view-path')?.addEventListener('click', () => { showFullBracket = false; renderScreen(info); });
    document.getElementById('btn-view-full')?.addEventListener('click', () => { showFullBracket = true;  renderScreen(info); });
    document.getElementById('btn-fight')?.addEventListener('click', () => startMatch(info));
    document.getElementById('btn-advance')?.addEventListener('click', handleAdvanceBracket);
  }

  // ── Advance bracket after concurrent results ───────────────────────────────

  function handleAdvanceBracket() {
    advanceWinners(data.bracket.rounds, data.currentRoundIndex);
    data.currentRoundIndex++;
    saveTournament(charId, data);
    const info = detectState(data);
    renderScreen(info);
  }

  // ── Start a match ──────────────────────────────────────────────────────────

  function startMatch(info) {
    const match      = info.playerMatch;
    const opponentId = match.p1 === 'player' ? match.p2 : match.p1;

    data.currentMatch = {
      opponentId,
      matchType:         info.isLastRound ? 'finals' : 'regular',
      roundName:         data.bracket.rounds[data.currentRoundIndex].roundName,
      playerRoundsWon:   0,
      opponentRoundsWon: 0,
      roundHistory:      [],
    };
    saveTournament(charId, data);
    navigate('match', { charId });
  }
}
