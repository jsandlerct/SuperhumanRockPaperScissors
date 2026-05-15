import {
  SKILL_TREE_INFO, SKILL_TREE_L2, SKILL_TREE_L3, SKILL_TREE_L4, SKILL_NODE_INFO, NODE_COST,
} from '../constants.js';

const TREES = ['MIND', 'MYSTIC', 'FORTUNE'];

// ── Responsive geometry ───────────────────────────────────────────────────────
// All vertical and size values are computed here, keyed to mobile vs desktop.
// Desktop values are unchanged from before this patch.

const MIN_COL = 56;

function getGeo(container) {
  const raw    = container.clientWidth || window.innerWidth;
  const mobile = window.innerWidth < 768;
  const COL    = Math.max(MIN_COL, Math.floor(raw / 8));
  const CW     = COL * 8;

  // Desktop: LY unchanged. Mobile: tighter spacing to cut ~230px from canvas height.
  const LY = mobile
    ? [12, 100, 185, 262]
    : [20, 170, 330, 450];

  // Per-level node heights
  function nh(level) {
    if (mobile) return level <= 2 ? 68 : level === 3 ? 50 : 76;
    return level <= 2 ? 88 : level === 3 ? 62 : 120;
  }

  // Desktop CH = 450 + 120 + 24 = 594 (unchanged). Mobile = 262 + 76 + 24 = 362.
  const CH = LY[3] + nh(4) + 24;

  return { COL, CW, mobile, LY, nh, CH };
}

// Center-X of a node (geometry unchanged)
function ncx(level, branch, COL, CW) {
  if (level === 1) return CW / 2;
  if (level === 2) return branch === 0 ? 2 * COL : 6 * COL;
  if (level === 3) return (branch * 2 + 1) * COL;
  return (branch + 0.5) * COL;
}

// Per-level node widths (geometry unchanged)
function nw(level, COL, CW) {
  if (level === 1) return Math.round(CW * 0.50);
  if (level === 2) return Math.round(COL * 3.7);
  if (level === 3) return COL * 2 - 10;
  return COL - 10;
}

// All parent → child connections [parentLevel, parentBranch, childLevel, childBranch]
const CONNECTIONS = [
  [1,0, 2,0], [1,0, 2,1],
  [2,0, 3,0], [2,0, 3,1],
  [2,1, 3,2], [2,1, 3,3],
  [3,0, 4,0], [3,0, 4,1],
  [3,1, 4,2], [3,1, 4,3],
  [3,2, 4,4], [3,2, 4,5],
  [3,3, 4,6], [3,3, 4,7],
];

// 15-node descriptor list (all 4 levels real and purchasable)
function getTreeNodes(tree) {
  const info = SKILL_TREE_INFO[tree];
  const l2   = SKILL_TREE_L2[tree];
  const l3   = SKILL_TREE_L3[tree] ?? [];
  const l4   = SKILL_TREE_L4[tree] ?? [];
  return [
    { id: info.rootId,         level: 1, branch: 0 },
    { id: l2[0].id,            level: 2, branch: 0 },
    { id: l2[1].id,            level: 2, branch: 1 },
    { id: l3[0]?.id ?? null,   level: 3, branch: 0 },
    { id: l3[1]?.id ?? null,   level: 3, branch: 1 },
    { id: l3[2]?.id ?? null,   level: 3, branch: 2 },
    { id: l3[3]?.id ?? null,   level: 3, branch: 3 },
    { id: l4[0]?.id ?? null,   level: 4, branch: 0 },
    { id: l4[1]?.id ?? null,   level: 4, branch: 1 },
    { id: l4[2]?.id ?? null,   level: 4, branch: 2 },
    { id: l4[3]?.id ?? null,   level: 4, branch: 3 },
    { id: l4[4]?.id ?? null,   level: 4, branch: 4 },
    { id: l4[5]?.id ?? null,   level: 4, branch: 5 },
    { id: l4[6]?.id ?? null,   level: 4, branch: 6 },
    { id: l4[7]?.id ?? null,   level: 4, branch: 7 },
  ];
}

// Node state: 'purchased' | 'available' | 'locked' | 'future'
function nodeState(nodeId, tree, treeState, { isSeason1, primaryTree, secondaryTree } = {}) {
  if (!nodeId) return 'future';
  if (treeState?.[tree]?.[nodeId] === true) return 'purchased';
  if (isSeason1 && primaryTree && primaryTree !== tree) return 'locked';
  if (!isSeason1 && primaryTree && secondaryTree &&
      tree !== primaryTree && tree !== secondaryTree) return 'locked';
  const level = nodeId.split('.').length - 1;
  if (level === 2 && !treeState?.[tree]?.[`${tree}.1`]) return 'locked';
  if (level === 3 || level === 4) {
    const parentId = nodeId.split('.').slice(0, -1).join('.');
    if (!treeState?.[tree]?.[parentId]) return 'locked';
  }
  return 'available';
}

