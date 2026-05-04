import { navigate }          from '../main.js';
import { TOURNAMENT_CONFIG, TOTAL_PLAYERS, TROPHY_CONFIG } from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress,
  loadStats, loadTrophies,
} from '../storage.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function trophySize(tier) {
  return [40, 48, 56, 64, 80][tier - 1] ?? 48;
}

function pct(count, total) {
  if (!total) return '—';
  return (count / total * 100).toFixed(1) + '%';
}

function winRate(wins, throws) {
  if (!throws) return '—';
  return (wins / throws * 100).toFixed(1) + '%';
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const username = options.username ?? session?.loggedInUsername;

  const identity = loadIdentity(charId);
  const progress = loadProgress(charId);
  const stats    = loadStats(charId);
  const trophies = loadTrophies(charId);

  const name       = identity?.name?.toUpperCase() ?? '???';
  const portraitId = identity?.portraitId ?? 'male_1';
  const elo        = progress?.currentElo ?? 0;
  const worldRank  = progress?.worldRank ?? null;
  const peakElo    = progress?.peakElo ?? elo;
  const peakRank   = progress?.peakWorldRank ?? worldRank;

  // Group trophies by season. Entries may be {id,season} objects or legacy strings.
  const trophyEntries = (trophies?.trophies ?? []).map(e =>
    typeof e === 'string' ? { id: e, season: 1 } : e
  );
  const trophySeasons = [...new Set(trophyEntries.map(e => e.season))].sort((a, b) => a - b);
  const trophyBySeason = {};
  for (const e of trophyEntries) {
    (trophyBySeason[e.season] ??= []).push(TROPHY_CONFIG.find(t => t.id === e.id));
  }

  const career  = stats?.career ?? {};
  const seasonsCompleted  = trophies?.seasonEloHistory?.length ?? 0;
  const tournamentsEntered = career.tournamentsEntered ?? 0;
  const tournamentsWon     = career.tournamentsWon ?? 0;
  const runnerUpFinishes   = career.runnerUpFinishes ?? 0;
  const deepestTier        = career.deepestTournamentReached ?? 0;
  const deepestName        = deepestTier > 0
    ? TOURNAMENT_CONFIG[deepestTier - 1].name
    : '—';

  // Throw distribution
  const rock     = career.rock     ?? 0;
  const paper    = career.paper    ?? 0;
  const scissors = career.scissors ?? 0;
  const total    = rock + paper + scissors;

  const rockWins     = career.rockWins     ?? 0;
  const paperWins    = career.paperWins    ?? 0;
  const scissorsWins = career.scissorsWins ?? 0;

  container.innerHTML = `
    <div class="screen fade-in" style="justify-content:center">
      <div class="content-card" style="gap:20px">

        <div style="display:flex;align-items:center;gap:12px">
          <button class="snes-btn" id="btn-back" style="font-size:7px;padding:8px 10px">← BACK</button>
          <p class="snes-title">CAREER</p>
        </div>

        <!-- Identity -->
        <div class="snes-panel" style="display:flex;align-items:center;gap:16px">
          <div class="portrait-frame portrait-frame--lg">
            <img src="assets/portraits/${portraitId}.png" alt="">
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            <p class="snes-label snes-highlight">${name}</p>
            <p class="snes-small">
              ELO <span class="snes-highlight">${elo}</span>
            </p>
            <p class="snes-small">
              RANK
              ${worldRank !== null
                ? `<span class="snes-highlight">#${worldRank}</span>
                   <span class="snes-muted"> of ${TOTAL_PLAYERS}</span>`
                : `<span class="snes-muted">UNRANKED</span>`}
            </p>
          </div>
        </div>

        <!-- Career record -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
          <p class="snes-small snes-muted">CAREER RECORD</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px">
            ${statRow('SEASONS',       seasonsCompleted || '—')}
            ${statRow('TOURNAMENTS',   tournamentsEntered || '—')}
            ${statRow('WINS',          tournamentsWon)}
            ${statRow('RUNNER-UP',     runnerUpFinishes)}
            ${statRow('BEST FINISH',   deepestName)}
            ${statRow('BEST RANK',     peakRank !== null ? `#${peakRank}` : '—')}
            ${statRow('PEAK ELO',      peakElo)}
          </div>
        </div>

        <!-- Throw distribution -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
          <p class="snes-small snes-muted">THROW DISTRIBUTION</p>
          ${total === 0
            ? `<p class="snes-small snes-muted" style="text-align:center">NO DATA YET</p>`
            : `
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left" class="snes-small snes-muted"></th>
                <th style="text-align:center" class="snes-small snes-muted">✊ ROCK</th>
                <th style="text-align:center" class="snes-small snes-muted">✋ PAPER</th>
                <th style="text-align:center" class="snes-small snes-muted">✌ SCISSORS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="snes-small snes-muted" style="padding:6px 0 2px">PLAYS</td>
                <td class="snes-small snes-highlight" style="text-align:center;padding:6px 0 2px">${pct(rock, total)}</td>
                <td class="snes-small snes-highlight" style="text-align:center;padding:6px 0 2px">${pct(paper, total)}</td>
                <td class="snes-small snes-highlight" style="text-align:center;padding:6px 0 2px">${pct(scissors, total)}</td>
              </tr>
              <tr>
                <td class="snes-small snes-muted" style="padding:2px 0 6px">WIN %</td>
                <td class="snes-small snes-success" style="text-align:center;padding:2px 0 6px">${winRate(rockWins, rock)}</td>
                <td class="snes-small snes-success" style="text-align:center;padding:2px 0 6px">${winRate(paperWins, paper)}</td>
                <td class="snes-small snes-success" style="text-align:center;padding:2px 0 6px">${winRate(scissorsWins, scissors)}</td>
              </tr>
              <tr>
                <td class="snes-small snes-muted" style="padding:2px 0">COUNT</td>
                <td class="snes-small snes-muted" style="text-align:center;padding:2px 0">${rock}</td>
                <td class="snes-small snes-muted" style="text-align:center;padding:2px 0">${paper}</td>
                <td class="snes-small snes-muted" style="text-align:center;padding:2px 0">${scissors}</td>
              </tr>
            </tbody>
          </table>`}
        </div>

        <!-- Trophy case -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:16px">
          <p class="snes-small snes-muted">TROPHY CASE</p>
          ${trophySeasons.length === 0
            ? `<p class="snes-small snes-muted" style="text-align:center">NO TROPHIES YET</p>`
            : trophySeasons.map(season => `
              <div style="display:flex;flex-direction:column;gap:8px">
                <p class="snes-small snes-muted" style="font-size:6px;border-bottom:1px solid var(--snes-border);padding-bottom:4px">SEASON ${season}</p>
                <div style="display:flex;flex-wrap:wrap;gap:12px">
                  ${trophyBySeason[season].filter(Boolean).map(t => `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:${trophySize(t.tier)}px">
                      <img src="${t.asset}" alt="${t.label}"
                        style="width:${trophySize(t.tier)}px;height:${trophySize(t.tier)}px;image-rendering:pixelated;object-fit:contain">
                      <p class="snes-small snes-highlight" style="text-align:center;font-size:5px;line-height:1.4">${t.label}</p>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', () => {
    navigate('characterSelect', { username });
  });
}

function statRow(label, value) {
  return `
    <div>
      <p class="snes-small snes-muted">${label}</p>
    </div>
    <div>
      <p class="snes-small snes-highlight">${value}</p>
    </div>
  `;
}
