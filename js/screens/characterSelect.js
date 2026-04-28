import { navigate, routeByPhase } from '../main.js';
import { MAX_CHARACTERS_PER_ACCOUNT } from '../constants.js';
import {
  loadAccount, saveSession, clearSession,
  loadIdentity, loadProgress,
} from '../storage.js';

const PHASE_LABEL = {
  pre_season:    'PRE-SEASON',
  active_season: 'IN SEASON',
  off_season:    'OFF-SEASON',
  complete:      'CAREER COMPLETE',
};

export function mount(container, options = {}) {
  const username = options.username;
  const account  = loadAccount(username);

  // Build slot data: always exactly MAX_CHARACTERS_PER_ACCOUNT slots
  const slots = Array.from({ length: MAX_CHARACTERS_PER_ACCOUNT }, (_, i) => {
    const charId = account.characterIds[i] ?? null;
    if (!charId) return { empty: true, index: i };

    const identity = loadIdentity(charId);
    const progress = loadProgress(charId);
    return {
      empty:     false,
      index:     i,
      charId,
      name:      identity?.name ?? '???',
      portraitId: identity?.portraitId ?? 'male_1',
      elo:       progress?.currentElo ?? 0,
      season:    progress?.currentSeason ?? 1,
      phase:     progress?.phase ?? 'active_season',
    };
  });

  const canCreateNew = account.characterIds.length < MAX_CHARACTERS_PER_ACCOUNT;

  // ── Render ──────────────────────────────────────────────────────────────────

  function renderSlot(slot) {
    if (slot.empty) {
      if (!canCreateNew) {
        // All slots filled — this shouldn't render but guard anyway
        return '';
      }
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
            data-index="${slot.index}"
            style="flex-shrink:0;font-size:6px;padding:8px 10px"
          >+ NEW</button>
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
        <button
          class="snes-btn snes-btn-yellow"
          data-action="continue"
          data-charid="${slot.charId}"
          style="flex-shrink:0;font-size:6px;padding:8px 10px"
        >▶ PLAY</button>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="screen fade-in" style="gap:16px">
      <div style="text-align:center">
        <p class="snes-title">SRPS</p>
        <p class="snes-small snes-highlight" style="margin-top:6px">
          ${username.toUpperCase()}
        </p>
      </div>

      <hr class="snes-divider">

      <p class="snes-small snes-muted">SELECT CHARACTER</p>

      ${slots.map(renderSlot).join('')}

      <hr class="snes-divider">

      <button class="snes-btn" id="btn-logout" style="width:100%;opacity:0.6">
        ← LOG OUT
      </button>
    </div>
  `;

  // ── Listeners ───────────────────────────────────────────────────────────────

  container.querySelectorAll('[data-action="continue"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const charId = btn.dataset.charid;
      saveSession({ loggedInUsername: username, activeCharId: charId });
      routeByPhase(charId);
    });
  });

  container.querySelectorAll('[data-action="create"]').forEach(btn => {
    btn.addEventListener('click', () => {
      saveSession({ loggedInUsername: username, activeCharId: null });
      navigate('create');
    });
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    clearSession();
    navigate('login');
  });
}
