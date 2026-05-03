import { navigate, routeByPhase } from '../main.js';
import { MAX_CHARACTERS_PER_ACCOUNT } from '../constants.js';
import {
  loadAccount, saveAccount, saveSession, clearSession,
  loadIdentity, loadProgress, deleteCharacterData,
} from '../storage.js';

const PHASE_LABEL = {
  pre_season:    'PRE-SEASON',
  active_season: 'IN SEASON',
  off_season:    'OFF-SEASON',
  complete:      'CAREER COMPLETE',
};

export function mount(container, options = {}) {
  const username = options.username;

  // Two-stage delete confirmation: { charId, stage: 1|2 } or null
  let deleteConfirm = null;

  function getSlots() {
    const account = loadAccount(username);
    return Array.from({ length: MAX_CHARACTERS_PER_ACCOUNT }, (_, i) => {
      const charId = account.characterIds[i] ?? null;
      if (!charId) return { empty: true, index: i };
      const identity = loadIdentity(charId);
      const progress = loadProgress(charId);
      return {
        empty:      false,
        index:      i,
        charId,
        name:       identity?.name ?? '???',
        portraitId: identity?.portraitId ?? 'male_1',
        elo:        progress?.currentElo ?? 0,
        season:     progress?.currentSeason ?? 1,
        phase:      progress?.phase ?? 'active_season',
      };
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  function render() {
    const account    = loadAccount(username);
    const slots      = getSlots();
    const canCreate  = account.characterIds.length < MAX_CHARACTERS_PER_ACCOUNT;

    container.innerHTML = `
      <div class="screen fade-in" style="justify-content:center">
        <div class="content-card--lg">
          <div style="text-align:center">
            <p class="snes-title">SRPS</p>
            <p class="snes-small snes-highlight" style="margin-top:6px">
              ${username.toUpperCase()}
            </p>
          </div>

          <hr class="snes-divider">

          <p class="snes-small snes-muted">SELECT CHARACTER</p>

          <div class="char-slots-grid">
            ${slots.map(s => renderSlot(s, canCreate)).join('')}
          </div>

          <hr class="snes-divider">

          <button class="snes-btn" id="btn-logout" style="width:100%;opacity:0.6">
            ← LOG OUT
          </button>
        </div>
      </div>
    `;

    attachListeners(slots);
  }

  function renderSlot(slot, canCreate) {
    if (slot.empty) {
      if (!canCreate) return '';
      return `
        <div class="snes-panel" style="
          display:flex;align-items:center;gap:14px;
          border-color:var(--snes-border);opacity:0.6;
        ">
          <div class="portrait-frame portrait-frame--md" style="
            border-color:var(--snes-border);opacity:0.4;
            display:flex;align-items:center;justify-content:center;
          ">
            <span class="snes-label" style="font-size:20px;opacity:0.5">?</span>
          </div>
          <div style="flex:1">
            <p class="snes-small snes-muted">SLOT ${slot.index + 1}</p>
            <p class="snes-label snes-muted" style="margin-top:4px">— EMPTY —</p>
          </div>
          <button
            class="snes-btn"
            data-action="create"
            style="flex-shrink:0;font-size:6px;padding:8px 10px"
          >+ NEW</button>
        </div>
      `;
    }

    const isConfirming = deleteConfirm?.charId === slot.charId;

    if (isConfirming && deleteConfirm.stage === 1) {
      return `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px;
             border-color:var(--snes-error)">
          <p class="snes-small snes-error">DELETE ${slot.name.toUpperCase()}?</p>
          <p class="snes-small snes-muted">This character and all their data will be removed.</p>
          <div style="display:flex;gap:8px">
            <button class="snes-btn snes-btn-yellow" data-action="delete-stage2"
                    data-charid="${slot.charId}" style="flex:1;font-size:6px;padding:8px">
              YES, DELETE
            </button>
            <button class="snes-btn" data-action="delete-cancel"
                    style="flex:1;font-size:6px;padding:8px">
              CANCEL
            </button>
          </div>
        </div>
      `;
    }

    if (isConfirming && deleteConfirm.stage === 2) {
      return `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:10px;
             border-color:var(--snes-error)">
          <p class="snes-small snes-error">⚠ PERMANENT DELETION</p>
          <p class="snes-small snes-muted">
            Are you absolutely sure? This cannot be undone.
            ${slot.name.toUpperCase()} will be gone forever.
          </p>
          <div style="display:flex;gap:8px">
            <button class="snes-btn" style="flex:1;font-size:5px;padding:8px;color:var(--snes-error)"
                    data-action="delete-confirm" data-charid="${slot.charId}">
              YES, DELETE PERMANENTLY
            </button>
            <button class="snes-btn" data-action="delete-cancel"
                    style="flex:1;font-size:6px;padding:8px">
              CANCEL
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="snes-panel" style="display:flex;align-items:center;gap:14px">
        <div class="portrait-frame portrait-frame--md">
          <img src="assets/portraits/${slot.portraitId}.png" alt="">
        </div>
        <div style="flex:1;min-width:0">
          <p class="snes-small snes-muted">SLOT ${slot.index + 1}</p>
          <p class="snes-label snes-highlight" style="margin-top:4px;word-break:break-all">
            ${slot.name.toUpperCase()}
          </p>
          <p class="snes-small snes-muted" style="margin-top:6px">
            SEASON ${slot.season} &nbsp;·&nbsp; ${PHASE_LABEL[slot.phase] ?? slot.phase}
          </p>
          <p class="snes-small" style="margin-top:2px">
            ELO <span class="snes-highlight">${slot.elo}</span>
          </p>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="snes-btn snes-btn-yellow" data-action="continue"
                  data-charid="${slot.charId}" style="font-size:6px;padding:8px 10px">
            ▶ PLAY
          </button>
          <button class="snes-btn" data-action="stats"
                  data-charid="${slot.charId}" style="font-size:6px;padding:8px 10px;opacity:0.8">
            📊 STATS
          </button>
          <button class="snes-btn" data-action="delete-stage1"
                  data-charid="${slot.charId}" style="font-size:6px;padding:8px 10px;opacity:0.7;color:var(--snes-error)">
            ✗ DELETE
          </button>
        </div>
      </div>
    `;
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  function attachListeners(slots) {
    container.querySelectorAll('[data-action="continue"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const charId = btn.dataset.charid;
        saveSession({ loggedInUsername: username, activeCharId: charId });
        routeByPhase(charId);
      });
    });

    container.querySelectorAll('[data-action="stats"]').forEach(btn => {
      btn.addEventListener('click', () => {
        navigate('careerSummary', { charId: btn.dataset.charid, username });
      });
    });

    container.querySelectorAll('[data-action="create"]').forEach(btn => {
      btn.addEventListener('click', () => {
        saveSession({ loggedInUsername: username, activeCharId: null });
        navigate('create');
      });
    });

    container.querySelectorAll('[data-action="delete-stage1"]').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteConfirm = { charId: btn.dataset.charid, stage: 1 };
        render();
      });
    });

    container.querySelectorAll('[data-action="delete-stage2"]').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteConfirm = { charId: btn.dataset.charid, stage: 2 };
        render();
      });
    });

    container.querySelectorAll('[data-action="delete-cancel"]').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteConfirm = null;
        render();
      });
    });

    container.querySelectorAll('[data-action="delete-confirm"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const charId = btn.dataset.charid;
        const account = loadAccount(username);
        account.characterIds = account.characterIds.filter(id => id !== charId);
        saveAccount(username, account);
        deleteCharacterData(charId);
        deleteConfirm = null;
        render();
      });
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      clearSession();
      navigate('login');
    });
  }

  render();
}
