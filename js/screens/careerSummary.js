import { navigate }          from '../main.js';
import { TOURNAMENT_CONFIG, TOTAL_PLAYERS, TROPHY_CONFIG } from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress,
  loadStats, loadTrophies, loadAccountSettings, saveAccountSettings,
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

  const career            = stats?.career ?? {};
  const eloHistory        = trophies?.seasonEloHistory ?? [];
  const seasonsCompleted  = eloHistory.length;
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

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="snes-btn" id="btn-back" style="font-size:7px;padding:8px 10px">← BACK</button>
          <p class="snes-title" style="flex:1">CAREER</p>
          <button class="snes-btn" id="btn-how-to-play" style="font-size:7px;padding:8px 10px">? HOW TO PLAY</button>
          <button class="snes-btn" id="btn-settings" style="font-size:7px;padding:8px 10px">⚙ SETTINGS</button>
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

        <!-- ELO history sparkline -->
        ${eloHistory.length >= 2 ? `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
          <p class="snes-small snes-muted">ELO HISTORY</p>
          <canvas id="elo-sparkline" height="48" style="width:100%;image-rendering:pixelated;display:block"></canvas>
          <div style="display:flex;justify-content:space-between">
            <p class="snes-small snes-muted" style="font-size:5px">S1</p>
            <p class="snes-small snes-muted" style="font-size:5px">S${eloHistory[eloHistory.length - 1].season}</p>
          </div>
        </div>
        ` : ''}

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
                <td class="snes-small snes-muted" style="padding:6px 0 2px">PLAY%</td>
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

  // Draw ELO sparkline if we have history
  if (eloHistory.length >= 2) {
    const canvas = document.getElementById('elo-sparkline');
    if (canvas) {
      canvas.width = canvas.offsetWidth || 280;
      const ctx    = canvas.getContext('2d');
      const W      = canvas.width;
      const H      = canvas.height;
      const elos   = eloHistory.map(e => e.endElo);
      const minElo = Math.min(...elos);
      const maxElo = Math.max(...elos);
      const range  = maxElo - minElo || 1;
      const padX   = 4;
      const padY   = 6;

      ctx.clearRect(0, 0, W, H);

      // Baseline reference line at 1000 ELO
      const baselineY = H - padY - ((1000 - minElo) / range) * (H - padY * 2);
      if (minElo <= 1000 && maxElo >= 1000) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(padX, baselineY);
        ctx.lineTo(W - padX, baselineY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Gradient fill under line
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(80,80,184,0.5)');
      grad.addColorStop(1, 'rgba(80,80,184,0)');

      const xStep = (W - padX * 2) / (elos.length - 1);
      const toX   = i => padX + i * xStep;
      const toY   = v => H - padY - ((v - minElo) / range) * (H - padY * 2);

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(elos[0]));
      for (let i = 1; i < elos.length; i++) ctx.lineTo(toX(i), toY(elos[i]));
      ctx.lineTo(toX(elos.length - 1), H);
      ctx.lineTo(toX(0), H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(elos[0]));
      for (let i = 1; i < elos.length; i++) ctx.lineTo(toX(i), toY(elos[i]));
      ctx.strokeStyle = '#5050b8';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Dot on last point
      const lastX = toX(elos.length - 1);
      const lastY = toY(elos[elos.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f8d020';
      ctx.fill();
    }
  }

  document.getElementById('btn-back').addEventListener('click', () => {
    navigate('characterSelect', { username });
  });

  document.getElementById('btn-how-to-play').addEventListener('click', () => {
    window.open('SRPS_how_to_play_v1_0.html', '_blank');
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    openSettingsPopup(username);
  });
}

function openSettingsPopup(username) {
  const existing = document.getElementById('settings-popup-overlay');
  if (existing) return;

  const settings = loadAccountSettings(username);

  const overlay = document.createElement('div');
  overlay.id = 'settings-popup-overlay';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:rgba(0,0,0,0.75);z-index:2000;
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  overlay.innerHTML = `
    <div class="snes-panel" style="display:flex;flex-direction:column;gap:20px;max-width:320px;width:100%">
      <p class="snes-title" style="text-align:center;font-size:11px">SETTINGS</p>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <p class="snes-small">MUSIC</p>
          <button class="snes-btn snes-toggle" id="toggle-music"
                  data-on="${settings.music}"
                  style="min-width:64px;font-size:7px;padding:8px 14px;
                         background:${settings.music ? 'var(--snes-yellow)' : 'var(--snes-panel-dark)'};
                         color:${settings.music ? 'var(--snes-black)' : 'var(--snes-muted-color, #888)'}">
            ${settings.music ? 'ON' : 'OFF'}
          </button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <p class="snes-small">SOUND EFFECTS</p>
          <button class="snes-btn snes-toggle" id="toggle-sfx"
                  data-on="${settings.sfx}"
                  style="min-width:64px;font-size:7px;padding:8px 14px;
                         background:${settings.sfx ? 'var(--snes-yellow)' : 'var(--snes-panel-dark)'};
                         color:${settings.sfx ? 'var(--snes-black)' : 'var(--snes-muted-color, #888)'}">
            ${settings.sfx ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <button class="snes-btn snes-btn-yellow" id="btn-settings-close" style="width:100%">
        ✕ CLOSE
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  function updateToggle(btn, isOn) {
    btn.dataset.on = isOn;
    btn.textContent = isOn ? 'ON' : 'OFF';
    btn.style.background = isOn ? 'var(--snes-yellow)' : 'var(--snes-panel-dark)';
    btn.style.color = isOn ? 'var(--snes-black)' : '#888';
  }

  const musicBtn = document.getElementById('toggle-music');
  const sfxBtn   = document.getElementById('toggle-sfx');

  musicBtn.addEventListener('click', () => {
    settings.music = !settings.music;
    updateToggle(musicBtn, settings.music);
    saveAccountSettings(username, settings);
  });

  sfxBtn.addEventListener('click', () => {
    settings.sfx = !settings.sfx;
    updateToggle(sfxBtn, settings.sfx);
    saveAccountSettings(username, settings);
  });

  document.getElementById('btn-settings-close').addEventListener('click', () => {
    overlay.remove();
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
