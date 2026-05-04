import { navigate, getNpcById, getAllNpcs } from '../main.js';
import { resolveRound } from '../systems/round.js';
import { initNpcMatchState, getNpcThrow, recordPlayerThrow } from '../systems/npc.js';
import { calcNewElo } from '../systems/elo.js';
import {
  calcDropCount, generateDrops, getMaxSlots,
  getDropMultiplier, generateBonusDrops, randomThrow, randomCoinFlip,
} from '../systems/powerupEngine.js';
import { computeMidSeasonRank } from '../systems/seasonEngine.js';
import { roll } from '../utils/rng.js';
import {
  ROUNDS_TO_WIN_MATCH, ROUNDS_TO_WIN_MATCH_FINALS,
  POWERUP_ICONS, POWERUP_DESCRIPTIONS, POWERUP_IMPLEMENTED,
  POWERUP_NO_OP, POWERUP_BY_NAME, TOTAL_PLAYERS,
  NPR_ACCUMULATION_PER_ROUND, NPR_FALSE_RESULT_CHANCE,
  TWEAK_REALITY_CHANCE, CONSOLATION_PRIZE_CHANCE,
  TML_SUCCESS_CHANCE, TML_COOLDOWN_ROUNDS,
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

function computeStreak(history) {
  let s = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].winner === 'player') s++;
    else break;
  }
  return s;
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
  let currentThrow         = null;
  let pendingOpponentThrow = null;
  let changedMyMindUsed    = false;
  let roundForceWin        = false;   // Wish Upon a Star: result forced to player
  let roundInstantMatchWin = false;   // Project Hail Mary: win → match instant win
  let roundLockThrow       = false;   // throw is system-decided this round (cookies, Pandora, Hail Mary)
  let roundOtherUsesDisabled = false; // Project Hail Mary disables other USEs this round
  let roundBonusOnWin      = [];      // [{tier, count}] queued for award if round won
  let roundLuckyPennyCall  = null;    // 'heads' | 'tails' (set during gut_check)
  let roundDizzySpell      = false;   // NPC throws random just this round
  let roundMysticPizza     = false;   // round will replay if it ends in a player loss
  let roundForceLoss       = false;   // TML failure: result forced to opponent
  let roundActiveSkillUsed = false;   // one active skill per round limit (FORTUNE.1.1 etc.)
  let roundTmlPending      = null;    // 'success' | 'failure' | null — display TML outcome
  let roundCanChangeThrow  = false;   // any reveal effect granted throw-change ability
  let roundRead            = null;    // { source, throwName } — informational read shown in gut_check
  let roundStrategyRead    = null;    // { source, strategy, accurate } — NPR strategy reveal
  let roundActivated       = [];      // names of powerups activated this round (display)

  // Per-match state (in-memory)
  let matchHotSauce          = false;
  let matchThreesCompany     = false;
  let matchThreesCompanyDone = false;
  let matchLuckyPenny        = false;
  let matchTabulaRasa        = false;   // NPC throws random all match
  let matchHiccupPotion      = false;   // NPC throws random every 3rd round
  let matchFocusGroup        = false;   // 65% per-round NPC-throw hint
  let matchFocusedFG         = false;   // 80% per-round NPC-throw hint
  let matchMysticPizza       = false;   // available "rewind on loss" charge (consumed on use)
  let matchPizzaUsedThisRound = false;  // prevents infinite replay

  // L2 skill state
  let nprAccumulation     = 0;          // MIND.1.1 — % per round, resets on fire/match start
  let hasNPRFiredThisMatch = false;     // for v1.0 Mental Mysticism precondition
  let tmlCooldownRemaining = 0;         // FORTUNE.1.1 — rounds before TML usable again
  let playerWinStreak        = computeStreak(tournamentData.currentMatch.roundHistory ?? []);
  // Tracks per-effect "already-awarded-at" thresholds for the current streak run.
  // Reset whenever streak resets to 0 (after a non-win round).
  let streakAwardedFlags = {};

  // Post-reveal drop state
  let earnedDrops      = [];
  let resolvedDrops    = [];
  let overflowDrop     = null;
  let pendingMatchOver = false;  // set when match ends but drops remain to show

  // Revealing state
  let lastPlayerThrow   = null;
  let lastOpponentThrow = null;
  let lastRoundResult   = null;

  // Popup state — which powerup detail card is open (or null)
  let popupPowerup = null;

  let npcMatchState = initNpcMatchState(npc);

  // ── Skill state helpers ──────────────────────────────────────────────────────

  function hasSkill(nodeId) {
    const tree = nodeId.split('.')[0];
    return Boolean(progress.treeState?.[tree]?.[nodeId]);
  }

  // ── Inventory helpers ────────────────────────────────────────────────────────

  function getInventory() {
    return progress.powerupInventory ?? [];
  }

  function saveInventory(inv) {
    progress.powerupInventory = inv;
    saveProgress(charId, progress);
  }

  function consumePowerupByInstance(instanceId) {
    const inv = getInventory();
    const idx = inv.findIndex(p => p.instanceId === instanceId);
    if (idx === -1) return false;
    inv.splice(idx, 1);
    saveInventory(inv);
    return true;
  }

  function consumeFirstByName(name) {
    const inv = getInventory();
    const idx = inv.findIndex(p => p.name === name);
    if (idx === -1) return false;
    inv.splice(idx, 1);
    saveInventory(inv);
    return true;
  }

  // ── Active-effects registry (match / tournament / season scope) ──────────────

  function ensureEffectsBucket() {
    progress.activePowerupEffects ??= { tournament: [], season: [] };
    progress.activePowerupEffects.tournament ??= [];
    progress.activePowerupEffects.season     ??= [];
  }

  function tournamentEffectActive(name) {
    ensureEffectsBucket();
    return progress.activePowerupEffects.tournament.some(e => e.name === name);
  }

  function seasonEffectActive(name) {
    ensureEffectsBucket();
    return progress.activePowerupEffects.season.some(e => e.name === name);
  }

  function activateTournamentEffect(name) {
    ensureEffectsBucket();
    if (!progress.activePowerupEffects.tournament.some(e => e.name === name)) {
      progress.activePowerupEffects.tournament.push({ name });
    }
    saveProgress(charId, progress);
  }

  function activateSeasonEffect(name) {
    ensureEffectsBucket();
    if (!progress.activePowerupEffects.season.some(e => e.name === name)) {
      progress.activePowerupEffects.season.push({ name });
    }
    saveProgress(charId, progress);
  }

  // Returns true if any powerup-disabling effect is in play this round.
  function powerupUseAllowed(pu) {
    if (roundOtherUsesDisabled && pu.name !== 'Project Hail Mary') return false;
    return true;
  }

  // ── Powerup tray (always rendered in left panel) ──────────────────────────────

  function slotPhaseClass(pu) {
    if (!POWERUP_IMPLEMENTED.has(pu.name)) return '';
    const inRound = screenState === 'picking' || screenState === 'gut_check';
    if (!inRound) return '';
    const phase = POWERUP_BY_NAME[pu.name]?.activationPhase ?? 'either';
    if (phase === 'gut_check' && screenState === 'picking') return 'pu-slot--gutcheck-only';
    return 'pu-slot--active-now';
  }

  function renderTray(inventory, maxSlots) {
    const slots = [];

    for (let i = 0; i < maxSlots; i++) {
      const pu      = inventory[i] ?? null;
      const iconSrc = pu ? (POWERUP_ICONS[pu.name] ?? '') : '';

      if (pu) {
        const scopeLabel = pu.scope ? `(${pu.scope.toLowerCase()})` : '';
        const nameShort  = pu.name.length > 16 ? pu.name.slice(0, 15) + '…' : pu.name;
        const phaseClass = slotPhaseClass(pu);
        slots.push(`
          <div class="pu-slot pu-slot--filled ${phaseClass}" data-inspect="${pu.instanceId}" title="${pu.name}">
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
        slots.push(`<div class="pu-slot pu-slot--empty"><div class="pu-slot-icon"></div></div>`);
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

  function isUsableNow(pu) {
    if (!POWERUP_IMPLEMENTED.has(pu.name)) return { ok: false, note: 'Effect coming in a future update' };

    // Activation phase gating — most powerups are 'either', some require 'gut_check'.
    const activePhase = POWERUP_BY_NAME[pu.name]?.activationPhase ?? 'either';
    const inRoundFlow = screenState === 'picking' || screenState === 'gut_check';
    if (!inRoundFlow)                          return { ok: false, note: 'Usable during a round only' };
    if (activePhase === 'gut_check' && screenState !== 'gut_check') {
      return { ok: false, note: 'Usable during Gut Check only' };
    }
    if (!powerupUseAllowed(pu))                return { ok: false, note: 'Disabled this round (Project Hail Mary)' };

    // Per-powerup gating
    if (pu.name === 'Changed My Mind' && changedMyMindUsed)
                                               return { ok: false, note: 'Already used this round' };
    if (pu.name === 'Hot Sauce'           && matchHotSauce)        return { ok: false, note: 'Already active this match' };
    if (pu.name === "Three's Company"     && matchThreesCompany)   return { ok: false, note: 'Already active this match' };
    if (pu.name === 'Lucky Penny'         && matchLuckyPenny)      return { ok: false, note: 'Already active this match' };
    if (pu.name === 'Ghost Pepper'        && tournamentEffectActive('Ghost Pepper'))    return { ok: false, note: 'Already active this tournament' };
    if (pu.name === 'Carolina Reaper'     && tournamentEffectActive('Carolina Reaper')) return { ok: false, note: 'Already active this tournament' };
    if (pu.name === 'The Ballad of Jessie Jones' && seasonEffectActive('The Ballad of Jessie Jones')) {
      return { ok: false, note: 'Already active this season' };
    }
    if (pu.name === 'Tabula Rasa' && matchTabulaRasa)              return { ok: false, note: 'Already active this match' };
    if (pu.name === 'Hiccup Potion' && matchHiccupPotion)          return { ok: false, note: 'Already active this match' };
    if (pu.name === 'Focus Group' && matchFocusGroup)              return { ok: false, note: 'Already active this match' };
    if (pu.name === 'Focused Focus Group' && matchFocusedFG)       return { ok: false, note: 'Already active this match' };

    return { ok: true, note: '' };
  }

  function renderPopup(pu) {
    const iconSrc      = POWERUP_ICONS[pu.name] ?? '';
    const desc         = POWERUP_DESCRIPTIONS[pu.name] ?? 'Description coming in a future update.';
    const { ok: canUse, note: useNote } = isUsableNow(pu);
    const useLabel     = canUse ? '▶ USE' : '— USE';

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

  // ── Active effects banner (shown above body during gameplay) ─────────────────

  function renderActiveEffects() {
    const list = [];
    if (matchHotSauce)                              list.push('HOT SAUCE');
    if (matchThreesCompany && !matchThreesCompanyDone) list.push("THREE'S COMPANY");
    if (matchLuckyPenny)                            list.push('LUCKY PENNY');
    if (tournamentEffectActive('Ghost Pepper'))     list.push('GHOST PEPPER');
    if (tournamentEffectActive('Carolina Reaper'))  list.push('CAROLINA REAPER');
    if (seasonEffectActive('The Ballad of Jessie Jones')) list.push('BALLAD OF JJ');
    if (list.length === 0) return '';
    return `
      <p class="snes-small snes-success" style="font-size:5px;text-align:center">
        ★ ACTIVE: ${list.join(' · ')}
      </p>
    `;
  }

  // Active-skill bar — shown above the action area when player has active skills.
  // Currently only TML at L2; will expand with more L3/L4 actives.
  function renderActiveSkillsBar() {
    if (!hasSkill('FORTUNE.1.1')) return '';
    const ready    = tmlCooldownRemaining === 0 && !roundActiveSkillUsed;
    const cdLabel  = tmlCooldownRemaining > 0
      ? `${tmlCooldownRemaining} ROUND${tmlCooldownRemaining > 1 ? 'S' : ''}`
      : 'READY';
    const usedThis = roundTmlPending !== null;
    return `
      <div class="snes-panel" style="display:flex;align-items:center;gap:10px;padding:10px">
        <p class="snes-small snes-muted" style="font-size:5px">ACTIVE SKILL</p>
        <p class="snes-small" style="flex:1;font-size:6px">
          TRUST MY LUCK
          <span class="snes-muted" style="font-size:5px">· ${cdLabel}</span>
        </p>
        <button class="snes-btn${ready ? ' snes-btn-yellow' : ''}" id="btn-tml"
                style="font-size:6px;padding:6px 10px${ready ? '' : ';opacity:0.4;cursor:not-allowed'}"
                ${ready ? '' : 'disabled'}>
          ${usedThis ? (roundTmlPending === 'success' ? '✓ TRUSTED' : '✗ FAILED') : '▶ TRUST'}
        </button>
      </div>
    `;
  }

  // NPR accumulation indicator (L2 MIND.1.1 passive).
  function renderNPRIndicator() {
    if (!hasSkill('MIND.1.1')) return '';
    const pct = Math.round(nprAccumulation * 100);
    return `
      <p class="snes-small snes-muted" style="font-size:5px;text-align:center">
        NPR: <span class="snes-highlight">${pct}%</span>
      </p>
    `;
  }

  // Strategy reveal panel — shown when NPR fires (or other strategy reveals).
  function renderStrategyRead() {
    if (!roundStrategyRead) return '';
    const { source, strategy, accurate } = roundStrategyRead;
    return `
      <div class="snes-panel" style="display:flex;align-items:center;gap:10px">
        <p class="snes-small snes-highlight" style="font-size:7px">★ STRATEGY READ</p>
        <p class="snes-small" style="flex:1;font-size:6px;line-height:1.5">
          <span class="snes-muted">${source}:</span>
          NPC strategy is <span class="snes-highlight">${strategy.toUpperCase()}</span>
          <span class="snes-muted">(${accurate ? '90' : 'low'}% confidence)</span>
        </p>
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
      const pickingActivatedHTML = roundActivated.length > 0
        ? `<p class="snes-small snes-success" style="font-size:5px;text-align:center">★ ACTIVATED: ${roundActivated.map(n => n.toUpperCase()).join(' · ')}</p>`
        : '';
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} ──</p>
        ${renderActiveEffects()}
        ${renderNPRIndicator()}
        ${pickingActivatedHTML}
        ${renderActiveSkillsBar()}
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
        <p class="snes-small snes-muted" style="font-size:5px;text-align:center">Tap a powerup to inspect or use it</p>
      `;
    } else if (screenState === 'gut_check') {
      // Throw-change buttons appear when any powerup grants change ability AND throw is not locked.
      const allowChange = (changedMyMindUsed || roundCanChangeThrow) && !roundLockThrow;
      const throwChangeHTML = allowChange ? `
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

      const lockedNote = roundLockThrow
        ? `<p class="snes-small snes-muted" style="font-size:5px;text-align:center">Throw locked by powerup effect</p>`
        : '';

      // Read panel — shown when any reveal effect produced an informational read
      const readHTML = roundRead ? `
        <div class="snes-panel" style="display:flex;align-items:center;gap:10px">
          <p class="snes-small snes-highlight" style="font-size:7px">★ READ</p>
          <p class="snes-small" style="flex:1;font-size:6px;line-height:1.5">
            <span class="snes-muted">${roundRead.source.toUpperCase()}:</span>
            They're throwing <span class="snes-highlight">${THROW_NAME[roundRead.throwName]}</span>
            <span class="snes-muted">(${roundRead.confidence}%)</span>
          </p>
        </div>
      ` : '';

      // Lucky Penny per-round H/T prompt
      const luckyPennyHTML = matchLuckyPenny ? `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:6px">
          <p class="snes-small snes-muted" style="font-size:5px;text-align:center">LUCKY PENNY · CALL IT</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <button class="snes-btn${roundLuckyPennyCall === 'heads' ? ' snes-btn-yellow' : ''}"
                    data-coin="heads" style="font-size:6px;padding:6px 8px">⚡ HEADS</button>
            <button class="snes-btn${roundLuckyPennyCall === 'tails' ? ' snes-btn-yellow' : ''}"
                    data-coin="tails" style="font-size:6px;padding:6px 8px">⚡ TAILS</button>
          </div>
        </div>
      ` : '';

      const readyDisabled = matchLuckyPenny && roundLuckyPennyCall === null;
      const readyDisabledNote = readyDisabled
        ? `<p class="snes-small snes-muted" style="font-size:5px;text-align:center">Call heads or tails first</p>`
        : '';

      const activatedHTML = roundActivated.length > 0
        ? `<p class="snes-small snes-success" style="font-size:5px;text-align:center">★ ACTIVATED: ${roundActivated.map(n => n.toUpperCase()).join(' · ')}</p>`
        : '';

      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} · GUT CHECK ──</p>
        ${renderActiveEffects()}
        ${renderNPRIndicator()}
        ${activatedHTML}
        ${renderActiveSkillsBar()}
        ${renderStrategyRead()}
        ${readHTML}
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <p class="snes-small snes-muted" style="font-size:5px">THROWING</p>
            <p class="snes-small snes-highlight">${THROW_NAME[currentThrow]}</p>
          </div>
          <button class="snes-btn snes-btn-yellow" id="btn-ready"
                  style="${readyDisabled ? 'opacity:0.4;cursor:not-allowed' : ''}"
                  ${readyDisabled ? 'disabled' : ''}>
            ▶ READY
          </button>
        </div>
        ${readyDisabledNote}
        ${luckyPennyHTML}
        ${throwChangeHTML}
        ${lockedNote}
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
        ${renderActiveEffects()}
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
          <div id="overflow-drop-inspect" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px;border:1px solid var(--snes-border);border-radius:2px" title="Tap to inspect">
            ${overflowIcon ? `<img src="${overflowIcon}" alt="" style="width:32px;height:32px;image-rendering:pixelated;object-fit:contain;flex-shrink:0">` : ''}
            <div style="flex:1;min-width:0">
              <p class="snes-small snes-highlight">${overflowDrop.name.toUpperCase()}</p>
              <p class="snes-small snes-muted" style="font-size:5px">${overflowDrop.tier.toUpperCase()} · ${overflowDrop.scope.toUpperCase()}</p>
              <p class="snes-small snes-muted" style="font-size:4px;margin-top:2px">▶ TAP TO INSPECT</p>
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
    container.querySelectorAll('[data-inspect]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.inspect;
        const inv = getInventory();
        popupPowerup = inv.find(p => p.instanceId === id) ?? null;
        render();
      });
    });

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

    // TML button (visible in picking + gut_check phases)
    document.getElementById('btn-tml')?.addEventListener('click', handleTrustMyLuck);

    if (screenState === 'picking') {
      container.querySelectorAll('[data-throw]').forEach(btn => {
        btn.addEventListener('click', () => handleThrowPick(btn.dataset.throw));
      });
    } else if (screenState === 'gut_check') {
      document.getElementById('btn-ready')?.addEventListener('click', handleReady);
      container.querySelectorAll('[data-change]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (roundLockThrow) return;
          currentThrow = btn.dataset.change;
          render();
        });
      });
      container.querySelectorAll('[data-coin]').forEach(btn => {
        btn.addEventListener('click', () => {
          roundLuckyPennyCall = btn.dataset.coin;
          render();
        });
      });
    } else if (screenState === 'revealing') {
      document.getElementById('btn-next')?.addEventListener('click', handleAdvanceFromReveal);
    } else if (screenState === 'drop_result') {
      document.getElementById('btn-drop-ok')?.addEventListener('click', advanceRound);
    } else if (screenState === 'overflow_prompt') {
      document.getElementById('overflow-drop-inspect')?.addEventListener('click', () => {
        popupPowerup = overflowDrop;
        render();
      });
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
    pendingOpponentThrow = computeNpcThrow();
    changedMyMindUsed    = false;
    screenState          = 'gut_check';
    processNPR();
    generateRoundRead();
    render();
  }

  // Decides the NPC's throw, applying any active randomization effects.
  function computeNpcThrow() {
    // Round-scope: Dizzy Spell forces random NPC throw just this round.
    if (roundDizzySpell) return randomThrow();
    // Match-scope: Tabula Rasa makes the NPC random for the whole match.
    if (matchTabulaRasa) return randomThrow();
    // Hiccup Potion: every 3rd round (rounds 3, 6, 9...) the NPC throws random.
    if (matchHiccupPotion && roundNumber % 3 === 0) return randomThrow();
    // Blank Slate (MIND.1.2): mask last 2 throws from history-reading strategies.
    const masked = hasSkill('MIND.1.2') ? 2 : 0;
    return getNpcThrow(npcMatchState, lastRoundResult, masked);
  }

  // NPR (MIND.1.1) — accumulate, roll for fire each round, populate roundStrategyRead.
  function processNPR() {
    if (!hasSkill('MIND.1.1')) return;
    nprAccumulation += NPR_ACCUMULATION_PER_ROUND;
    if (roll() < nprAccumulation) {
      // NPR fires — read NPC strategy at 90% accuracy (10% false read).
      const accurate = roll() >= NPR_FALSE_RESULT_CHANCE;
      const realStrategy = npcMatchState.strategy ?? 'unknown';
      const wrongPool = ['random', 'puristRock', 'puristPaper', 'mirror', 'historian',
                          'streaker', 'momentum', 'counter', 'cycler']
                          .filter(s => s !== realStrategy);
      const shown = accurate
        ? realStrategy
        : (wrongPool[Math.floor(roll() * wrongPool.length)] ?? realStrategy);
      roundStrategyRead    = { source: 'NPR', strategy: shown, accurate };
      hasNPRFiredThisMatch = true;
      nprAccumulation      = 0;
    }
  }

  // Computes the per-round informational read from any active reveal effects.
  // Picks the highest-confidence active read; sets roundCanChangeThrow if any
  // reveal grants throw-change ability.
  function generateRoundRead() {
    roundRead           = null;
    roundCanChangeThrow = false;

    const candidates = [];
    if (matchFocusedFG) {
      const correct = roll() < 0.80;
      candidates.push({ source: 'Focused Focus Group', confidence: 80,
                        throwName: correct ? pendingOpponentThrow : pickWrongThrow(pendingOpponentThrow) });
    }
    if (matchFocusGroup) {
      const correct = roll() < 0.65;
      candidates.push({ source: 'Focus Group', confidence: 65,
                        throwName: correct ? pendingOpponentThrow : pickWrongThrow(pendingOpponentThrow) });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      roundRead           = candidates[0];
      roundCanChangeThrow = true;
    }
  }

  function pickWrongThrow(actual) {
    const others = ['rock', 'paper', 'scissors'].filter(t => t !== actual);
    return others[Math.floor(roll() * others.length)];
  }

  // ── Phase 2: Gut check / Powerup activation ──────────────────────────────────

  function handleUsePowerup(instanceId) {
    const inv = getInventory();
    const pu  = inv.find(p => p.instanceId === instanceId);
    if (!pu) return;
    if (!isUsableNow(pu).ok) return;

    switch (pu.name) {
      case 'Changed My Mind':
        consumeFirstByName('Changed My Mind');
        changedMyMindUsed = true;
        roundActivated.push("Changed My Mind");
        break;

      // ── FORTUNE — round-scope: randomize player throw, bonus drops on win ──
      case 'Fortune Cookie':
      case 'Giant Fortune Cookie':
      case 'Comically Large Fortune Cookie': {
        const tierByName = {
          'Fortune Cookie':                 'Basic',
          'Giant Fortune Cookie':           'Advanced',
          'Comically Large Fortune Cookie': 'Legendary',
        };
        consumePowerupByInstance(instanceId);
        currentThrow      = randomThrow();
        roundLockThrow    = true;
        roundBonusOnWin.push({ tier: tierByName[pu.name], count: 2 });
        roundActivated.push(pu.name);
        break;
      }

      // ── FORTUNE — Pandora's Box: random both, cooldown reset on win ─────────
      case "Pandora's Box":
        consumePowerupByInstance(instanceId);
        currentThrow         = randomThrow();
        pendingOpponentThrow = randomThrow();
        roundLockThrow       = true;
        // Cooldown reset on win is a no-op until v0.3 active skills exist.
        roundActivated.push("Pandora's Box");
        break;

      // ── FORTUNE — Project Hail Mary: random both + win → match win ──────────
      case 'Project Hail Mary':
        consumePowerupByInstance(instanceId);
        currentThrow             = randomThrow();
        pendingOpponentThrow     = randomThrow();
        roundLockThrow           = true;
        roundInstantMatchWin     = true;
        roundOtherUsesDisabled   = true;
        roundActivated.push('Project Hail Mary');
        break;

      // ── FORTUNE — Wish Upon a Star: forced win this round ───────────────────
      case 'Wish Upon a Star':
        consumePowerupByInstance(instanceId);
        roundForceWin = true;
        roundActivated.push('Wish Upon a Star');
        break;

      // ── FORTUNE — match-scope streak spawners ───────────────────────────────
      case 'Hot Sauce':
        consumePowerupByInstance(instanceId);
        matchHotSauce = true;
        roundActivated.push('Hot Sauce');
        break;

      case "Three's Company":
        consumePowerupByInstance(instanceId);
        matchThreesCompany = true;
        roundActivated.push("Three's Company");
        break;

      case 'Lucky Penny':
        consumePowerupByInstance(instanceId);
        matchLuckyPenny = true;
        roundActivated.push('Lucky Penny');
        break;

      // ── FORTUNE — tournament-scope streak spawners ──────────────────────────
      case 'Ghost Pepper':
        consumePowerupByInstance(instanceId);
        activateTournamentEffect('Ghost Pepper');
        roundActivated.push('Ghost Pepper');
        break;

      case 'Carolina Reaper':
        consumePowerupByInstance(instanceId);
        activateTournamentEffect('Carolina Reaper');
        roundActivated.push('Carolina Reaper');
        break;

      // ── FORTUNE — season-scope streak spawner ───────────────────────────────
      case 'The Ballad of Jessie Jones':
        consumePowerupByInstance(instanceId);
        activateSeasonEffect('The Ballad of Jessie Jones');
        roundActivated.push('Ballad of Jessie Jones');
        break;

      // ── MIND — force-win ────────────────────────────────────────────────────
      case 'The Jessie Special':
        consumePowerupByInstance(instanceId);
        roundForceWin = true;
        roundActivated.push('The Jessie Special');
        break;

      // ── MIND — info reveal (one-shot, 100% accurate) ────────────────────────
      case 'Dead Giveaway':
        consumePowerupByInstance(instanceId);
        if (pendingOpponentThrow === null) pendingOpponentThrow = computeNpcThrow();
        roundRead           = { source: 'Dead Giveaway', confidence: 100, throwName: pendingOpponentThrow };
        roundCanChangeThrow = true;
        roundActivated.push('Dead Giveaway');
        break;

      // ── MIND — match-scope per-round reads ──────────────────────────────────
      case 'Focus Group':
        consumePowerupByInstance(instanceId);
        matchFocusGroup = true;
        if (screenState === 'gut_check') generateRoundRead();
        roundActivated.push('Focus Group');
        break;

      case 'Focused Focus Group':
        consumePowerupByInstance(instanceId);
        matchFocusedFG = true;
        if (screenState === 'gut_check') generateRoundRead();
        roundActivated.push('Focused Focus Group');
        break;

      // ── MIND — pre-match strategy reveal (99% accurate) ─────────────────────
      case 'Jessie Did Her Homework': {
        consumePowerupByInstance(instanceId);
        const accurate = roll() < 0.99;
        const realStrategy = (npc.strategies?.[0] ?? 'unknown').toUpperCase();
        const wrongPool    = ['random', 'puristRock', 'puristPaper', 'mirror', 'historian', 'streaker']
                             .filter(s => s !== npc.strategies?.[0]);
        const shownStrategy = accurate
          ? realStrategy
          : (wrongPool[Math.floor(roll() * wrongPool.length)] ?? realStrategy).toUpperCase();
        roundActivated.push(`Jessie's Read: NPC Strategy is ${shownStrategy}`);
        break;
      }

      // ── MIND — research notes (info popup; full distribution stat tracking deferred) ─
      case 'Research Notes':
        consumePowerupByInstance(instanceId);
        // Best-effort summary from current match's NPC throws.
        roundActivated.push('Research Notes (consult inventory in v0.3+ for full data)');
        break;

      // ── MYSTIC — force-win ──────────────────────────────────────────────────
      case 'Fait Accompli':
        consumePowerupByInstance(instanceId);
        roundForceWin = true;
        roundActivated.push('Fait Accompli');
        break;

      // ── MYSTIC — Dizzy Spell: NPC random this round ─────────────────────────
      case 'Dizzy Spell':
        consumePowerupByInstance(instanceId);
        roundDizzySpell = true;
        if (pendingOpponentThrow !== null) {
          pendingOpponentThrow = randomThrow();
          generateRoundRead();
        }
        roundActivated.push('Dizzy Spell');
        break;

      // ── MYSTIC — Hiccup Potion: NPC random every 3rd round (match-scope) ───
      case 'Hiccup Potion':
        consumePowerupByInstance(instanceId);
        matchHiccupPotion = true;
        if (pendingOpponentThrow !== null && roundNumber % 3 === 0) {
          pendingOpponentThrow = randomThrow();
          generateRoundRead();
        }
        roundActivated.push('Hiccup Potion');
        break;

      // ── MYSTIC — Tabula Rasa: NPC random all match ──────────────────────────
      case 'Tabula Rasa':
        consumePowerupByInstance(instanceId);
        matchTabulaRasa = true;
        if (pendingOpponentThrow !== null) {
          pendingOpponentThrow = randomThrow();
          generateRoundRead();
        }
        roundActivated.push('Tabula Rasa');
        break;

      // ── MYSTIC — Mystic Pizza: replay round on loss ────────────────────────
      case 'Mystic Pizza':
        consumePowerupByInstance(instanceId);
        roundMysticPizza = true;
        roundActivated.push('Mystic Pizza');
        break;

      // ── MYSTIC — Cosmic Insurance Policy: reset match to round 1 ────────────
      case 'Cosmic Insurance Policy':
        consumePowerupByInstance(instanceId);
        resetMatch();
        roundActivated.push('Cosmic Insurance Policy');
        break;

      // ── MYSTIC — no-op until later systems land ─────────────────────────────
      case 'Clockwork Orange':   // resets player active-skill cooldowns; +1 round on opponents
      case 'Molasses':           // +1 round on opponent active-skill cooldowns
      case 'Padlock':            // blocks NPC powerup activation
      case 'Cuckoo Clock':       // auto-fires Clockwork Orange at round 3 each match
        consumePowerupByInstance(instanceId);
        roundActivated.push(`${pu.name} (no-op until later systems)`);
        break;
    }

    // If the powerup locked the throw while in the picking phase, advance
    // automatically — the player has nothing left to choose.
    if (screenState === 'picking' && roundLockThrow) {
      if (pendingOpponentThrow === null) pendingOpponentThrow = computeNpcThrow();
      screenState = 'gut_check';
      generateRoundRead();
    }
  }

  // ── Match reset (Cosmic Insurance Policy) ────────────────────────────────────

  function resetMatch() {
    playerRoundsWon        = 0;
    opponentRoundsWon      = 0;
    roundNumber            = 1;
    playerWinStreak        = 0;
    matchThreesCompanyDone = false;
    streakAwardedFlags     = {};

    tournamentData.currentMatch.playerRoundsWon   = 0;
    tournamentData.currentMatch.opponentRoundsWon = 0;
    tournamentData.currentMatch.roundHistory      = [];
    saveTournament(charId, tournamentData);

    // "Opponent remembers nothing" — reset NPC strategy state.
    npcMatchState = initNpcMatchState(npc);

    // Drop any in-progress round selection, return to picking.
    resetRoundScopeState();
    // Preserve Cosmic Insurance Policy in roundActivated for the panel display.
    screenState = 'picking';
  }

  // ── Streak-driven bonus drop computation ─────────────────────────────────────

  function computeStreakAwards(newStreak) {
    const queued = [];
    if (newStreak === 0) return queued;

    // Hot Sauce: every 2-streak (multiple of 2) → +1 Basic
    if (matchHotSauce && newStreak % 2 === 0) {
      queued.push({ tier: 'Basic', count: 1 });
    }
    // Three's Company: streak === 3, one-time per match → +3 Advanced
    if (matchThreesCompany && !matchThreesCompanyDone && newStreak === 3) {
      matchThreesCompanyDone = true;
      queued.push({ tier: 'Advanced', count: 3 });
    }
    // Streak-pair spawners: 2-streak and 3-streak each award once per streak run
    const pairSpec = {
      'Ghost Pepper':                ['Basic',    'Advanced'],
      'Carolina Reaper':             ['Advanced', 'Legendary'],
      'The Ballad of Jessie Jones':  ['Advanced', 'Legendary'],
    };
    for (const [name, [t2, t3]] of Object.entries(pairSpec)) {
      const isActive =
        (name === 'The Ballad of Jessie Jones' && seasonEffectActive(name)) ||
        (name !== 'The Ballad of Jessie Jones' && tournamentEffectActive(name));
      if (!isActive) continue;
      streakAwardedFlags[name] ??= { at2: false, at3: false };
      const flags = streakAwardedFlags[name];
      if (newStreak >= 2 && !flags.at2) {
        flags.at2 = true;
        queued.push({ tier: t2, count: 1 });
      }
      if (newStreak >= 3 && !flags.at3) {
        flags.at3 = true;
        queued.push({ tier: t3, count: 1 });
      }
    }
    return queued;
  }

  function resetStreakAwardedFlags() {
    streakAwardedFlags = {};
  }

  // ── Phase 3: Resolution ──────────────────────────────────────────────────────

  function handleReady() {
    // Lucky Penny: gate on call selection
    if (matchLuckyPenny && roundLuckyPennyCall === null) return;

    // Resolve, applying forced outcomes if active
    let result = resolveRound(currentThrow, pendingOpponentThrow);
    if (roundForceWin)       result = 'player';
    else if (roundForceLoss) result = 'opponent';
    // Tweak Reality (MYSTIC.1.1): natural tie → 30% convert to win
    else if (result === 'tie' && hasSkill('MYSTIC.1.1') && roll() < TWEAK_REALITY_CHANCE) {
      result = 'player';
      roundActivated.push('Reality Tweaked');
    }

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

    // Update streak counters
    if (result === 'player') {
      playerWinStreak++;
    } else {
      playerWinStreak = 0;
      resetStreakAwardedFlags();
    }

    screenState = 'revealing';
    render();
  }

  // ── After reveal: drop processing ────────────────────────────────────────────

  function handleAdvanceFromReveal() {
    // Mystic Pizza: replay the round if it ended in a player loss
    if (roundMysticPizza && lastRoundResult === 'opponent') {
      // Undo the loss
      opponentRoundsWon--;
      tournamentData.currentMatch.opponentRoundsWon = opponentRoundsWon;
      tournamentData.currentMatch.roundHistory.pop();
      saveTournament(charId, tournamentData);
      // Restore streak from history (handleReady zeroed it on the loss).
      playerWinStreak = computeStreak(tournamentData.currentMatch.roundHistory);
      replayRound();
      return;
    }

    // Project Hail Mary: instant match win on round win — bypass drops entirely
    if (roundInstantMatchWin && lastRoundResult === 'player') {
      playerRoundsWon = roundsToWin;
      tournamentData.currentMatch.playerRoundsWon = playerRoundsWon;
      saveTournament(charId, tournamentData);
      screenState = 'match_over';
      render();
      return;
    }

    // Compute drops first, regardless of match end (so end-of-match wins still
    // get their bonus drops). If match is over, advanceRound will route to
    // match_over instead of the next round.
    pendingMatchOver = playerRoundsWon >= roundsToWin || opponentRoundsWon >= roundsToWin;

    resolvedDrops = [];
    if (lastRoundResult === 'player') {
      appendRoundDrops();
    } else {
      earnedDrops = [];
      // Consolation Prize (FORTUNE.1.2): 30% chance Basic drop on player loss.
      if (lastRoundResult === 'opponent' && hasSkill('FORTUNE.1.2')
          && roll() < CONSOLATION_PRIZE_CHANCE) {
        earnedDrops.push(...generateBonusDrops([{ tier: 'Basic', count: 1 }], progress.treeState));
      }
    }
    appendLuckyPennyDrop();

    processNextDrop();
  }

  // Computes and pushes round-end drops onto earnedDrops:
  // (a) standard round-win drops based on calcDropCount + tree pool
  // (b) bonus drops queued by powerup effects (Cookies, streak spawners)
  function appendRoundDrops() {
    earnedDrops = [];

    // (a) standard drops from win count
    const multiplier = getDropMultiplier(progress.treeState);
    const count      = calcDropCount(playerRoundsWon, multiplier);
    earnedDrops.push(...generateDrops(count, progress.treeState));

    // (b) bonus drops from round-scope effects (Cookies)
    if (roundBonusOnWin.length > 0) {
      earnedDrops.push(...generateBonusDrops(roundBonusOnWin, progress.treeState));
    }

    // (c) streak-driven drops from match/tournament/season scope effects
    const streakSpecs = computeStreakAwards(playerWinStreak);
    if (streakSpecs.length > 0) {
      earnedDrops.push(...generateBonusDrops(streakSpecs, progress.treeState));
    }
  }

  // Lucky Penny resolves independently of round outcome (per design).
  function appendLuckyPennyDrop() {
    if (!matchLuckyPenny || !roundLuckyPennyCall) return;
    const flip = randomCoinFlip();
    if (flip === roundLuckyPennyCall) {
      earnedDrops.push(...generateBonusDrops([{ tier: 'Basic', count: 1 }], progress.treeState));
    }
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
    // If we were holding match-end drops, skip to match_over now
    if (pendingMatchOver) {
      pendingMatchOver = false;
      screenState = 'match_over';
      render();
      return;
    }

    roundNumber++;
    // Decrement active-skill cooldowns for the new round.
    if (tmlCooldownRemaining > 0) tmlCooldownRemaining--;
    resetRoundScopeState();
    screenState = 'picking';
    render();
  }

  // Mystic Pizza replay — return to picking phase WITHOUT incrementing round number
  function replayRound() {
    resetRoundScopeState();
    screenState = 'picking';
    render();
  }

  function resetRoundScopeState() {
    currentThrow             = null;
    pendingOpponentThrow     = null;
    changedMyMindUsed        = false;
    roundForceWin            = false;
    roundForceLoss           = false;
    roundInstantMatchWin     = false;
    roundLockThrow           = false;
    roundOtherUsesDisabled   = false;
    roundBonusOnWin          = [];
    roundLuckyPennyCall      = null;
    roundDizzySpell          = false;
    roundMysticPizza         = false;
    roundCanChangeThrow      = false;
    roundActiveSkillUsed     = false;
    roundTmlPending          = null;
    roundRead                = null;
    roundStrategyRead        = null;
    roundActivated           = [];
    popupPowerup             = null;
  }

  // ── Active skill: Trust My Luck (FORTUNE.1.1) ────────────────────────────────

  function handleTrustMyLuck() {
    if (!hasSkill('FORTUNE.1.1'))      return;
    if (tmlCooldownRemaining > 0)      return;
    if (roundActiveSkillUsed)          return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    const success = roll() < TML_SUCCESS_CHANCE;
    if (success) {
      roundForceWin    = true;
      roundTmlPending  = 'success';
    } else {
      roundForceLoss   = true;
      roundTmlPending  = 'failure';
    }
    roundActiveSkillUsed   = true;
    tmlCooldownRemaining   = TML_COOLDOWN_ROUNDS;
    roundActivated.push(success ? 'TML Succeeded' : 'TML Failed');
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
