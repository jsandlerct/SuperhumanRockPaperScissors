import { navigate, getAllNpcs }         from '../main.js';
import { getNpcById }                  from '../main.js';
import { openRankingsOverlay }         from '../ui/rankingsOverlay.js';
import {
  TOURNAMENT_CONFIG, SKILL_POINTS_AWARD, CONSOLATION_BONUS_BY_LEVEL,
  RANKING_MILESTONES, MILESTONE_FIRST_CHAMP_MSG, MILESTONE_THREE_TIME_CHAMP_MSG,
  TOTAL_PLAYERS, JESSIE_CONSOLATION_DIALOGUE, TROPHY_CONFIG,
  JESSIE_MILESTONE_DIALOGUE, JESSIE_MILESTONE_PRIORITY,
} from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
  loadTournament, saveTournament,
  loadStats, saveStats,
  loadTrophies, saveTrophies,
  loadWorld,
} from '../storage.js';
import { runSeasonSimulation, detectRankingMilestones } from '../systems/seasonEngine.js';
import { showJessieDialogue } from '../ui/jessieDialogue.js';

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
  const session        = loadSession();
  const charId         = options.charId ?? session?.activeCharId;
  const identity       = loadIdentity(charId);
  const progress       = loadProgress(charId);
  const data           = loadTournament(charId);

  const playerName     = identity?.name?.toUpperCase() ?? 'YOU';
  const playerPortrait = identity?.portraitId ?? 'male_1';
  const tier           = progress?.currentTournamentTier ?? 1;
  const config         = TOURNAMENT_CONFIG[tier - 1];
  const outcome        = detectOutcome(data);
  const isT5           = tier === 5;

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
  const worldRank  = progress?.worldRank ?? null;

  // ── Advance label ────────────────────────────────────────────────────────────
  let actionLabel = '';
  if (cfg.advanceable) {
    const nextConfig = TOURNAMENT_CONFIG[tier];
    actionLabel = `▶ ADVANCE TO ${nextConfig.name.toUpperCase()}`;
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

        <!-- ELO + World Rank row -->
        <div style="display:flex;gap:12px">
          <div class="snes-panel" style="flex:1;display:flex;flex-direction:column;gap:8px">
            <p class="snes-small snes-muted">RATING</p>
            <p class="snes-label" style="font-size:14px">
              <span class="snes-highlight">${currentElo}</span>
              <span class="snes-small snes-muted"> ELO</span>
            </p>
          </div>
          <div class="snes-panel" style="flex:1;display:flex;flex-direction:column;gap:8px">
            <p class="snes-small snes-muted">WORLD RANK</p>
            <p class="snes-label" style="font-size:14px">
              ${worldRank !== null
                ? `<span class="snes-highlight">#${worldRank}</span><span class="snes-small snes-muted"> / ${TOTAL_PLAYERS}</span>`
                : `<span class="snes-muted">UNRANKED</span>`}
            </p>
          </div>
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

        <button class="snes-btn" id="btn-view-rankings" style="width:100%;font-size:8px">
          ★ VIEW GLOBAL RANKINGS
        </button>

        <button class="snes-btn snes-btn-yellow" id="btn-continue" style="width:100%">
          ${actionLabel}
        </button>

      </div>
    </div>
  `;

  document.getElementById('btn-continue').addEventListener('click', handleContinue);
  document.getElementById('btn-view-rankings')?.addEventListener('click', () => {
    openRankingsOverlay(charId, getAllNpcs);
  });

  // ── Handle continue ──────────────────────────────────────────────────────────

  function handleContinue() {
    const updatedProgress = { ...progress };
    updatedProgress.unspentSkillPoints     = (progress.unspentSkillPoints ?? 0) + pointsEarned;
    updatedProgress.totalSkillPointsEarned = (progress.totalSkillPointsEarned ?? 0) + pointsEarned;

    if (cfg.advanceable) {
      // Advance to next tournament tier
      const stats = loadStats(charId);
      if (stats) {
        if (outcome === 'champion') stats.career.tournamentsWon++;
        if (outcome === 'runner_up') stats.career.runnerUpFinishes++;
        stats.career.tournamentsEntered = (stats.career.tournamentsEntered ?? 0) + 1;
        stats.career.deepestTournamentReached = Math.max(
          stats.career.deepestTournamentReached ?? 0, tier
        );
        saveStats(charId, stats);
      }

      // Award 1st-place trophy for this tier (champion only reaches here)
      const advTrophies = loadTrophies(charId) ?? { trophies: [] };
      if (!advTrophies.trophies) advTrophies.trophies = [];
      const advTrophyId = `t${tier}_1st`;
      advTrophies.trophies.push({ id: advTrophyId, season: progress.currentSeason });
      saveTrophies(charId, advTrophies);

      const otherFinalistId = getOtherFinalistId(data);
      updatedProgress.previousFinalists    = ['player', otherFinalistId].filter(Boolean);
      updatedProgress.currentTournamentTier = tier + 1;
      // Tournament-scope powerup effects expire when advancing to the next tier.
      if (updatedProgress.activePowerupEffects) {
        updatedProgress.activePowerupEffects.tournament = [];
      }
      saveProgress(charId, updatedProgress);
      saveTournament(charId, null);
      navigate('skillTree', { charId, midSeason: true, nextTier: tier + 1 });
    } else {
      runSeasonEnd(updatedProgress);
    }
  }

  // ── Season-end flow ──────────────────────────────────────────────────────────

  function runSeasonEnd(updatedProgress) {
    const stats = loadStats(charId);

    // Detect championship milestones BEFORE incrementing stats
    const t5WinsBefore   = stats?.career?.t5Wins ?? 0;
    const champMilestones = [];
    if (outcome === 'champion' && tier === 5) {
      if (t5WinsBefore === 0) champMilestones.push(MILESTONE_FIRST_CHAMP_MSG);
      if (t5WinsBefore + 1 === 3) champMilestones.push(MILESTONE_THREE_TIME_CHAMP_MSG);
    }

    // Update career stats
    if (stats) {
      if (outcome === 'champion') {
        stats.career.tournamentsWon++;
        if (tier === 5) stats.career.t5Wins = t5WinsBefore + 1;
      }
      if (outcome === 'runner_up') stats.career.runnerUpFinishes++;
      stats.career.tournamentsEntered = (stats.career.tournamentsEntered ?? 0) + 1;
      stats.career.deepestTournamentReached = Math.max(
        stats.career.deepestTournamentReached ?? 0, tier
      );
      saveStats(charId, stats);
    }

    // Capture pre-simulation rank state for milestone detection
    const prevWorldRank = progress.worldRank ?? null;
    const prevPeakRank  = progress.peakWorldRank ?? null;

    updatedProgress.previousFinalists     = null;
    updatedProgress.currentTournamentTier = 1;
    updatedProgress.phase                 = 'off_season';
    // Tournament-scope powerup effects expire at season end (no active tournament).
    if (updatedProgress.activePowerupEffects) {
      updatedProgress.activePowerupEffects.tournament = [];
    }

    const worldData = loadWorld(charId);
    const trophies  = loadTrophies(charId) ?? {
      hofStatus: false, hofInductionSeason: null,
      seasonEloHistory: [], trophies: [],
      jessieOneShots: [], jessieSeasonCheckInHistory: [],
      achievedMilestones: [],
    };
    if (!trophies.achievedMilestones) trophies.achievedMilestones = [];
    if (!trophies.trophies) trophies.trophies = [];

    // Award trophy for champion (T5) or runner-up (any tier)
    let newTrophy = null;
    if (outcome === 'champion' || outcome === 'runner_up') {
      const place    = outcome === 'champion' ? '1st' : '2nd';
      const trophyId = `t${tier}_${place}`;
      const isFirstEarn = !trophies.trophies.some(e =>
        (typeof e === 'string' ? e : e.id) === trophyId
      );
      trophies.trophies.push({ id: trophyId, season: updatedProgress.currentSeason });
      if (isFirstEarn) newTrophy = TROPHY_CONFIG.find(t => t.id === trophyId) ?? null;
    }

    // Run NPC simulation — writes world, progress (worldRank + peakWorldRank), trophies, stats
    runSeasonSimulation(charId, worldData, getAllNpcs(), updatedProgress, stats, trophies);

    // Re-read progress to get the new worldRank written by the simulation
    const freshProgress = loadProgress(charId);
    const newWorldRank  = freshProgress.worldRank;

    // Snapshot which milestones were already achieved before this season
    const prevAchievedSet = new Set(trophies.achievedMilestones ?? []);

    // Detect ranking milestones
    const { messages: rankMessages, newAchieved } =
      detectRankingMilestones(newWorldRank, prevPeakRank, trophies.achievedMilestones);

    // Persist updated achieved-milestone list
    const freshTrophies = loadTrophies(charId);
    freshTrophies.achievedMilestones = newAchieved;
    saveTrophies(charId, freshTrophies);

    saveTournament(charId, null);

    const allMilestones = [...champMilestones, ...rankMessages];

    // Determine which Jessie milestone beat fires this season (highest priority only)
    const champMilestoneId = outcome === 'champion' && tier === 5
      ? (t5WinsBefore + 1 === 3 ? 'three_time_champ' : t5WinsBefore === 0 ? 'first_champ' : null)
      : null;
    const newRankingIds    = newAchieved.filter(id => !prevAchievedSet.has(id));
    const personalBestFired = (prevPeakRank === null || newWorldRank < prevPeakRank);
    const allFiredIds = [
      ...(champMilestoneId ? [champMilestoneId] : []),
      ...newRankingIds,
      ...(personalBestFired ? ['personal_best'] : []),
    ];
    const topMilestoneId = JESSIE_MILESTONE_PRIORITY.find(id => allFiredIds.includes(id)) ?? null;

    const proceedToResults = () => renderSeasonResults(newWorldRank, prevWorldRank, allMilestones, newTrophy);

    if (outcome === 'eliminated') {
      // Consolation dialogue — no trophy shown for eliminated players
      showJessieDialogue(
        container,
        JESSIE_CONSOLATION_DIALOGUE[tier] ?? [],
        'sad',
        () => renderSeasonResults(newWorldRank, prevWorldRank, allMilestones, null),
      );
    } else if (topMilestoneId && JESSIE_MILESTONE_DIALOGUE[topMilestoneId]) {
      const { lines, expression } = JESSIE_MILESTONE_DIALOGUE[topMilestoneId];
      showJessieDialogue(container, lines, expression, proceedToResults);
    } else {
      proceedToResults();
    }
  }

  // ── Season results panel ─────────────────────────────────────────────────────

  function renderSeasonResults(newRank, prevRank, milestones, newTrophy) {
    const rankDelta = prevRank !== null ? prevRank - newRank : null;
    const deltaHtml =
      rankDelta === null ? '' :
      rankDelta > 0      ? `<p class="snes-small snes-success" style="margin-top:4px">▲ Up from #${prevRank}</p>` :
      rankDelta < 0      ? `<p class="snes-small snes-error"   style="margin-top:4px">▼ Down from #${prevRank}</p>` :
                           `<p class="snes-small snes-muted"   style="margin-top:4px">— Same as last season (#${prevRank})</p>`;

    const trophyPx = newTrophy ? ([40,48,56,64,80][(newTrophy.tier ?? 1) - 1] ?? 48) : 48;
    const trophyHtml = newTrophy ? `
      <div class="snes-panel" style="display:flex;align-items:center;gap:16px">
        <img src="${newTrophy.asset}" alt="${newTrophy.label}"
             style="width:${trophyPx}px;height:${trophyPx}px;image-rendering:pixelated;flex-shrink:0">
        <div style="display:flex;flex-direction:column;gap:6px">
          <p class="snes-small snes-muted">NEW TROPHY</p>
          <p class="snes-small snes-highlight">★ ${newTrophy.label}</p>
        </div>
      </div>
    ` : '';

    const milestonesHtml = milestones.length > 0 ? `
      <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
        <p class="snes-small snes-muted">ACHIEVEMENTS</p>
        ${milestones.map(m => `
          <p class="snes-small snes-success">★ ${m}</p>
        `).join('')}
      </div>
    ` : '';

    container.innerHTML = `
      <div class="screen fade-in" style="justify-content:center">
        <div class="content-card" style="gap:20px">

          <p class="snes-title" style="text-align:center">SEASON COMPLETE</p>

          <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
            <p class="snes-small snes-muted">WORLD RANKING</p>
            <p class="snes-label" style="font-size:14px">
              <span class="snes-highlight">#${newRank}</span>
              <span class="snes-small snes-muted"> of ${TOTAL_PLAYERS}</span>
            </p>
            ${deltaHtml}
          </div>

          ${trophyHtml}
          ${milestonesHtml}

          <button class="snes-btn" id="btn-season-view-rankings" style="width:100%;font-size:8px">
            ★ VIEW GLOBAL RANKINGS
          </button>

          <button class="snes-btn snes-btn-yellow" id="btn-season-continue" style="width:100%">
            ▶ CONTINUE
          </button>

        </div>
      </div>
    `;

    document.getElementById('btn-season-view-rankings')?.addEventListener('click', () => {
      openRankingsOverlay(charId, getAllNpcs);
    });
    document.getElementById('btn-season-continue').addEventListener('click', () => {
      navigate('offSeason', { charId });
    });
  }
}