// ── SVG connector paths ───────────────────────────────────────────────────────
function buildSVGPaths(treeColor, geo) {
  const { COL, CW, LY, nh } = geo;
  return CONNECTIONS.map(([pl, pb, cl, cb]) => {
    const px  = ncx(pl, pb, COL, CW);
    const py  = LY[pl - 1] + nh(pl);
    const chx = ncx(cl, cb, COL, CW);
    const chy = LY[cl - 1];
    const mid = (py + chy) / 2;
    return `<path d="M${px},${py} C${px},${mid} ${chx},${mid} ${chx},${chy}"
              stroke="${treeColor}" stroke-width="2" fill="none" opacity="0.5"/>`;
  }).join('');
}

// ── Node HTML ─────────────────────────────────────────────────────────────────
function buildNode(node, treeName, treeState, selectedId, unspentPoints, opts, geo) {
  const { COL, CW, LY, nh } = geo;
  const { level, branch } = node;
  const nodeW = nw(level, COL, CW);
  const nodeH = nh(level);
  const x   = Math.round(ncx(level, branch, COL, CW) - nodeW / 2);
  const y   = LY[level - 1];
  const st  = nodeState(node.id, treeName, treeState, opts);
  const sel = node.id && node.id === selectedId;

  const info    = node.id ? SKILL_NODE_INFO[node.id] : null;
  const rawName = node.id
    ? (level === 1 ? (info?.rootName ?? SKILL_TREE_INFO[treeName].rootName) : (info?.name ?? '???'))
    : null;
  const cost       = node.id ? NODE_COST[`L${level}`] : null;
  const affordable = cost !== null && unspentPoints >= cost;

  // Font sizes scale with column width; L4 uses smaller sizes to fit long names
  const namePx = level === 4
    ? Math.max(5, Math.round(COL * 0.063))
    : Math.max(7, Math.round(COL * 0.10));
  const costPx = level === 4
    ? Math.max(5, Math.round(COL * 0.063))
    : Math.max(6, Math.round(COL * 0.085));

  let labelHTML = '';
  if (node.id && (level === 1 || level === 2 || level === 3 || level === 4)) {
    const statusStr = st === 'purchased' ? '✓' : `${cost} pts`;
    const statusCls = st === 'purchased' ? 'st-cost--owned'
                    : (!affordable && st === 'available') ? 'st-cost--broke' : '';
    labelHTML = `
      <span class="st-node-name" style="font-size:${namePx}px">${rawName ?? '???'}</span>
      <span class="st-node-cost ${statusCls}" style="font-size:${costPx}px">${statusStr}</span>
    `;
  }

  const stClass   = `st-node--${st}${sel ? ' st-node--selected' : ''}`;
  const treeColor = SKILL_TREE_INFO[treeName].color;

  let extraStyle = '';
  if (st === 'purchased') {
    extraStyle = `border-color:${treeColor};box-shadow:0 0 8px ${treeColor}55,2px 2px 0 var(--snes-shadow);`;
  }
  if (sel) {
    extraStyle += `border-color:var(--snes-yellow);box-shadow:0 0 0 3px var(--snes-yellow),2px 2px 0 var(--snes-shadow);`;
  }

  return `<div class="st-node ${stClass}"
               style="left:${x}px;top:${y}px;width:${nodeW}px;height:${nodeH}px;${extraStyle}"
               ${node.id ? `data-st-node="${node.id}"` : ''}>
            ${labelHTML}
          </div>`;
}

