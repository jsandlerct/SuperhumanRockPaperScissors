import { navigate } from '../main.js';
import {
  loadSession, loadIdentity, loadProgress,
  loadTournament, saveTournament,
} from '../storage.js';

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const identity = loadIdentity(charId);
  const progress = loadProgress(charId);
  const data     = loadTournament(charId);

  const playerName    = identity?.name?.toUpperCase() ?? 'YOU';
  const playerPortrait = identity?.portraitId ?? 'male_1';

  // Determine tournament outcome from bracket
  let outcome    = 'unknown';
  let eloDisplay = '';

  if (data?.bracket) {
    const r1 = data.bracket.rounds[0].matches;
    const r2 = data.bracket.rounds[1].matches[0];
    const playerR1 = r1.find(m => m.p1 === 'player' || m.p2 === 'player');
    const playerWonR1 = playerR1?.result &&
      ((playerR1.p1 === 'player' && playerR1.result === 'p1_won') ||
       (playerR1.p2 === 'player' && playerR1.result === 'p2_won'));

    if (!playerWonR1) {
      outcome = 'eliminated_r1';
    } else {
      const playerWonFinal = r2?.result &&
        ((r2.p1 === 'player' && r2.result === 'p1_won') ||
         (r2.p2 === 'player' && r2.result === 'p2_won'));
      outcome = playerWonFinal ? 'champion' : 'runner_up';
    }
  }

  // ELO change display — compare to baseline since we write new ELO before navigating here
  // progress.currentElo is already updated; we show it with a visual indicator
  const currentElo = progress?.currentElo ?? 1000;

  const outcomeConfig = {
    champion:      { title: 'LOCAL CHAMPION!',    color: 'snes-success', emoji: '★' },
    runner_up:     { title: 'RUNNER-UP',           color: 'snes-highlight', emoji: '▲' },
    eliminated_r1: { title: 'ELIMINATED',          color: 'snes-error', emoji: '✗' },
    unknown:       { title: 'TOURNAMENT COMPLETE', color: 'snes-label', emoji: '─' },
  };

  const cfg = outcomeConfig[outcome];

  container.innerHTML = `
    <div class="screen fade-in" style="justify-content:center">
      <div class="content-card" style="gap:20px">

        <p class="snes-title" style="text-align:center">RESULTS</p>

        <!-- Player card -->
        <div class="snes-panel" style="display:flex;align-items:center;gap:16px">
          <div class="portrait-frame portrait-frame--lg">
            <img src="assets/portraits/${playerPortrait}.png" alt="">
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <p class="snes-label snes-highlight">${playerName}</p>
            <p class="snes-label ${cfg.color}" style="font-size:10px">${cfg.emoji} ${cfg.title}</p>
          </div>
        </div>

        <!-- ELO display -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
          <p class="snes-small snes-muted">RATING</p>
          <p class="snes-label" style="font-size:14px">
            <span class="snes-highlight">${currentElo}</span>
            <span class="snes-small snes-muted"> ELO</span>
          </p>
        </div>

        <button class="snes-btn snes-btn-yellow" id="btn-play-again" style="width:100%">
          ▶ PLAY AGAIN
        </button>

      </div>
    </div>
  `;

  document.getElementById('btn-play-again').addEventListener('click', () => {
    // Reset tournament so a fresh bracket is generated on next mount
    saveTournament(charId, null);
    navigate('tournament', { charId });
  });
}
