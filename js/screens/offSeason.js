import { navigate } from '../main.js';
import { TOTAL_PLAYERS, NODE_COST, JESSIE_TUTORIAL_DIALOGUE, JESSIE_SEASON_CHECKIN, SKILL_NODE_INFO, POWERUP_ICONS } from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
  loadTrophies, saveTrophies,
} from '../storage.js';
import { showJessieDialogue, jessieInlinePanel, tutorialBeatShown, markTutorialBeat } from '../ui/jessieDialogue.js';

// Returns names of all L2+ nodes currently purchased (these will be refunded).
function getRefundedNodeNames(treeState) {
  const names = [];
  for (const tree of Object.values(treeState ?? {})) {
    for (const [nodeId, purchased] of Object.entries(tree)) {
      if (purchased) {
        const level = nodeId.split('.').length - 1;
        if (level >= 2) {
          const info = SKILL_NODE_INFO[nodeId];
          if (info) names.push(info.name);
        }
      }
    }
  }
  return names;
}

// Returns total skill points locked up in L2+ nodes (L1 roots are kept).
function computeRefund(treeState) {
  let total = 0;
  for (const tree of Object.values(treeState ?? {})) {
    for (const [nodeId, purchased] of Object.entries(tree)) {
      if (purchased) {
        const level = nodeId.split('.').length - 1;
        if (level >= 2) total += NODE_COST[`L${level}`] ?? 0;
      }
    }
  }
  return total;
}

// Zeros all L2+ nodes in treeState in place; L1 root nodes are preserved.
function clearTreeState(treeState) {
  for (const tree of Object.values(treeState ?? {})) {
    for (const nodeId of Object.keys(tree)) {
      const level = nodeId.split('.').length - 1;
      if (level >= 2) tree[nodeId] = false;
    }
  }
}

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const identity = loadIdentity(charId);
  let   progress = loadProgress(charId);

  // ── Capture pre-respec state for display, then apply refund ─────────────────
  // Idempotent: after clearing, all nodes are false so refund = 0 on re-entry.
  const clearedInventory  = [...(progress.powerupInventory ?? [])];
  const refundedNodeNames = getRefundedNodeNames(progress.treeState);
  const refundAmount      = computeRefund(progress.treeState);
  if (refundAmount > 0) {
    clearTreeState(progress.treeState);
    progress.unspentSkillPoints = (progress.unspentSkillPoints ?? 0) + refundAmount;
    saveProgress(charId, progress);
  }

  const name          = identity?.name?.toUpperCase() ?? '???';
  const portraitId    = identity?.portraitId ?? 'male_1';
  const elo           = progress?.currentElo ?? 0;
  const worldRank     = progress?.worldRank ?? null;
  const season        = progress?.currentSeason ?? 1;
  const unspent       = progress?.unspentSkillPoints ?? 0;
  const nextSeason    = season + 1;
  const inventory     = progress?.powerupInventory ?? [];
  const primaryTree   = identity?.primaryTree  ?? null;
  const secondaryTree = identity?.secondaryTree ?? null;
  const availableTrees = [primaryTree, secondaryTree].filter(Boolean);

  const trophies = loadTrophies(charId);

  // T-13: introduce the off-season/respec concept on the very first visit (one-shot)
  if (!tutorialBeatShown(trophies, 'T-13')) {
    const { expression, lines } = JESSIE_TUTORIAL_DIALOGUE['T-13'];
    showJessieDialogue(container, lines, expression, () => {
      markTutorialBeat(trophies, 'T-13');
      saveTrophies(charId, trophies);
      renderScreen('');  // no M-12 panel on first visit — T-13 just covered it
    });
    return;
  }

  // M-12: rotating seasonal check-in for all subsequent off-seasons
  let jessiePanelHtml = '';
  if (JESSIE_SEASON_CHECKIN.length > 0) {
    let history = trophies.jessieSeasonCheckInHistory ?? [];
    if (history.length >= JESSIE_SEASON_CHECKIN.length) history = [];
    const idx = history.length;
    history.push(idx);
    trophies.jessieSeasonCheckInHistory = history;
    saveTrophies(charId, trophies);
    const { expression, text } = JESSIE_SEASON_CHECKIN[idx];
    jessiePanelHtml = jessieInlinePanel(text, expression);
  }

  renderScreen(jessiePanelHtml);

  function renderScreen(jessiePanelHTML) {
    container.innerHTML = `
      <div class="screen fade-in" style="justify-content:center">
        <div class="content-card" style="gap:20px">

          <p class="snes-title" style="text-align:center">OFF-SEASON</p>
          <p class="snes-small snes-muted" style="text-align:center">SEASON ${season} COMPLETE</p>

          ${jessiePanelHTML}

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

          <!-- Skill points / respec summary -->
          <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
            <p class="snes-small snes-muted">SKILL POINT RESPEC</p>
            ${refundAmount > 0
              ? `<p class="snes-small snes-success">▲ ${refundAmount} PTS REFUNDED FROM LAST SEASON</p>`
              : ''}
            <p class="snes-label snes-highlight">${unspent} PTS AVAILABLE</p>
            <p class="snes-small snes-muted">
              TREES: ${availableTrees.length > 0 ? availableTrees.join(' + ') : '—'}
            </p>
            <p class="snes-small snes-muted" style="font-size:5px">
              Root nodes kept. All other nodes refunded. Reallocate freely before starting Season ${nextSeason}.
            </p>
          </div>

          <!-- Powerup inventory cleared -->
          <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px">
            <p class="snes-small snes-muted">POWERUP INVENTORY CLEARED</p>
            ${clearedInventory.length > 0
              ? clearedInventory.map(pu => {
                  const icon = POWERUP_ICONS[pu.name] ?? '';
                  return `<div style="display:flex;align-items:center;gap:8px">
                    ${icon ? `<img src="${icon}" alt="" style="width:20px;height:20px;image-rendering:pixelated;object-fit:contain;flex-shrink:0">` : ''}
                    <p class="snes-small snes-muted" style="font-size:5px">${pu.name.toUpperCase()}</p>
                  </div>`;
                }).join('')
              : `<p class="snes-small snes-muted" style="font-size:5px">No powerups held.</p>`
            }
            <p class="snes-small snes-muted" style="font-size:5px">
              A fresh starting loadout will be drawn from your skill trees.
            </p>
          </div>

          <!-- Respec preview -->
          ${refundedNodeNames.length > 0 ? `
          <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
            <p class="snes-small snes-muted">NODES REFUNDED (${refundedNodeNames.length})</p>
            ${refundedNodeNames.map(n => `<p class="snes-small snes-muted" style="font-size:5px">◉ ${n.toUpperCase()}</p>`).join('')}
            <p class="snes-small snes-success" style="font-size:5px">Root nodes kept. Reallocate freely.</p>
          </div>
          ` : ''}

          <button class="snes-btn snes-btn-yellow" id="btn-begin" style="width:100%">
            ▶ RESPEC SKILL TREE FOR SEASON ${nextSeason}
          </button>

        </div>
      </div>
    `;

    document.getElementById('btn-begin').addEventListener('click', () => {
      const p = loadProgress(charId);
      p.currentSeason          = nextSeason;
      p.currentTournamentTier  = 1;
      p.previousFinalists      = null;
      p.activePowerupEffects   = { tournament: [], season: [] };

      // Inventory cleared here; starting loadout regenerated in skillTree.js at Lock In
      // so any new purchases during pre-season affect what gets seeded.
      p.powerupInventory       = [];
      p.phase                  = 'pre_season';
      saveProgress(charId, p);
      navigate('skillTree', { charId });
    });
  }
}