// ── Detail panel ──────────────────────────────────────────────────────────────
// On mobile the panel is rendered as a fixed bottom sheet so it is always
// reachable without scrolling past the full-height tree canvas.
function buildDetailPanel(selectedId, treeName, treeState, unspentPoints, opts, mobile) {
  if (!selectedId) return '';
  const { readOnly, canRefund } = opts;
  const treeInfo   = SKILL_TREE_INFO[treeName];
  const st         = nodeState(selectedId, treeName, treeState, opts);
  const level      = selectedId.split('.').length - 1;
  const cost       = NODE_COST[`L${level}`];
  const info       = SKILL_NODE_INFO[selectedId];
  const name       = level === 1 ? (info?.rootName ?? treeInfo.rootName) : (info?.name ?? '???');
  const effect     = level === 1 ? (info?.rootEffect ?? treeInfo.rootEffect) : (info?.effect ?? '');
  const kind       = info?.kind ?? 'passive';
  const affordable = unspentPoints >= cost;

  const kindBadge = kind === 'active' ? '⚡ ACTIVE' : '◉ PASSIVE';

  let actionHTML = '';
  if (!readOnly) {
    if (st === 'purchased' && canRefund) {
      actionHTML = `<button class="snes-btn" data-detail-refund="${selectedId}"
                            style="font-size:8px;padding:10px 20px">
                      ↺ REFUND (${cost} PTS)
                    </button>`;
    } else if (st === 'available') {
      actionHTML = `<button class="snes-btn${affordable ? ' snes-btn-yellow' : ''}"
                            data-detail-buy="${selectedId}"
                            style="font-size:8px;padding:10px 20px"
                            ${affordable ? '' : 'disabled'}>
                      ${affordable ? `▶ BUY (${cost} PTS)` : `✗ NEED ${cost} PTS`}
                    </button>`;
    } else if (st === 'locked') {
      const reason = level === 2 ? 'Requires L1 root node'
                   : level === 3 ? 'Requires L2 parent node'
                   : level === 4 ? 'Requires L3 parent node'
                   : 'Tree locked this season';
      actionHTML = `<p class="snes-small snes-muted" style="font-size:7px">🔒 ${reason}</p>`;
    }
  }

  const mobileSheetStyle = mobile
    ? `position:fixed;bottom:0;left:0;right:0;z-index:200;max-height:60vh;overflow-y:auto;`
    : '';

  return `
    <div class="st-detail${mobile ? ' st-detail--mobile-sheet' : ''}"
         style="border-top:3px solid ${treeInfo.color};${mobileSheetStyle}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px">
        <div style="flex:1;min-width:0">
          <p class="snes-label snes-highlight" style="font-size:11px;line-height:1.6">${name.toUpperCase()}</p>
          <p class="snes-small snes-muted" style="font-size:7px;margin-top:6px">
            L${level} · ${kindBadge} · ${cost} PTS
          </p>
        </div>
        <button class="snes-btn" id="btn-st-close" style="font-size:7px;padding:8px 12px;flex-shrink:0">✕ CLOSE</button>
      </div>
      <p class="snes-small" style="font-size:7px;line-height:2.2;margin-bottom:14px">${effect}</p>
      ${actionHTML}
    </div>
  `;
}

