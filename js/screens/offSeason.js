import { navigate } from '../main.js';
import { TOTAL_PLAYERS } from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
} from '../storage.js';

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const identity = loadIdentity(charId);
  const progress = loadProgress(charId);

  const name        = identity?.name?.toUpperCase() ?? '???';
  const portraitId  = identity?.portraitId ?? 'male_1';
  const elo         = progress?.currentElo ?? 0;
  const worldRank   = progress?.worldRank ?? null;
  const season      = progress?.currentSeason ?? 1;
  const unspent     = progress?.unspentSkillPoints ?? 0;
  const nextSeason  = season + 1;
  const inventory   = progress?.powerupInventory ?? [];

  container.innerHTML = `
    <div class="screen fade-in" style="justify-content:center">
      <div class="content-card" style="gap:20px">

        <p class="snes-title" style="text-align:center">OFF-SEASON</p>
        <p class="snes-small snes-muted" style="text-align:center">SEASON ${season} COMPLETE</p>

        <!-- Jessie check-in -->
        <div class="snes-panel" style="display:flex;align-items:flex-start;gap:14px">
          <div class="portrait-frame portrait-frame--lg" style="flex-shrink:0">
            <img src="assets/portraits/jessie/Jessie_default.png" alt="Jessie"
              style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated">
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px">
            <p class="snes-small snes-highlight">JESSIE</p>
            <p class="snes-small" style="line-height:1.8">Off-season. Time to get to work.</p>
          </div>
        </div>

        <!-- Player identity -->
        <div class="snes-panel" style="display:flex;align-items:center;gap:16px">
          <div class="portrait-frame portrait-frame--lg">
            <img src="assets/portraits/${portraitId}.png" alt="">
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <p class="snes-label snes-highlight">${name}</p>
            <p class="snes-small">ELO <span class="snes-highlight">${elo}</span></p>
            <p class="snes-small">
              RANK
              ${worldRank !== null
                ? `<span class="snes-highlight">#${worldRank}</span><span class="snes-muted"> of ${TOTAL_PLAYERS}</span>`
                : `<span class="snes-muted">UNRANKED</span>`}
            </p>
          </div>
        </div>

        <!-- Skill points -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
          <p class="snes-small snes-muted">SKILL POINTS</p>
          <p class="snes-label snes-highlight">${unspent} PTS AVAILABLE</p>
          <div class="snes-panel" style="opacity:0.5;text-align:center">
            <p class="snes-small snes-muted">SKILL TREE RESPEC</p>
            <p class="snes-small snes-muted" style="margin-top:4px">[UNLOCKS V0.3]</p>
          </div>
        </div>

        <!-- Powerup inventory -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
          <p class="snes-small snes-muted">POWERUP INVENTORY</p>
          ${inventory.length > 0
            ? `<p class="snes-small snes-muted">
                 ${inventory.length} powerup${inventory.length > 1 ? 's' : ''} cleared for the new season.
               </p>`
            : `<p class="snes-small snes-muted">No powerups to clear.</p>`
          }
          <p class="snes-small snes-muted" style="font-size:5px">
            A fresh starting loadout will be drawn from your skill trees.
          </p>
        </div>

        <button class="snes-btn snes-btn-yellow" id="btn-begin" style="width:100%">
          ▶ BEGIN SEASON ${nextSeason}
        </button>

      </div>
    </div>
  `;

  document.getElementById('btn-begin').addEventListener('click', () => {
    const p = loadProgress(charId);
    p.currentSeason          = nextSeason;
    p.currentTournamentTier  = 1;
    p.previousFinalists      = null;

    // Reset all carry-over powerup effects — new season, fresh slate.
    p.activePowerupEffects   = { tournament: [], season: [] };

    // Inventory is cleared here. The starting loadout is regenerated at the
    // end of the pre-season skill tree screen (after any new purchases) so
    // that L2 buys made this off-season can affect what gets seeded.
    p.powerupInventory       = [];
    p.phase                  = 'pre_season';
    saveProgress(charId, p);
    navigate('skillTree', { charId });
  });
}
