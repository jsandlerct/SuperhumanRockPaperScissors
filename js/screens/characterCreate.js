import { navigate } from '../main.js';
import { ELO_BASELINE } from '../constants.js';
import {
  loadSession, saveSession,
  loadAccount, saveAccount,
  saveIdentity, saveProgress, saveStats, saveTrophies,
} from '../storage.js';

// All 50 portraits: male_1–25, then female_1–25
const ALL_PORTRAITS = [
  ...Array.from({ length: 25 }, (_, i) => `male_${i + 1}`),
  ...Array.from({ length: 25 }, (_, i) => `female_${i + 1}`),
];

function generateCharId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return 'char_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function mount(container, options = {}) {
  let selectedPortrait = ALL_PORTRAITS[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  function render() {
    const gridItems = ALL_PORTRAITS.map(id => {
      const sel = id === selectedPortrait;
      return `
        <div
          class="portrait-thumb${sel ? ' portrait-thumb--selected' : ''}"
          data-portrait="${id}"
          style="
            cursor: pointer;
            border: 3px solid ${sel ? 'var(--snes-yellow)' : 'var(--snes-border)'};
            box-shadow: ${sel
              ? 'inset 0 0 0 2px var(--snes-yellow), 2px 2px 0 #000'
              : 'inset 0 0 0 2px var(--snes-border), 2px 2px 0 #000'};
            background: var(--snes-black);
            aspect-ratio: 1;
            overflow: hidden;
            image-rendering: pixelated;
          "
        >
          <img
            src="assets/portraits/${id}.png"
            alt="${id}"
            style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block"
            draggable="false"
          >
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="screen fade-in" style="gap:16px">
        <p class="snes-title" style="text-align:center">CREATE CHARACTER</p>

        <!-- Name input -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
          <label class="snes-small snes-muted" for="inp-name">YOUR NAME</label>
          <input
            class="snes-input"
            id="inp-name"
            type="text"
            maxlength="16"
            autocomplete="off"
            spellcheck="false"
            placeholder="UP TO 16 CHARS"
            value=""
          >
        </div>

        <!-- Portrait section -->
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;align-items:center;gap:16px">
            <!-- Selected portrait preview -->
            <div style="
              width:80px;height:80px;flex-shrink:0;
              border:3px solid var(--snes-yellow);
              box-shadow:inset 0 0 0 2px var(--snes-yellow),3px 3px 0 #000;
              background:var(--snes-black);
              overflow:hidden;image-rendering:pixelated;
            ">
              <img
                id="portrait-preview"
                src="assets/portraits/${selectedPortrait}.png"
                alt="selected"
                style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block"
                draggable="false"
              >
            </div>
            <div>
              <p class="snes-small snes-highlight">CHOOSE PORTRAIT</p>
              <p class="snes-small snes-muted" style="margin-top:6px" id="portrait-label">
                ${selectedPortrait.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>

          <!-- Scrollable portrait grid -->
          <div class="portrait-grid-scroll">
            <div id="portrait-grid" class="portrait-grid">
              ${gridItems}
            </div>
          </div>
        </div>

        <!-- Error message -->
        <p class="snes-label snes-error" id="create-error" style="display:none;text-align:center"></p>

        <!-- Confirm button -->
        <button class="snes-btn snes-btn-yellow" id="btn-confirm" style="width:100%">
          ▶ LOCK IN
        </button>
      </div>
    `;

    attachListeners();
  }

  // ── Listeners ───────────────────────────────────────────────────────────────

  function attachListeners() {
    // Portrait grid — event delegation
    document.getElementById('portrait-grid').addEventListener('click', e => {
      const thumb = e.target.closest('[data-portrait]');
      if (!thumb) return;
      selectedPortrait = thumb.dataset.portrait;

      // Update preview
      document.getElementById('portrait-preview').src =
        `assets/portraits/${selectedPortrait}.png`;
      document.getElementById('portrait-label').textContent =
        selectedPortrait.replace('_', ' ').toUpperCase();

      // Update grid selection styles without full re-render
      document.querySelectorAll('[data-portrait]').forEach(el => {
        const sel = el.dataset.portrait === selectedPortrait;
        el.style.border = `3px solid ${sel ? 'var(--snes-yellow)' : 'var(--snes-border)'}`;
        el.style.boxShadow = sel
          ? 'inset 0 0 0 2px var(--snes-yellow), 2px 2px 0 #000'
          : 'inset 0 0 0 2px var(--snes-border), 2px 2px 0 #000';
      });
    });

    document.getElementById('inp-name').focus();
    document.getElementById('btn-confirm').addEventListener('click', handleConfirm);
    document.getElementById('inp-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleConfirm();
    });
  }

  // ── Confirm ──────────────────────────────────────────────────────────────────

  function handleConfirm() {
    const errorEl = document.getElementById('create-error');
    const name    = document.getElementById('inp-name').value.trim();

    if (!name) {
      errorEl.textContent = 'ENTER YOUR NAME';
      errorEl.style.display = 'block';
      document.getElementById('inp-name').focus();
      return;
    }

    const session  = loadSession();
    const username = session.loggedInUsername;
    const charId   = generateCharId();

    // Write _identity
    saveIdentity(charId, {
      charId,
      name,
      portraitId:    selectedPortrait,
      primaryTree:   null,
      secondaryTree: null,
      createdAt:     Date.now(),
    });

    // Write _progress — phase=active_season (v0.1: skip skill tree selection)
    saveProgress(charId, {
      charId,
      currentSeason:          1,
      phase:                  'active_season',
      currentElo:             ELO_BASELINE,
      peakElo:                ELO_BASELINE,
      worldRank:              null,
      unspentSkillPoints:     0,
      totalSkillPointsEarned: 0,
      treeState:              {},
      crossMatchState:        { neuralScanMatchesSinceLastUse: 0 },
      powerupInventory:       [],
    });

    // Write _stats (all zeros)
    saveStats(charId, {
      career: {
        rock: 0, paper: 0, scissors: 0,
        rockWins: 0, paperWins: 0, scissorsWins: 0,
        totalMatches: 0, matchWins: 0, matchLosses: 0,
        tournamentsEntered: 0, tournamentsWon: 0,
        runnerUpFinishes: 0, deepestTournamentReached: 0,
      },
      season: {
        rock: 0, paper: 0, scissors: 0,
        rockWins: 0, paperWins: 0, scissorsWins: 0,
      },
    });

    // Write _trophies
    saveTrophies(charId, {
      hofStatus:                  false,
      hofInductionSeason:         null,
      seasonEloHistory:           [],
      trophies:                   [],
      jessieOneShots:             [],
      jessieSeasonCheckInHistory: [],
    });

    // Add charId to account
    const account = loadAccount(username);
    account.characterIds.push(charId);
    saveAccount(username, account);

    // Update session
    saveSession({ loggedInUsername: username, activeCharId: charId });

    navigate('tournament', { charId });
  }

  // ── Go ───────────────────────────────────────────────────────────────────────

  render();
}