// ── Main mount ────────────────────────────────────────────────────────────────
export function mount(container, options = {}) {
  const {
    treeState      = {},
    unspentPoints  = 0,
    readOnly       = false,
    isSeason1      = true,
    primaryTree    = null,
    secondaryTree  = null,
    canRefund      = false,
    activeTreeIdx  = 0,
    selectedNodeId = null,
    onTreeChange   = () => {},
    onNodeSelect   = () => {},
    onBuy          = () => {},
    onRefund       = () => {},
  } = options;

  const geo       = getGeo(container);
  const { COL, CW, mobile, LY, nh, CH } = geo;

  const treeName  = TREES[activeTreeIdx];
  const treeInfo  = SKILL_TREE_INFO[treeName];
  const nodes     = getTreeNodes(treeName);
  const stateOpts = { isSeason1, primaryTree, secondaryTree };

  const prevIdx  = (activeTreeIdx + 2) % 3;
  const nextIdx  = (activeTreeIdx + 1) % 3;
  const prevName = TREES[prevIdx];
  const nextName = TREES[nextIdx];

  const purchasedCount = Object.values(treeState[treeName] ?? {}).filter(Boolean).length;
  const navBadge = purchasedCount > 0 ? ` (${purchasedCount})` : '';

  const svgPaths  = buildSVGPaths(treeInfo.color, geo);
  const nodesHTML = nodes.map(n =>
    buildNode(n, treeName, treeState, selectedNodeId, unspentPoints,
              { ...stateOpts, readOnly, canRefund }, geo)
  ).join('');
  const detailHTML = buildDetailPanel(selectedNodeId, treeName, treeState, unspentPoints,
    { readOnly, canRefund, ...stateOpts }, mobile);

  // Nav font scale
  const navNamePx = Math.max(9, Math.round(COL * 0.13));
  const navBtnPx  = Math.max(6, Math.round(COL * 0.085));

  const ptsBar = readOnly ? '' : `
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;
                padding:10px 16px;background:var(--snes-panel-dark);border-bottom:2px solid var(--snes-border)">
      <p class="snes-small snes-muted" style="font-size:8px">UNSPENT SKILL POINTS:</p>
      <p class="snes-label snes-highlight" style="font-size:14px">${unspentPoints}</p>
    </div>
  `;

  // On mobile: detail panel is a fixed bottom sheet rendered outside .st-panel so it
  // overlays the tree canvas without being clipped by any ancestor overflow.
  // On desktop: detail panel sits inline below the canvas as before.
  container.innerHTML = `
    <div class="st-panel">

      <!-- Navigator -->
      <div class="st-nav">
        <button class="snes-btn st-nav-btn" data-tree-nav="${prevIdx}"
                style="font-size:${navBtnPx}px !important">◀ ${prevName}</button>
        <div style="text-align:center;flex:1">
          <p class="snes-label" style="color:${treeInfo.color};font-size:${navNamePx}px">${treeName}${navBadge}</p>
          <p class="snes-small snes-muted" style="font-size:7px;margin-top:4px">"${treeInfo.theme}"</p>
        </div>
        <button class="snes-btn st-nav-btn" data-tree-nav="${nextIdx}"
                style="font-size:${navBtnPx}px !important">${nextName} ▶</button>
      </div>

      ${ptsBar}

      <!-- Tree canvas -->
      <div class="st-canvas-wrap">
        <div style="position:relative;width:${CW}px;height:${CH}px">
          <svg width="${CW}" height="${CH}"
               style="position:absolute;top:0;left:0;pointer-events:none;overflow:visible">
            ${svgPaths}
          </svg>
          ${nodesHTML}
        </div>
      </div>

      ${!mobile ? detailHTML : ''}

    </div>
    ${mobile && selectedNodeId ? `<div class="st-detail-scrim" id="btn-st-scrim"></div>${detailHTML}` : ''}
  `;

  // Listeners
  container.querySelectorAll('[data-tree-nav]').forEach(btn => {
    btn.addEventListener('click', () => onTreeChange(parseInt(btn.dataset.treeNav, 10)));
  });
  container.querySelectorAll('[data-st-node]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.stNode;
      onNodeSelect(id === selectedNodeId ? null : id);
    });
  });
  document.getElementById('btn-st-close')?.addEventListener('click', () => onNodeSelect(null));
  document.getElementById('btn-st-scrim')?.addEventListener('click', () => onNodeSelect(null));
  container.querySelectorAll('[data-detail-buy]').forEach(btn => {
    btn.addEventListener('click', () => onBuy(btn.dataset.detailBuy));
  });
  container.querySelectorAll('[data-detail-refund]').forEach(btn => {
    btn.addEventListener('click', () => onRefund(btn.dataset.detailRefund));
  });

  // On desktop the detail panel is inline — scroll it into view if it's off-screen
  if (selectedNodeId && !mobile) {
    const detailEl = container.querySelector('.st-detail');
    if (detailEl) detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── Full-screen read-only overlay (for HUD) ───────────────────────────────────
export function openFullScreenTree(charId, loadProgressFn, loadIdentityFn) {
  const existing = document.getElementById('st-fs-overlay');
  if (existing) { existing.remove(); return; }

  const progress = loadProgressFn(charId);
  const identity = loadIdentityFn(charId);
  const treeState     = progress?.treeState ?? {};
  const unspent       = progress?.unspentSkillPoints ?? 0;
  const isSeason1     = (progress?.currentSeason ?? 1) === 1;
  const primaryTree   = identity?.primaryTree   ?? null;
  const secondaryTree = identity?.secondaryTree ?? null;

  const overlay = document.createElement('div');
  overlay.id = 'st-fs-overlay';
  overlay.className = 'st-fs-overlay';
  document.body.appendChild(overlay);

  let treeIdx  = 0;
  let selected = null;

  function remount() {
    const panelDiv = overlay.querySelector('#st-fs-panel') ?? (() => {
      overlay.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:12px 20px;background:var(--snes-panel);border-bottom:3px solid var(--snes-border)">
          <p class="snes-title" style="font-size:11px">SKILL TREES</p>
          <button class="snes-btn" id="btn-st-fs-close" style="font-size:8px;padding:8px 14px">✕ CLOSE</button>
        </div>
        <div id="st-fs-panel" style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:0"></div>
      `;
      document.getElementById('btn-st-fs-close').addEventListener('click', () => overlay.remove());
      return overlay.querySelector('#st-fs-panel');
    })();

    mount(panelDiv, {
      treeState, unspentPoints: unspent, readOnly: true,
      isSeason1, primaryTree, secondaryTree,
      activeTreeIdx: treeIdx, selectedNodeId: selected,
      onTreeChange: (i) => { treeIdx = i; selected = null; remount(); },
      onNodeSelect: (id) => { selected = id; remount(); },
    });
  }

  remount();
}
