import { navigate }                    from '../main.js';
import { getNpcById }                  from '../main.js';
import { TOURNAMENT_CONFIG, SKILL_POINTS_AWARD, CONSOLATION_BONUS_BY_LEVEL } from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
  loadTournament, saveTournament,
  loadStats, saveStats,
  loadTrophies, saveTrophies,
} from '../storage.js';

// ── Outcome detection ─────────────────────────────────────────────────────────

function detectOutcome(data) {
  if (!data?.bracket) return 'unknown';

  const rounds      = data.bracket.rounds;
  const finalRound  = rounds[rounds.length - 1];
  const finalMatch  = finalRound?.matches[0];

  if (!finalMatch?.result) {
    // Player didn't reach the final — find where they were eliminated
    for (const round of rounds) {
      const pm = round.matches.find(m => m.p1 === 'player' || m.p2 === 'player');
      if (pm?.result) {
        const playerWon = (pm.p1 === 'player' && pm.result === 'p1_won') ||
                          (pm.p2 === 'player' && pm.result === 'p2_won');
        if (!playerWon) return 'eliminated';
      }
    }
    return 'unknown';
  }

  const playerInFinal = finalMatch.p1 === 'player' || finalMatch.p2 === 'player';
  if (!playerInFinal) return 'eliminated';

  const playerWonFinal = (finalMatch.p1 === 'player' && finalMatch.result === 'p1_won') ||
                         (finalMatch.p2 === 'player' && finalMatch.result === 'p2_won');

  return playerWonFinal ? 'champion' : 'runner_up';
}

function getOtherFinalistId(data) {
  const rounds     = data.bracket.rounds;
  const finalMatch = rounds[rounds.length - 1]?.matches[0];
  if (!finalMatch) return null;
  if (finalMatch.p1 === 'player') return finalMatch.p2;
  if (finalMatch.p2 === 'player') return finalMatch.p1;
  return null;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mount(container, options = {}) {
  const session   = loadSession();
  const charId    = options.charId ?? session?.activeCharId;
  const identity  = loadIdentity(charId);
  const progress  = loadProgress(charId);
  const data      = loadTournament(charId);

  const playerName    = identity?.name?.toUpperCase() ?? 'YOU';
  const playerPortrait = identity?.portraitId ?? 'male_1';
  const tier          = progress?.currentTournamentTier ?? 1;
  const config        = TOURNAMENT_CONFIG[tier - 1];
  const outcome       = detectOutcome(data);
  const isT5          = tier === 5;

  // ── Determine points earned ──────────────────────────────────────────────────
  let pointsEarned = 0;
  if (outcome === 'champion')   pointsEarned = SKILL_POINTS_AWARD[tier].winner;
  if (outcome === 'runner_up')  pointsEarned = SKILL_POINTS_AWARD[tier].runnerUp;
  if (outcome === 'eliminated') pointsEarned = CONSOLATION_BONUS_BY_LEVEL[tier];

  // ── Outcome display config ───────────────────────────────────────────────────
  const outcomeConfig = {
    champion:   { title: 'CHAMPION!',  color: 'snes-success',   emoji: '★', advanceable: !isT5 },
    runner_up:  { title: 'RUNNER-UP',  color: 'snes-highlight', emoji: '▲', advanceable: !isT5 },
    eliminated: { title: 'ELIMINATED', color: 'snes-error',     emoji: '✗', advanceable: false  },
    unknown:    { title: 'COMPLETE',   color: 'snes-label',     emoji: '─', advanceable: false  },
  };
  const cfg = outcomeConfig[outcome];

  const currentElo = progress?.currentElo ?? 1000;

  // ── Advance label ────────────────────────────────────────────────────────────
  let actionLabel = '';
  if (cfg.advanceable) {
    const nextConfig = TOURNAMENT_CONFIG[tier];
    actionLabel = `▶ ADVANCE TO ${nextConfig.name.toUpperCase()}`;
  } else if (isT5 && (outcome === 'champion' || outcome === 'runner_up')) {
    actionLabel = '▶ END OF SEASON';
  } else {
    actionLabel = '▶ END OF SEASON';
  }

  container.innerHTML = `
    <div class="screen fade-in" style="justify-content:center">
      <div class="content-card" style="gap:20px">

        <p class="snes-title" style="text-align:center">RESULTS</p>
        <p class="snes-small snes-muted" style="text-align:center">
          ${config.name.toUpperCase()}
        </p>

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

        <!-- ELO -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
          <p class="snes-small snes-muted">RATING</p>
          <p class="snes-label" style="font-size:14px">
            <span class="snes-highlight">${currentElo}</span>
            <span class="snes-small snes-muted"> ELO</span>
          </p>
        </div>

        <!-- Skill points -->
        ${pointsEarned > 0 ? `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
          <p class="snes-small snes-muted">
            ${outcome === 'eliminated' ? 'CONSOLATION BONUS' : 'SKILL POINTS EARNED'}
          </p>
          <p class="snes-label snes-highlight">+${pointsEarned} PTS</p>
          <p class="snes-small snes-muted">[SKILL TREE UNLOCKS V0.3]</p>
        </div>
        ` : ''}

        <button class="snes-btn snes-btn-yellow" id="btn-continue" style="width:100%">
          ${actionLabel}
        </button>

      </div>
    </div>
  `;

  document.getElementById('btn-continue').addEventListener('click', handleContinue);

  // ── Handle continue ─────────────────────────────────────────────────────────

  function handleContinue() {
    const updatedProgress = { ...progress };

    // Award skill points
    updatedProgress.unspentSkillPoints     = (progress.unspentSkillPoints ?? 0) + pointsEarned;
    updatedProgress.totalSkillPointsEarned = (progress.totalSkillPointsEarned ?? 0) + pointsEarned;

    // Update stats
    const stats = loadStats(charId);
    if (stats) {
      if (outcome === 'champion')  { stats.career.tournamentsWon++; }
      if (outcome === 'runner_up') { stats.career.runnerUpFinishes++; }
      stats.career.tournamentsEntered = (stats.career.tournamentsEntered ?? 0) + 1;
      stats.career.deepestTournamentReached = Math.max(
        stats.career.deepestTournamentReached ?? 0, tier
      );
      saveStats(charId, stats);
    }

    if (cfg.advanceable) {
      // Player advanced — set up next tournament
      const otherFinalistId = getOtherFinalistId(data);
      updatedProgress.previousFinalists    = ['player', otherFinalistId].filter(Boolean);
      updatedProgress.currentTournamentTier = tier + 1;
      saveProgress(charId, updatedProgress);
      saveTournament(charId, null); // clear bracket so next mount generates fresh one
      navigate('tournament', { charId });
    } else {
      // Season over (eliminated, T5 complete, or unknown)
      updatedProgress.previousFinalists     = null;
      updatedProgress.currentTournamentTier = 1;
      updatedProgress.phase                 = 'off_season';
      saveProgress(charId, updatedProgress);
      saveTournament(charId, null);
      // TODO v0.2: navigate to proper off-season screen
      // For now: stub — reset to T1 and go back to tournament
      updatedProgress.phase = 'active_season';
      saveProgress(charId, updatedProgress);
      navigate('tournament', { charId });
    }
  }
}
