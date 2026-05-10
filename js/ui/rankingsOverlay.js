import { loadIdentity, loadProgress, loadWorld, loadTrophies, saveTrophies } from '../storage.js';
import { TOTAL_PLAYERS, JESSIE_TUTORIAL_DIALOGUE } from '../constants.js';
import { showJessieDialogue, tutorialBeatShown, markTutorialBeat } from './jessieDialogue.js';

// ── Global Rankings overlay ───────────────────────────────────────────────────
// Call openRankingsOverlay(charId, getAllNpcsFn) from any screen.
// Toggle: calling again while open closes it.

export function openRankingsOverlay(charId, getAllNpcsFn) {
  const existing = document.getElementById('rankings-overlay');
  if (existing) { existing.remove(); return; }

  // T-12: introduce ELO & rankings on first ever view
  const _trophiesT12 = loadTrophies(charId);
  if (!tutorialBeatShown(_trophiesT12, 'T-12')) {
    const { expression, lines } = JESSIE_TUTORIAL_DIALOGUE['T-12'];
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1300;';
    document.body.appendChild(tempContainer);
    showJessieDialogue(tempContainer, lines, expression, () => {
      markTutorialBeat(_trophiesT12, 'T-12');
      saveTrophies(charId, _trophiesT12);
      tempContainer.remove();
      openRankingsOverlay(charId, getAllNpcsFn);
    });
    return;
  }

  const identity  = loadIdentity(charId);
  const progress  = loadProgress(charId);
  const worldData = loadWorld(charId);
  const allNpcs   = getAllNpcsFn();

  // Build unified list
  const entries = [
    {
      id:        'player',
      name:      identity?.name?.toUpperCase() ?? 'YOU',
      portraitId: identity?.portraitId ?? 'male_1',
      elo:       progress?.currentElo ?? 1000,
      tier:      progress?.currentTournamentTier ?? 1,
      isPlayer:  true,
    },
    ...allNpcs.map(npc => ({
      id:        npc.id,
      name:      npc.name.toUpperCase(),
      portraitId: npc.portraitId,
      elo:       worldData?.npcs?.[npc.id]?.currentElo ?? npc.startingElo,
      tier:      npc.tournamentLevel,
      isPlayer:  false,
    })),
  ].sort((a, b) => b.elo - a.elo);

  const playerRank = entries.findIndex(e => e.isPlayer) + 1;

  const rowsHTML = entries.map((entry, i) => {
    const rank = i + 1;
    const hl   = entry.isPlayer;
    return `
      <div ${hl ? 'id="rankings-player-row"' : ''}
           style="display:flex;align-items:center;gap:10px;padding:8px 14px;
                  border-bottom:1px solid var(--snes-border);
                  ${hl ? 'background:var(--snes-yellow)1a;border-left:4px solid var(--snes-yellow);' : ''}">
        <p class="snes-small" style="width:32px;text-align:right;flex-shrink:0;
                                     font-size:7px;
                                     color:${hl ? 'var(--snes-yellow)' : 'var(--snes-border-light)'}">
          #${rank}
        </p>
        <div class="portrait-frame" style="width:28px;height:28px;flex-shrink:0">
          <img src="assets/portraits/${entry.portraitId}.png" alt=""
               style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">
        </div>
        <p class="snes-small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                                     font-size:7px;
                                     color:${hl ? 'var(--snes-yellow)' : 'var(--snes-text)'}">
          ${entry.name}${hl ? ' ◀' : ''}
        </p>
        <p class="snes-small" style="width:44px;text-align:right;flex-shrink:0;font-size:7px;
                                     color:${hl ? 'var(--snes-yellow)' : 'var(--snes-highlight)'}">
          ${entry.elo}
        </p>
      </div>
    `;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'rankings-overlay';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:var(--snes-black);z-index:1200;
    display:flex;flex-direction:column;overflow:hidden;
  `;

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;
                padding:12px 20px;background:var(--snes-panel);
                border-bottom:3px solid var(--snes-border);flex-shrink:0">
      <p class="snes-title" style="font-size:11px">GLOBAL RANKINGS</p>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="snes-btn" id="btn-rankings-scroll-me"
                style="font-size:7px;padding:8px 12px">
          ▶ MY RANK (#${playerRank})
        </button>
        <button class="snes-btn" id="btn-rankings-close"
                style="font-size:7px;padding:8px 12px">✕ CLOSE</button>
      </div>
    </div>

    <!-- Column headers -->
    <div style="display:flex;align-items:center;gap:10px;padding:6px 14px;
                background:var(--snes-panel-dark);border-bottom:2px solid var(--snes-border);flex-shrink:0">
      <p class="snes-small snes-muted" style="font-size:6px;width:32px;text-align:right">RANK</p>
      <div style="width:28px;flex-shrink:0"></div>
      <p class="snes-small snes-muted" style="font-size:6px;flex:1">NAME</p>
      <p class="snes-small snes-muted" style="font-size:6px;width:44px;text-align:right">ELO</p>
    </div>

    <div id="rankings-scroll" style="flex:1;overflow-y:auto;overflow-x:hidden">
      ${rowsHTML}
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btn-rankings-close').addEventListener('click', () => overlay.remove());
  document.getElementById('btn-rankings-scroll-me').addEventListener('click', () => {
    document.getElementById('rankings-player-row')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  // Auto-scroll to player on open
  requestAnimationFrame(() => {
    document.getElementById('rankings-player-row')?.scrollIntoView({ block: 'center' });
  });
}
