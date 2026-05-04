import { navigate } from '../main.js';
import {
  SKILL_TREE_INFO, SKILL_TREE_L2, NODE_COST, STARTING_SKILL_POINTS_SEASON_1,
  TOURNAMENT_CONFIG,
} from '../constants.js';
import { mount as mountTreePanel } from '../ui/skillTreePanel.js';
import { getInitialTreeState } from '../systems/seasonEngine.js';
import { generateStartingLoadout } from '../systems/powerupEngine.js';
import {
  loadSession, loadIdentity, saveIdentity,
  loadProgress, saveProgress,
} from '../storage.js';

export function mount(container, options = {}) {
  const session   = loadSession();
  const charId    = options.charId ?? session?.activeCharId;
  const midSeason = options.midSeason ?? false;   // true = between tournaments, add-only
  const nextTier  = options.nextTier  ?? null;    // next tournament tier number (mid-season)
  const identity  = loadIdentity(charId);
  let   progress  = loadProgress(charId);

  const isSeason1 = (progress.currentSeason ?? 1) === 1;

  // Seed treeState if missing
  if (!progress.treeState || Object.keys(progress.treeState).length === 0) {
    progress.treeState = {
      MIND:    getInitialTreeState('MIND'),
      MYSTIC:  getInitialTreeState('MYSTIC'),
      FORTUNE: getInitialTreeState('FORTUNE'),
    };
  }

  // Grant Season 1 starting points once
  if (isSeason1
      && (progress.unspentSkillPoints ?? 0) === 0
      && (progress.totalSkillPointsEarned ?? 0) === 0) {
    progress.unspentSkillPoints     = STARTING_SKILL_POINTS_SEASON_1;
    progress.totalSkillPointsEarned = STARTING_SKILL_POINTS_SEASON_1;
    saveProgress(charId, progress);
  }

  let primaryTree   = identity.primaryTree   ?? null;
  let secondaryTree = identity.secondaryTree ?? null;

  // Panel navigation/selection state (persists across renders)
  let activeTreeIdx  = 0;
  let selectedNodeId = null;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function isPurchased(nodeId) {
    const tree = nodeId.split('.')[0];
    return Boolean(progress.treeState?.[tree]?.[nodeId]);
  }

  function anyNodePurchased() {
    return Object.values(progress.treeState ?? {}).some(tree =>
      Object.values(tree).some(v => v === true)
    );
  }

  // Refunds only allowed pre-season during Season 1
  const canRefund = isSeason1 && !midSeason;

  // ── Render ───────────────────────────────────────────────────────────────────

  function render() {
    const unspent   = progress.unspentSkillPoints ?? 0;
    const hasPoints = unspent > 0;

    // Mid-season: button always enabled (player can proceed without spending)
    // Pre-season: button disabled until at least one node purchased
    const locked     = anyNodePurchased();
    const btnEnabled = midSeason ? true : locked;

    let headerSub = '';
    if (midSeason) {
      const nextName = TOURNAMENT_CONFIG[nextTier - 1]?.name ?? `Tier ${nextTier}`;
      headerSub = `MID-SEASON · HEADING INTO ${nextName.toUpperCase()}`;
    } else {
      headerSub = isSeason1 ? 'SEASON 1 — CHOOSE ONE TREE' : `SEASON ${progress.currentSeason} · PRE-SEASON`;
    }

    const continueBtnLabel = midSeason
      ? '▶ CONTINUE TO NEXT TOURNAMENT'
      : '▶ LOCK IN &amp; BEGIN SEASON';

    const footerNote = midSeason
      ? (hasPoints ? `${unspent} UNSPENT POINT${unspent !== 1 ? 'S' : ''} — SPEND NOW OR CARRY FORWARD.` : 'NO UNSPENT POINTS — NOTHING TO SPEND.')
      : (locked ? 'READY — YOUR CHOICES WILL LOCK IN FOR THE SEASON.' : 'PURCHASE AT LEAST ONE NODE TO LOCK IN.');

    container.innerHTML = `
      <div class="screen fade-in" style="justify-content:flex-start;padding:0">
        <div style="width:100%;display:flex;flex-direction:column;gap:0">

          <!-- Header -->
          <div style="padding:16px;background:var(--snes-panel-dark);border-bottom:2px solid var(--snes-border)">
            <p class="snes-title" style="text-align:center;font-size:10px">SKILL TREES</p>
            <p class="snes-small snes-muted" style="text-align:center;margin-top:6px">${headerSub}</p>
          </div>

          <!-- Tree panel -->
          <div id="st-panel-mount"></div>

          <!-- Continue / Lock In -->
          <div style="padding:12px;display:flex;flex-direction:column;gap:8px;
                      background:var(--snes-panel-dark);border-top:2px solid var(--snes-border)">
            <p class="snes-small snes-muted" style="text-align:center;font-size:5px">${footerNote}</p>
            <button class="snes-btn snes-btn-yellow" id="btn-lock-in"
                    style="width:100%${btnEnabled ? '' : ';opacity:0.4;cursor:not-allowed'}"
                    ${btnEnabled ? '' : 'disabled'}>
              ${continueBtnLabel}
            </button>
          </div>

        </div>
      </div>
    `;

    mountTreePanel(document.getElementById('st-panel-mount'), {
      treeState:     progress.treeState,
      unspentPoints: progress.unspentSkillPoints ?? 0,
      readOnly:      false,
      isSeason1,
      primaryTree,
      secondaryTree,
      canRefund,
      activeTreeIdx,
      selectedNodeId,
      onTreeChange:  (idx) => { activeTreeIdx = idx; selectedNodeId = null; render(); },
      onNodeSelect:  (id)  => { selectedNodeId = id; render(); },
      onBuy:         handleBuy,
      onRefund:      handleRefund,
    });

    document.getElementById('btn-lock-in')?.addEventListener('click', handleLockIn);
  }

  // ── Buy / refund ─────────────────────────────────────────────────────────────

  function handleBuy(nodeId) {
    const tree  = nodeId.split('.')[0];
    const level = nodeId.split('.').length - 1;
    const cost  = NODE_COST[`L${level}`];
    if (!cost || isPurchased(nodeId)) return;

    const isSeason1Tree = isSeason1 && primaryTree !== null && primaryTree !== tree;
    const isBothPicked  = !isSeason1 && primaryTree && secondaryTree &&
                          tree !== primaryTree && tree !== secondaryTree;
    if (isSeason1Tree || isBothPicked) return;

    if ((progress.unspentSkillPoints ?? 0) < cost) return;

    // L2 requires L1 root
    if (level === 2 && !isPurchased(`${tree}.1`)) return;

    progress.unspentSkillPoints -= cost;
    progress.treeState[tree][nodeId] = true;

    // Commit tree selection
    if (level === 1) {
      if (isSeason1 && primaryTree === null) {
        primaryTree = tree;
        identity.primaryTree = tree;
        saveIdentity(charId, identity);
      } else if (!isSeason1 && primaryTree && tree !== primaryTree && secondaryTree === null) {
        secondaryTree = tree;
        identity.secondaryTree = tree;
        saveIdentity(charId, identity);
      }
    }

    saveProgress(charId, progress);
    selectedNodeId = null;
    render();
  }

  function handleRefund(nodeId) {
    if (!canRefund || !isPurchased(nodeId)) return;
    const tree  = nodeId.split('.')[0];
    const level = nodeId.split('.').length - 1;
    const cost  = NODE_COST[`L${level}`];

    // Refunding L1 cascades to all purchased L2 children
    if (level === 1) {
      for (const [id, val] of Object.entries(progress.treeState[tree])) {
        if (id !== nodeId && val === true) {
          const cl = id.split('.').length - 1;
          progress.unspentSkillPoints += NODE_COST[`L${cl}`];
          progress.treeState[tree][id] = false;
        }
      }
    }

    progress.treeState[tree][nodeId] = false;
    progress.unspentSkillPoints += cost;

    if (level === 1 && isSeason1 && primaryTree === tree) {
      primaryTree = null;
      identity.primaryTree = null;
      saveIdentity(charId, identity);
    }

    saveProgress(charId, progress);
    selectedNodeId = null;
    render();
  }

  // ── Lock In / Continue ───────────────────────────────────────────────────────

  function handleLockIn() {
    if (midSeason) {
      // Mid-season: just save whatever was spent (or nothing) and head to next tournament
      saveProgress(charId, progress);
      navigate('tournament', { charId });
    } else {
      // Pre-season: require at least one node, generate starting loadout
      if (!anyNodePurchased()) return;
      const loadout = generateStartingLoadout(progress.treeState);
      progress.powerupInventory = loadout;
      progress.phase = 'active_season';
      saveProgress(charId, progress);
      navigate('tournament', { charId });
    }
  }

  render();
}
