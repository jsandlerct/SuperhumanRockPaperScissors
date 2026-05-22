import { navigate } from '../main.js';
import {
  SKILL_TREE_INFO, SKILL_TREE_L2, NODE_COST, STARTING_SKILL_POINTS_SEASON_1,
  TOURNAMENT_CONFIG, JESSIE_TUTORIAL_DIALOGUE, SKILL_NODE_INFO,
} from '../constants.js';
import { mount as mountTreePanel } from '../ui/skillTreePanel.js';
import { getInitialTreeState } from '../systems/seasonEngine.js';
import { generateStartingLoadout } from '../systems/powerupEngine.js';
import {
  loadSession, loadIdentity, saveIdentity,
  loadProgress, saveProgress,
  loadTrophies, saveTrophies,
} from '../storage.js';
import { showJessieDialogue, tutorialBeatShown, markTutorialBeat } from '../ui/jessieDialogue.js';

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
  // Mid-season: default to the first tree that has purchased nodes so the
  // player lands on their active build rather than an empty MIND column.
  const TREES = ['MIND', 'MYSTIC', 'FORTUNE'];
  const firstActiveIdx = midSeason
    ? (TREES.findIndex(t => Object.values(progress.treeState?.[t] ?? {}).some(v => v === true)) ?? 0)
    : 0;
  let activeTreeIdx  = firstActiveIdx >= 0 ? firstActiveIdx : 0;
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

  // Refunds allowed during any pre-season phase (Season 2+ starts with all nodes cleared
  // from the off-season respec, so the allocation window before Lock In should be flexible).
  const canRefund = !midSeason;

  // Season 2+ pre-season requires picking a second tree before Lock In is allowed.
  // Must be a function (not a const) so render() sees the updated secondaryTree after each buy.
  function needsSecondaryPick() { return !isSeason1 && !midSeason && secondaryTree === null; }

  // ── Render ───────────────────────────────────────────────────────────────────

  function render() {
    // Preserve canvas scroll position across re-renders so purchasing a node
    // doesn't snap the view back to the top of the tree.
    const canvasWrap = container.querySelector('.st-canvas-wrap');
    const savedScrollX = canvasWrap?.scrollLeft ?? 0;
    const unspent   = progress.unspentSkillPoints ?? 0;
    const hasPoints = unspent > 0;

    const locked     = anyNodePurchased();
    // Lock In requires: mid-season (always ok) OR (≥1 node AND second tree already chosen)
    const btnEnabled = midSeason ? true : (locked && !needsSecondaryPick());

    let headerSub = '';
    if (midSeason) {
      const nextName = TOURNAMENT_CONFIG[nextTier - 1]?.name ?? `Tier ${nextTier}`;
      headerSub = `MID-SEASON · HEADING INTO ${nextName.toUpperCase()}`;
    } else if (isSeason1) {
      headerSub = 'SEASON 1 — CHOOSE ONE TREE';
    } else if (needsSecondaryPick()) {
      headerSub = `SEASON ${progress.currentSeason} — CHOOSE YOUR SECOND TREE`;
    } else {
      headerSub = `SEASON ${progress.currentSeason} · PRE-SEASON`;
    }

    // Lock In button label: show reason when disabled (clearer than a dim button)
    let continueBtnLabel;
    if (midSeason) {
      continueBtnLabel = '▶ CONTINUE TO NEXT TOURNAMENT';
    } else if (!locked) {
      continueBtnLabel = 'BUY A NODE TO LOCK IN';
    } else if (needsSecondaryPick()) {
      continueBtnLabel = 'CHOOSE A SECOND TREE';
    } else {
      continueBtnLabel = '▶ LOCK IN &amp; BEGIN SEASON';
    }

    let footerNote = '';
    if (midSeason) {
      footerNote = hasPoints
        ? `${unspent} UNSPENT POINT${unspent !== 1 ? 'S' : ''} — SPEND NOW OR CARRY FORWARD.`
        : 'NO UNSPENT POINTS — NOTHING TO SPEND.';
    } else if (needsSecondaryPick()) {
      footerNote = 'BUY A ROOT NODE IN A SECOND TREE TO UNLOCK LOCK IN.';
    } else {
      footerNote = locked
        ? 'READY — YOUR CHOICES WILL LOCK IN FOR THE SEASON.'
        : 'PURCHASE AT LEAST ONE NODE TO LOCK IN.';
    }

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

          <!-- Continue / Lock In — sticky so it stays visible on mobile without needing to scroll -->
          <div style="padding:12px;display:flex;flex-direction:column;gap:8px;
                      background:var(--snes-panel-dark);border-top:2px solid var(--snes-border);
                      position:sticky;bottom:0;z-index:50">
            <p class="snes-small snes-muted" style="text-align:center;font-size:5px">${footerNote}</p>
            <button class="snes-btn snes-btn-yellow" id="btn-lock-in"
                    style="width:100%${btnEnabled ? '' : ';opacity:0.5'}"
                    >
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

    // Restore canvas scroll position after re-render
    if (savedScrollX > 0) {
      const newCanvasWrap = container.querySelector('.st-canvas-wrap');
      if (newCanvasWrap) newCanvasWrap.scrollLeft = savedScrollX;
    }

    const lockInBtn = document.getElementById('btn-lock-in');
    if (lockInBtn) {
      lockInBtn.addEventListener('click', () => {
        if (!btnEnabled) {
          // Shake to communicate "not valid" instead of silent disabled tap
          lockInBtn.classList.remove('shake');
          void lockInBtn.offsetWidth; // reflow to restart animation
          lockInBtn.classList.add('shake');
          lockInBtn.addEventListener('animationend', () => lockInBtn.classList.remove('shake'), { once: true });
          return;
        }
        handleLockIn();
      });
    }
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
    // L3 and L4 require direct parent
    if (level === 3 || level === 4) {
      const parentId = nodeId.split('.').slice(0, -1).join('.');
      if (!isPurchased(parentId)) return;
    }

    progress.unspentSkillPoints -= cost;
    // Initialise tree entry if the player is buying into a new tree for the first time.
    if (!progress.treeState[tree]) {
      progress.treeState[tree] = getInitialTreeState(tree);
    }
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

    // Find all purchased descendants that would also be refunded
    const cascadeNodes = Object.entries(progress.treeState[tree] ?? {})
      .filter(([id, val]) => val === true && id.startsWith(nodeId + '.'));

    if (cascadeNodes.length > 0) {
      // Warn the player before silently removing their descendants
      const cascadeNames = cascadeNodes.map(([id]) => {
        return SKILL_NODE_INFO?.[id]?.name ?? id;
      });
      const totalPts = cascadeNodes.reduce((sum, [id]) => {
        const cl = id.split('.').length - 1;
        return sum + (NODE_COST[`L${cl}`] ?? 0);
      }, NODE_COST[`L${level}`] ?? 0);

      showRefundCascadeConfirm(nodeId, cascadeNames, totalPts, () => executeRefund(nodeId));
      return;
    }

    executeRefund(nodeId);
  }

  function showRefundCascadeConfirm(nodeId, cascadeNames, totalPts, onConfirm) {
    const layer = document.createElement('div');
    layer.id = 'refund-confirm-layer';
    layer.style.cssText = 'position:fixed;inset:0;background:rgba(13,13,26,0.92);z-index:var(--z-popup);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    const listItems = cascadeNames.map(n => `<p class="snes-small snes-error" style="line-height:2">✕ ${n.toUpperCase()}</p>`).join('');
    layer.innerHTML = `
      <div style="max-width:360px;width:100%;display:flex;flex-direction:column;gap:14px">
        <p class="snes-title" style="font-size:9px;text-align:center;color:var(--snes-red)">REFUND CASCADE</p>
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
          <p class="snes-small snes-muted" style="line-height:2">Refunding this node will also refund:</p>
          ${listItems}
          <p class="snes-small snes-success" style="margin-top:4px">Total refund: +${totalPts} pts</p>
        </div>
        <div style="display:flex;gap:10px">
          <button class="snes-btn snes-btn-yellow" id="btn-refund-yes" style="flex:1">▶ REFUND ALL</button>
          <button class="snes-btn" id="btn-refund-no" style="flex:1">✕ CANCEL</button>
        </div>
      </div>
    `;
    document.body.appendChild(layer);
    document.getElementById('btn-refund-yes').addEventListener('click', () => { layer.remove(); onConfirm(); });
    document.getElementById('btn-refund-no').addEventListener('click',  () => layer.remove());
  }

  function executeRefund(nodeId) {
    const tree  = nodeId.split('.')[0];
    const level = nodeId.split('.').length - 1;
    const cost  = NODE_COST[`L${level}`];

    // Cascade refund: clear all purchased descendants
    for (const [id, val] of Object.entries(progress.treeState[tree])) {
      if (val === true && id.startsWith(nodeId + '.')) {
        const cl = id.split('.').length - 1;
        progress.unspentSkillPoints += NODE_COST[`L${cl}`];
        progress.treeState[tree][id] = false;
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
    const unspent = progress.unspentSkillPoints ?? 0;
    if (unspent >= 10) {
      showUnspentConfirm(unspent, proceedWithLockIn);
      return;
    }
    proceedWithLockIn();
  }

  function showUnspentConfirm(unspent, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(13,13,26,0.92);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    overlay.innerHTML = `
      <div class="content-card" style="max-width:400px;width:100%;gap:20px">
        <p class="snes-title" style="font-size:10px;text-align:center">UNSPENT POINTS</p>
        <div class="snes-panel">
          <p class="snes-small" style="text-align:center;line-height:2.2">
            You have <span class="snes-highlight">${unspent}</span> unspent skill points.<br>
            Lock in without spending them?
          </p>
        </div>
        <div style="display:flex;gap:12px">
          <button class="snes-btn snes-btn-yellow" id="btn-confirm-lockin" style="flex:1">▶ YES, LOCK IN</button>
          <button class="snes-btn" id="btn-cancel-lockin" style="flex:1">✕ GO BACK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('btn-confirm-lockin').addEventListener('click', () => { overlay.remove(); onConfirm(); });
    document.getElementById('btn-cancel-lockin').addEventListener('click', () => overlay.remove());
  }

  function proceedWithLockIn() {
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

  if (!midSeason) {
    const trophies = loadTrophies(charId);
    if (isSeason1) {
      // T-02: tree selection intro; T-03: skill allocation detail — fire in sequence
      if (!tutorialBeatShown(trophies, 'T-02')) {
        const t02 = JESSIE_TUTORIAL_DIALOGUE['T-02'];
        showJessieDialogue(container, t02.lines, t02.expression, () => {
          markTutorialBeat(trophies, 'T-02');
          saveTrophies(charId, trophies);
          // T-03 immediately after T-02
          if (!tutorialBeatShown(trophies, 'T-03')) {
            const t03 = JESSIE_TUTORIAL_DIALOGUE['T-03'];
            showJessieDialogue(container, t03.lines, t03.expression, () => {
              markTutorialBeat(trophies, 'T-03');
              saveTrophies(charId, trophies);
              render();
            });
          } else {
            render();
          }
        });
        return;
      }
      if (!tutorialBeatShown(trophies, 'T-03')) {
        const t03 = JESSIE_TUTORIAL_DIALOGUE['T-03'];
        showJessieDialogue(container, t03.lines, t03.expression, () => {
          markTutorialBeat(trophies, 'T-03');
          saveTrophies(charId, trophies);
          render();
        });
        return;
      }
    } else {
      // T-14: second tree unlock — fires on Season 2+ pre-season first visit
      if (!tutorialBeatShown(trophies, 'T-14')) {
        const t14 = JESSIE_TUTORIAL_DIALOGUE['T-14'];
        showJessieDialogue(container, t14.lines, t14.expression, () => {
          markTutorialBeat(trophies, 'T-14');
          saveTrophies(charId, trophies);
          render();
        });
        return;
      }
    }
  }
  render();
}
