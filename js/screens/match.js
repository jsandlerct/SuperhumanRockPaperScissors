import { navigate, getNpcById, getAllNpcs } from '../main.js';
import { resolveRound } from '../systems/round.js';
import { initNpcMatchState, getNpcThrow, recordPlayerThrow } from '../systems/npc.js';
import { calcNewElo } from '../systems/elo.js';
import { calcDropCount, generateDrops, getMaxSlots } from '../systems/powerupEngine.js';
import { computeMidSeasonRank } from '../systems/seasonEngine.js';
import {
  ROUNDS_TO_WIN_MATCH, ROUNDS_TO_WIN_MATCH_FINALS,
  POWERUP_ICONS, POWERUP_DESCRIPTIONS, TOTAL_PLAYERS,
} from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
  loadStats, saveStats, loadTournament, saveTournament, loadWorld,
} from '../storage.js';

const THROW_NAME = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
const ROUND_WIN   = '■';
const ROUND_EMPTY = '□';

function scoreBar(won, target) {
  return Array.from({ length: target }, (_, i) =>
    `<span style="color:${i < won ? 'var(--snes-yellow)' : 'var(--snes-border)'}">${i < won ? ROUND_WIN : ROUND_EMPTY}</span>`
  ).join(' ');
}

export function mount(container, options = {}) {
  const session  = loadSession();
  const charId   = options.charId ?? session?.activeCharId;
  const identity = loadIdentity(charId);
  let   progress = loadProgress(charId);

  const tournamentData  = loadTournament(charId);
  const cm              = tournamentData.currentMatch;
  const npc             = getNpcById(cm.opponentId);
  const roundsToWin     = cm.matchType === 'finals' ? ROUNDS_TO_WIN_MATCH_FINALS : ROUNDS_TO_WIN_MATCH;

  // ── In-memory match state ────────────────────────────────────────────────────
  let playerRoundsWon   = 0;
  let opponentRoundsWon = 0;
  let roundNumber       = 1;

  // Phase flow: picking → gut_check → revealing → drop_result? → overflow_prompt? → next round
  let screenState       = 'picking';

  // Per-round state (reset each round)
  let currentThrow        = null;
  let pendingOpponentThrow = null;
  let changedMyMindUsed    = false;

  // Post-reveal drop state
  let earnedDrops    = [];
  let resolvedDrops  = [];
  let overflowDrop   = null;

  // Revealing state
  let lastPlayerThrow   = null;
  let lastOpponentThrow = null;
  let lastRoundResult   = null;

  // Popup state — which powerup detail card is open (or null)
  let popupPowerup = null;

  const npcMatchState = initNpcMatchState(npc);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getInventory() {
    return progress.powerupInventory ?? [];
  }

  function saveInventory(inv) {
    progress.powerupInventory = inv;
    saveProgress(charId, progress);
  }

  function consumeFirstCMM() {
    const inv = getInventory();
    const idx = inv.findIndex(p => p.name === 'Changed My Mind');
    if (idx === -1) return false;
    inv.splice(idx, 1);
    saveInventory(inv);
    return true;
  }

  // ── Powerup tray (always rendered in left panel) ──────────────────────────────

  function renderTray(inventory, maxSlots) {
    const slots = [];

    for (let i = 0; i < maxSlots; i++) {
      const pu      = inventory[i] ?? null;
      const iconSrc = pu ? (POWERUP_ICONS[pu.name] ?? '') : '';

      if (pu) {
        const scopeLabel = pu.scope ? `(${pu.scope.toLowerCase()})` : '';
        const nameShort  = pu.name.length > 16 ? pu.name.slice(0, 15) + '…' : pu.name;
        slots.push(`
          <div class="pu-slot pu-slot--filled" data-inspect="${pu.instanceId}" title="${pu.name}">
            <div class="pu-slot-icon">
              ${iconSrc
                ? `<img src="${iconSrc}" alt="${pu.name}" draggable="false">`
                : `<span class="snes-small snes-muted" style="font-size:5px">?</span>`}
            </div>
            <p class="pu-slot-name">${nameShort}</p>
            <p class="pu-slot-scope">${scopeLabel}</p>
          </div>
        `);
      } else {
        slots.push(`<div class="pu-slot pu-slot--empty"></div>`);
      }
    }

    return `
      <div style="display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <p class="snes-small snes-muted" style="font-size:6px">POWERUPS</p>
          <p class="snes-small snes-muted" style="font-size:5px">${inventory.length}/${maxSlots}</p>
        </div>
        <div class="pu-tray">
          ${slots.join('')}
        </div>
      </div>
    `;
  }

  // ── Popup detail card ─────────────────────────────────────────────────────────

  function renderPopup(pu) {
    const iconSrc    = POWERUP_ICONS[pu.name] ?? '';
    const desc       = POWERUP_DESCRIPTIONS[pu.name] ?? 'Description coming in a future update.';
    const canUse     = screenState === 'gut_check'
                       && pu.name === 'Changed My Mind'
                       && !changedMyMindUsed;
    const useLabel   = canUse ? '▶ USE' : '— USE';
    const useNote    = screenState !== 'gut_check' ? 'Usable during Gut Check only' : '';

    return `
      <div id="pu-popup-backdrop"></div>
      <div id="pu-popup">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          ${iconSrc
            ? `<img src="${iconSrc}" alt="${pu.name}"
                 style="width:48px;height:48px;image-rendering:pixelated;object-fit:contain;flex-shrink:0">`
            : ''}
          <div style="flex:1;min-width:0">
            <p class="snes-label snes-highlight" style="font-size:8px;line-height:1.5">${pu.name.toUpperCase()}</p>
            <p class="snes-small snes-muted" style="font-size:5px;margin-top:4px">
              ${pu.tier.toUpperCase()} · ${(pu.scope ?? '').toUpperCase()}
            </p>
          </div>
        </div>
        <p class="snes-small" style="font-size:6px;line-height:2;margin-bottom:14px">${desc}</p>
        ${useNote
          ? `<p class="snes-small snes-muted" style="font-size:5px;text-align:center;margin-bottom:8px">${useNote}</p>`
          : ''}
        <div style="display:flex;gap:8px">
          <button class="snes-btn${canUse ? ' snes-btn-yellow' : ''}" id="btn-popup-use"
                  style="flex:1;font-size:7px${canUse ? '' : ';opacity:0.4;cursor:not-allowed'}"
                  ${canUse ? '' : 'disabled'}>
            ${useLabel}
          </button>
          <button class="snes-btn" id="btn-popup-close" style="flex:1;font-size:7px">
            ✕ CLOSE
          </button>
        </div>
      </div>
    `;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  function render() {
    const playerName     = identity?.name?.toUpperCase() ?? 'YOU';
    const playerPortrait = identity?.portraitId ?? 'male_1';
    const npcPortrait    = npc.portraitId;
    const npcName        = npc.name.toUpperCase();
    const inventory      = getInventory();
    const maxSlots       = getMaxSlots(progress.treeState);

    let bodyHTML = '';

    if (screenState === 'picking') {
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} ──</p>
        <p class="snes-small snes-muted" style="text-align:center">CHOOSE YOUR THROW</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <button class="throw-btn" data-throw="rock">
            <img src="assets/hands/rock.png" alt="Rock" draggable="false">
            <span>ROCK</span>
          </button>
          <button class="throw-btn" data-throw="paper">
            <img src="assets/hands/paper.png" alt="Paper" draggable="false">
            <span>PAPER</span>
          </button>
          <button class="throw-btn" data-throw="scissors">
            <img src="assets/hands/scissors.png" alt="Scissors" draggable="false">
            <span>SCISSORS</span>
          </button>
        </div>
      `;
    } else if (screenState === 'gut_check') {
      const throwChangeHTML = changedMyMindUsed ? `
        <p class="snes-small snes-highlight" style="text-align:center;margin-top:4px">CHANGE YOUR THROW</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px">
          ${['rock','paper','scissors'].map(t => `
            <button class="throw-btn${currentThrow === t ? ' throw-btn--selected' : ''}" data-change="${t}">
              <img src="assets/hands/${t}.png" alt="${t}" draggable="false">
              <span>${THROW_NAME[t]}</span>
            </button>
          `).join('')}
        </div>
      ` : '';

      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} · GUT CHECK ──</p>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <p class="snes-small snes-muted" style="font-size:5px">THROWING</p>
            <p class="snes-small snes-highlight">${THROW_NAME[currentThrow]}</p>
          </div>
          <button class="snes-btn snes-btn-yellow" id="btn-ready">▶ READY</button>
        </div>
        ${throwChangeHTML}
        <p class="snes-small snes-muted" style="font-size:5px;text-align:center">[SKILL PHASE V0.3]</p>
        <p class="snes-small snes-muted" style="font-size:5px;text-align:center">Tap a powerup to inspect or use it</p>
      `;
    } else if (screenState === 'revealing') {
      const resultMsg   = lastRoundResult === 'player'   ? 'YOU WIN THIS ROUND!'
                        : lastRoundResult === 'opponent' ? 'YOU LOSE THIS ROUND.'
                        : 'TIE!';
      const resultColor = lastRoundResult === 'player'   ? 'snes-success'
                        : lastRoundResult === 'opponent' ? 'snes-error'
                        : 'snes-highlight';
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} ──</p>
        <div class="snes-panel">
          <div class="throw-reveal">
            <div class="throw-reveal-side">
              <img src="assets/hands/${lastPlayerThrow}.png" alt="${lastPlayerThrow}" draggable="false">
              <p class="snes-small snes-highlight">YOU</p>
              <p class="snes-small">${THROW_NAME[lastPlayerThrow]}</p>
            </div>
            <p class="snes-label" style="flex-shrink:0">VS</p>
            <div class="throw-reveal-side throw-reveal-side--flip">
              <img src="assets/hands/${lastOpponentThrow}.png" alt="${lastOpponentThrow}" draggable="false">
              <p class="snes-small snes-muted">THEM</p>
              <p class="snes-small">${THROW_NAME[lastOpponentThrow]}</p>
            </div>
          </div>
        </div>
        <p class="snes-label ${resultColor}" style="text-align:center">${resultMsg}</p>
        <button class="snes-btn snes-btn-yellow" id="btn-next" style="width:100%">▶ NEXT</button>
      `;
    } else if (screenState === 'drop_result') {
      const dropListHTML = resolvedDrops.map(d => {
        const icon = POWERUP_ICONS[d.name] ?? '';
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
            ${icon ? `<img src="${icon}" alt="" style="width:32px;height:32px;image-rendering:pixelated;object-fit:contain">` : ''}
            <div>
              <p class="snes-small snes-highlight">${d.name.toUpperCase()}</p>
              <p class="snes-small snes-muted" style="font-size:5px">${d.tier.toUpperCase()} · ${d.scope.toUpperCase()}</p>
            </div>
          </div>
        `;
      }).join('');

      bodyHTML = `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:4px">
          <p class="snes-small snes-success">★ POWERUP${resolvedDrops.length > 1 ? 'S' : ''} EARNED!</p>
          ${dropListHTML}
        </div>
        <button class="snes-btn snes-btn-yellow" id="btn-drop-ok" style="width:100%">▶ GOT IT!</button>
      `;
    } else if (screenState === 'overflow_prompt') {
      const inv = getInventory();
      const replaceButtonsHTML = inv.map((p, i) => {
        const icon = POWERUP_ICONS[p.name] ?? '';
        return `
          <button class="snes-btn" style="width:100%;font-size:6px;padding:8px 10px;display:flex;align-items:center;gap:8px"
                  data-replace="${i}">
            ${icon ? `<img src="${icon}" alt="" style="width:20px;height:20px;image-rendering:pixelated;object-fit:contain;flex-shrink:0">` : ''}
            <span>REPLACE: ${p.name.toUpperCase()} (${p.tier.toUpperCase()})</span>
          </button>
        `;
      }).join('');

      const overflowIcon = POWERUP_ICONS[overflowDrop.name] ?? '';
      bodyHTML = `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:8px">
          <p class="snes-small snes-error">INVENTORY FULL</p>
          <p class="snes-small snes-muted">NEW DROP:</p>
          <div style="display:flex;align-items:center;gap:10px">
            ${overflowIcon ? `<img src="${overflowIcon}" alt="" style="width:32px;height:32px;image-rendering:pixelated;object-fit:contain">` : ''}
            <div>
              <p class="snes-small snes-highlight">${overflowDrop.name.toUpperCase()}</p>
              <p class="snes-small snes-muted" style="font-size:5px">${overflowDrop.tier.toUpperCase()} · ${overflowDrop.scope.toUpperCase()}</p>
            </div>
          </div>
        </div>
        <p class="snes-small snes-muted">REPLACE WHICH SLOT, OR DISCARD?</p>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${replaceButtonsHTML}
          <button class="snes-btn" style="width:100%;font-size:6px;padding:8px 10px" id="btn-overflow-discard">
            ✗ DISCARD NEW DROP
          </button>
        </div>
      `;
    } else if (screenState === 'match_over') {
      const won = playerRoundsWon >= roundsToWin;
      bodyHTML = `
        <div class="snes-panel" style="text-align:center;display:flex;flex-direction:column;gap:12px">
          <p class="snes-label ${won ? 'snes-success' : 'snes-error'}" style="font-size:12px">
            ${won ? 'YOU WIN!' : 'YOU LOSE.'}
          </p>
          <p class="snes-small snes-muted">FINAL SCORE</p>
          <p class="snes-label">
            <span class="snes-highlight">${playerRoundsWon}</span>
            <span class="snes-muted"> – </span>
            <span>${opponentRoundsWon}</span>
          </p>
        </div>
        <button class="snes-btn snes-btn-yellow" id="btn-continue" style="width:100%">▶ CONTINUE</button>
      `;
    }

    // Round history log
    const historyHTML = tournamentData.currentMatch.roundHistory.length > 0
      ? tournamentData.currentMatch.roundHistory.map(r => {
          const won = r.winner === 'player';
          const tie = r.winner === 'tie';
          return `<span class="snes-small ${won ? 'snes-success' : tie ? 'snes-highlight' : 'snes-error'}">
            R${r.round}: ${r.playerThrow[0].toUpperCase()} vs ${r.opponentThrow[0].toUpperCase()}
            ${won ? '▲' : tie ? '─' : '▼'}
          </span>`;
        }).join('  ')
      : '';

    const greetingHTML = screenState === 'picking' && roundNumber === 1
      ? `<div class="snes-panel">
           <p class="snes-small snes-muted" style="line-height:2">"${npc.greeting}"</p>
         </div>`
      : '';

    const popupHTML = popupPowerup ? renderPopup(popupPowerup) : '';

    container.innerHTML = `
      <div class="screen fade-in" style="gap:0;position:relative">

        ${popupHTML ? `<div id="pu-popup-layer">${popupHTML}</div>` : ''}

        <div class="match-layout">

          <!-- Left panel: scoreboard + round history -->
          <div class="match-panel">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
                <div class="portrait-frame portrait-frame--match">
                  <img src="assets/portraits/${playerPortrait}.png" alt="">
                </div>
                <p class="snes-small snes-highlight" style="text-align:center;word-break:break-all">${playerName}</p>
                <p style="font-size:10px;text-align:center">${scoreBar(playerRoundsWon, roundsToWin)}</p>
              </div>

              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
                <p class="snes-small snes-muted">${(cm.roundName ?? '').toUpperCase()}</p>
                <p class="snes-label">VS</p>
              </div>

              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0">
                <div class="portrait-frame portrait-frame--match">
                  <img src="assets/portraits/${npcPortrait}.png" alt="">
                </div>
                <p class="snes-small" style="text-align:center;word-break:break-all">${npcName}</p>
                <p style="font-size:10px;text-align:center">${scoreBar(opponentRoundsWon, roundsToWin)}</p>
              </div>
            </div>

            ${greetingHTML}

            ${historyHTML
              ? `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">${historyHTML}</div>`
              : ''}
          </div>

          <!-- Right panel: powerup tray + action area -->
          <div class="match-panel">
            ${renderTray(inventory, maxSlots)}
            ${bodyHTML}
          </div>

        </div>
      </div>
    `;

    attachListeners();
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  function attachListeners() {
    // Powerup tray slot clicks (always active)
    container.querySelectorAll('[data-inspect]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.inspect;
        const inv = getInventory();
        popupPowerup = inv.find(p => p.instanceId === id) ?? null;
        render();
      });
    });

    // Popup buttons
    document.getElementById('btn-popup-use')?.addEventListener('click', () => {
      if (!popupPowerup) return;
      handleUsePowerup(popupPowerup.instanceId);
      popupPowerup = null;
      render();
    });
    document.getElementById('btn-popup-close')?.addEventListener('click', () => {
      popupPowerup = null;
      render();
    });
    document.getElementById('pu-popup-backdrop')?.addEventListener('click', () => {
      popupPowerup = null;
      render();
    });

    if (screenState === 'picking') {
      container.querySelectorAll('[data-throw]').forEach(btn => {
        btn.addEventListener('click', () => handleThrowPick(btn.dataset.throw));
      });
    } else if (screenState === 'gut_check') {
      document.getElementById('btn-ready')?.addEventListener('click', handleReady);
      container.querySelectorAll('[data-change]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentThrow = btn.dataset.change;
          render();
        });
      });
    } else if (screenState === 'revealing') {
      document.getElementById('btn-next')?.addEventListener('click', handleAdvanceFromReveal);
    } else if (screenState === 'drop_result') {
      document.getElementById('btn-drop-ok')?.addEventListener('click', advanceRound);
    } else if (screenState === 'overflow_prompt') {
      container.querySelectorAll('[data-replace]').forEach(btn => {
        btn.addEventListener('click', () => handleOverflowReplace(parseInt(btn.dataset.replace, 10)));
      });
      document.getElementById('btn-overflow-discard')?.addEventListener('click', handleOverflowDiscard);
    } else if (screenState === 'match_over') {
      document.getElementById('btn-continue')?.addEventListener('click', finishMatch);
    }
  }

  // ── Phase 1: Throw pick ───────────────────────────────────────────────────────

  function handleThrowPick(throw_) {
    currentThrow         = throw_;
    pendingOpponentThrow = getNpcThrow(npcMatchState, lastRoundResult);
    changedMyMindUsed    = false;
    screenState          = 'gut_check';
    render();
  }

  // ── Phase 2: Gut check ────────────────────────────────────────────────────────

  function handleUsePowerup(instanceId) {
    const inv = getInventory();
    const pu  = inv.find(p => p.instanceId === instanceId);
    if (!pu) return;

    if (pu.name === 'Changed My Mind') {
      consumeFirstCMM();
      changedMyMindUsed = true;
    }
    // TODO v0.3: other powerup effects
  }

  function handleReady() {
    const result = resolveRound(currentThrow, pendingOpponentThrow);

    lastPlayerThrow   = currentThrow;
    lastOpponentThrow = pendingOpponentThrow;
    lastRoundResult   = result;

    if (result === 'player')   playerRoundsWon++;
    if (result === 'opponent') opponentRoundsWon++;

    tournamentData.currentMatch.roundHistory.push({
      round:         roundNumber,
      playerThrow:   currentThrow,
      opponentThrow: pendingOpponentThrow,
      winner:        result,
    });
    tournamentData.currentMatch.playerRoundsWon   = playerRoundsWon;
    tournamentData.currentMatch.opponentRoundsWon = opponentRoundsWon;
    saveTournament(charId, tournamentData);

    recordPlayerThrow(npcMatchState, currentThrow);

    screenState = 'revealing';
    render();
  }

  // ── After reveal: drop processing ────────────────────────────────────────────

  function handleAdvanceFromReveal() {
    if (playerRoundsWon >= roundsToWin || opponentRoundsWon >= roundsToWin) {
      screenState = 'match_over';
      render();
      return;
    }

    resolvedDrops = [];

    if (lastRoundResult === 'player') {
      const count = calcDropCount(playerRoundsWon);
      earnedDrops = generateDrops(count);
    } else {
      earnedDrops = [];
    }

    processNextDrop();
  }

  function processNextDrop() {
    if (earnedDrops.length === 0) {
      if (resolvedDrops.length > 0) {
        screenState = 'drop_result';
        render();
      } else {
        advanceRound();
      }
      return;
    }

    const drop     = earnedDrops.shift();
    const inv      = getInventory();
    const maxSlots = getMaxSlots(progress.treeState);

    if (inv.length < maxSlots) {
      inv.push(drop);
      saveInventory(inv);
      resolvedDrops.push(drop);
      processNextDrop();
    } else {
      overflowDrop = drop;
      screenState  = 'overflow_prompt';
      render();
    }
  }

  // ── Overflow handlers ─────────────────────────────────────────────────────────

  function handleOverflowReplace(idx) {
    const inv = getInventory();
    inv.splice(idx, 1);
    inv.push(overflowDrop);
    saveInventory(inv);
    resolvedDrops.push(overflowDrop);
    overflowDrop = null;
    processNextDrop();
  }

  function handleOverflowDiscard() {
    overflowDrop = null;
    processNextDrop();
  }

  // ── Advance to next round ─────────────────────────────────────────────────────

  function advanceRound() {
    roundNumber++;
    currentThrow         = null;
    pendingOpponentThrow = null;
    changedMyMindUsed    = false;
    popupPowerup         = null;
    screenState          = 'picking';
    render();
  }

  // ── Match completion ──────────────────────────────────────────────────────────

  function finishMatch() {
    const playerWon   = playerRoundsWon >= roundsToWin;
    const matchResult = playerWon ? 'p1_won' : 'p2_won';
    const score       = [playerRoundsWon, opponentRoundsWon];

    const rounds = tournamentData.bracket.rounds;
    for (const round of rounds) {
      for (const match of round.matches) {
        if ((match.p1 === 'player' || match.p2 === 'player') && match.result === null) {
          match.result = match.p1 === 'player' ? matchResult : (playerWon ? 'p2_won' : 'p1_won');
          match.score  = match.p1 === 'player' ? score : [score[1], score[0]];
          break;
        }
      }
    }

    tournamentData.currentMatch = null;
    saveTournament(charId, tournamentData);

    const npcElo = npc.startingElo;
    const newElo = calcNewElo(progress.currentElo, npcElo, playerWon ? 1 : 0);
    progress.currentElo = newElo;
    progress.peakElo    = Math.max(progress.peakElo, newElo);

    // Refresh world rank after every match using current stored NPC ELOs
    const worldData   = loadWorld(charId);
    const newRank     = computeMidSeasonRank(newElo, worldData, getAllNpcs());
    if (newRank !== null) {
      progress.worldRank     = newRank;
      progress.peakWorldRank = Math.min(progress.peakWorldRank ?? (TOTAL_PLAYERS + 1), newRank);
    }

    saveProgress(charId, progress);

    const stats = loadStats(charId);
    stats.career.totalMatches++;
    stats.career[playerWon ? 'matchWins' : 'matchLosses']++;
    saveStats(charId, stats);

    navigate('tournament', { charId });
  }

  // ── Go ────────────────────────────────────────────────────────────────────────

  render();
}
