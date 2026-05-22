import { navigate, getNpcById, getAllNpcs } from '../main.js';
import { runCountdown } from '../animations/countdown.js';
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
  NPR_ACCUMULATION_PER_ROUND, NPR_FALSE_RESULT_CHANCE, NPR_ADVANCED_ACCUMULATION,
  TWEAK_REALITY_CHANCE, ALTER_REALITY_CHANCE, CONSOLATION_PRIZE_CHANCE,
  TML_SUCCESS_CHANCE, TML_COOLDOWN_ROUNDS, ATML_COOLDOWN_ROUNDS,
  LUCKY_SOCKS_TML_CHANCE, FINGERS_CROSSED_TML_CHANCE,
  THIRD_TIMES_CHARM_BOOST, DUE_FOR_A_WIN_BOOST,
  FORCE_YOUR_HAND_CHANCE, FORCE_YOUR_HAND_COOLDOWN_ROUNDS, TWIST_YOUR_ARM_COOLDOWN_ROUNDS,
  CHANGE_MY_LUCK_COOLDOWN_ROUNDS, BRAIN_FART_COOLDOWN_ROUNDS,
  MENTAL_MYSTICISM_CHANCE, MENTAL_MYSTICISM_COOLDOWN_ROUNDS,
  REFUSE_TO_LOSE_CHANCE, REFUSE_TO_LOSE_COOLDOWN_ROUNDS,
  IGAH_CHANCE, IGAH_READ_ACCURACY, IGAH_COOLDOWN_ROUNDS,
  REVERSAL_OF_FORTUNE_COOLDOWN_ROUNDS,
  LOOK_WHAT_I_FOUND_CHANCE,
  LUCKY_CHARM_COOLDOWN_ROUNDS,
  PROBABILITY_STORM_CHANCE,
  NOT_TODAY_COOLDOWN_ROUNDS,
  MASSIVE_BRAIN_FART_COOLDOWN_ROUNDS,
  PHANTOM_MEMORY_COOLDOWN_ROUNDS,
  DESPERATE_CLARITY_NPR_BOOST,
  NEURAL_SCAN_COOLDOWN_MATCHES, NEURAL_SCAN_2_COOLDOWN_MATCHES,
  READING_GLASSES_CHANCE, SMART_GLASSES_CHANCE, COURTSIDE_CHANCE,
  SKILL_NODE_INFO, SKILL_TREE_INFO, JESSIE_TUTORIAL_DIALOGUE,
  NPC_STRATEGY_DESCRIPTION,
} from '../constants.js';
import {
  loadSession, loadIdentity, loadProgress, saveProgress,
  loadStats, saveStats, loadTournament, saveTournament, loadWorld,
  loadTrophies, saveTrophies,
} from '../storage.js';
import { showJessieDialogue, tutorialBeatShown, markTutorialBeat } from '../ui/jessieDialogue.js';

const THROW_NAME = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };

function strategyDesc(strategy) {
  return NPC_STRATEGY_DESCRIPTION[strategy] ?? `Strategy: ${strategy}`;
}
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
  let roundLockThrow         = false;   // throw is system-decided this round (cookies, Pandora, Hail Mary)
  let roundPandorasBoxActive = false;   // Pandora's Box: reset all active cooldowns on round win
  let roundOtherUsesDisabled = false;   // Project Hail Mary disables other USEs this round
  let roundBonusOnWin      = [];      // [{tier, count}] queued for award if round won
  let roundLuckyPennyCall  = null;    // 'heads' | 'tails' (set during gut_check)
  let roundLuckyPennyResult = null;  // { call, flip, won } — set at resolution for reveal display
  let roundDizzySpell      = false;   // NPC throws random just this round
  let roundMysticPizza     = false;   // round will replay if it ends in a player loss
  let roundForceLoss       = false;   // TML failure: result forced to opponent
  let roundActiveSkillUsed = false;   // one active skill per round limit (FORTUNE.1.1 etc.)
  let roundTmlPending      = null;    // 'success' | 'failure' | null — display TML outcome
  let roundCanChangeThrow  = false;   // any reveal effect granted throw-change ability
  let roundRead            = null;    // { source, throwName } — informational read shown in gut_check
  let roundStrategyRead    = null;    // { source, strategy, accurate } — NPR strategy reveal
  let roundActivated       = [];      // names of powerups activated this round (display)
  let roundEspressoShotActive     = false; // Espresso Shot activated this round
  let roundEspressoShotBonus      = null;  // player's chosen backup throw (null until picked)
  let roundWordFromCoachElim      = null;  // throw eliminated by A Word From Your Coach (string | null)
  let roundSchrodingerOriginalThrow = null; // throw at Schrödinger's Amulet activation
  let roundProteinShakeOriginalThrow = null; // throw at Protein Shake activation (null = not used)
  let proteinShakeBonus = false;             // set in handleReady, read in handleAdvanceFromReveal

  // Per-match state (in-memory)
  let matchHotSauce          = false;
  let matchThreesCompany     = false;
  let matchThreesCompanyDone = false;
  let matchLuckyPenny        = false;
  let matchTabulaRasa        = false;   // NPC throws random all match
  let matchHiccupPotion      = false;   // NPC throws random every 3rd round
  let matchFocusGroup        = false;   // 65% per-round NPC-throw hint
  let matchFocusedFG         = false;   // 80% per-round NPC-throw hint
  let matchWordFromCoach      = false;  // A Word From Your Coach: eliminate one wrong throw per round
  let matchMysticPizza       = false;   // available "rewind on loss" charge (consumed on use)
  let matchPizzaUsedThisRound = false;  // prevents infinite replay

  // L2 skill state
  let nprAccumulation      = 0;         // MIND.1.1 — % per round, resets on fire/match start
  let hasNPRFiredThisMatch = false;     // for v1.0 Mental Mysticism precondition
  let tmlCooldownRemaining = 0;         // FORTUNE.1.1 — rounds before TML usable again

  // L3 skill state — MIND
  // Neural Scan cross-match cooldown — loaded from persistent crossMatchState.
  // Default to cooldown value (= ready) when no prior use recorded.
  const _nsCooldown = () => Boolean(progress.treeState?.MIND?.['MIND.1.1.1.1'])
    ? NEURAL_SCAN_2_COOLDOWN_MATCHES : NEURAL_SCAN_COOLDOWN_MATCHES;
  let neuralScanMatchesSinceLastUse =
    (progress.crossMatchState?.neuralScanMatchesSinceLastUse ?? _nsCooldown());
  let consecutiveLosses       = 0;      // MIND.1.1.2 Desperate Clarity tracker
  let desperateClarityBonus   = 0;      // permanent NPR floor added by Desperate Clarity
  let desperateClarityApplied = false;  // one-time trigger per match
  let memoryWipeUsed          = false;  // MIND.1.2.1 — once per match

  // L3 skill state — MYSTIC
  let thirdTimesCharmFails    = 0;      // MYSTIC.1.1.2 — consecutive failed tie conversions
  let thirdTimesCharmUsed     = false;  // one-time per match
  let tieIsImmune             = false;  // future Refuse to Lose — blocks all tie-altering skills

  // L3 skill state — FORTUNE
  let dueForAWinFails         = 0;      // FORTUNE.1.1.2 — consecutive TML failures
  let dueForAWinUsed          = false;  // one-time per match
  let forceYourHandCooldown   = 0;      // MYSTIC.1.1.1 (Force Your Hand) / MYSTIC.1.1.1.1 (Twist Your Arm)
  let roundForceHandActive    = false;  // per-round: Force Your Hand / Twist Your Arm armed
  let changeMyLuckCooldown    = 0;      // FORTUNE.1.2.1 (Change My Luck)
  let brainFartCooldown       = 0;      // MYSTIC.1.2.1 (no-op until NPC active skills)
  let roundChangeMyLuckActive = false;  // FORTUNE.1.2.1 — armed; 2 drops if round lost

  // L4 skill state
  let mentalMysticismCooldown    = 0;   // MIND.1.1.2.1
  let roundMentalMysticismActive = false; // armed this round
  let refuseToLoseCooldown    = 0;      // MYSTIC.1.1.2.1
  let roundRefuseToLoseActive = false;  // armed this round
  let igahCooldown            = 0;      // FORTUNE.1.1.2.1
  let reversalOfFortuneCooldown = 0;    // FORTUNE.1.2.1.1
  let roundReversalActive     = false;  // armed this round
  let luckyCharmCooldown      = 0;      // FORTUNE.1.2.2.1 (no-op until NPC MYSTIC skills)
  let notTodayCooldown        = 0;      // MIND.1.2.2.1 (no-op until NPC TML)
  let massiveBrainFartCooldown = 0;     // MYSTIC.1.2.1.1 (no-op)
  let phantomMemoryCooldown   = 0;      // MYSTIC.1.2.2.1 (no-op)
  let totalRecallUsed         = false;  // MIND.1.2.1.1 — once per match (extends Memory Wipe)
  let playerWinStreak        = computeStreak(tournamentData.currentMatch.roundHistory ?? []);
  // Tracks per-effect "already-awarded-at" thresholds for the current streak run.
  // Reset whenever streak resets to 0 (after a non-win round).
  let streakAwardedFlags = {};

  // Post-reveal drop state
  let earnedDrops      = [];
  let resolvedDrops    = [];
  let overflowDrop     = null;
  let pendingMatchOver = false;  // set when match ends but drops remain to show
  let matchStartPhase  = false;  // true while delivering Jonesing to Help drops at match start

  // Revealing state
  let lastPlayerThrow   = null;
  let lastOpponentThrow = null;
  let lastRoundResult   = null;

  // Popup state — which powerup or skill detail card is open (or null)
  let popupPowerup = null;
  let skillPopup   = null; // nodeId of skill to inspect, or null

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
        const inRound    = screenState === 'picking' || screenState === 'gut_check';
        let dotClass = '';
        if (inRound) {
          const usability = isUsableNow(pu);
          if (usability.ok) {
            const phase = POWERUP_BY_NAME[pu.name]?.activationPhase ?? 'either';
            dotClass = (phase === 'gut_check' && screenState === 'picking')
              ? 'pu-status-dot--gutcheck'
              : 'pu-status-dot--ready';
          } else {
            dotClass = 'pu-status-dot--unavailable';
          }
        }
        const dotHTML = dotClass ? `<div class="pu-status-dot ${dotClass}"></div>` : '';
        slots.push(`
          <div class="pu-slot pu-slot--filled ${phaseClass}" data-inspect="${pu.instanceId}" title="${pu.name}">
            ${dotHTML}
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
    if (pu.name === 'A Word From Your Coach' && matchWordFromCoach) return { ok: false, note: 'Already active this match' };
    if (pu.name === 'Reading Glasses'       && tournamentEffectActive('Reading Glasses'))       return { ok: false, note: 'Already active this tournament' };
    if (pu.name === 'Courtside with Jessie' && tournamentEffectActive('Courtside with Jessie')) return { ok: false, note: 'Already active this tournament' };
    if (pu.name === 'Cuckoo Clock'          && tournamentEffectActive('Cuckoo Clock'))          return { ok: false, note: 'Already active this tournament' };
    if (pu.name === 'Smart Glasses'         && seasonEffectActive('Smart Glasses'))             return { ok: false, note: 'Already active this season' };
    if (pu.name === 'Jonesing to Help'      && seasonEffectActive('Jonesing to Help'))         return { ok: false, note: 'Already active this season' };

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
    if (matchWordFromCoach)                         list.push('COACH TIP');
    if (tournamentEffectActive('Ghost Pepper'))     list.push('GHOST PEPPER');
    if (tournamentEffectActive('Carolina Reaper'))  list.push('CAROLINA REAPER');
    if (tournamentEffectActive('Reading Glasses'))  list.push('READING GLASSES');
    if (tournamentEffectActive('Courtside with Jessie')) list.push('COURTSIDE');
    if (tournamentEffectActive('Cuckoo Clock'))     list.push('CUCKOO CLOCK');
    if (seasonEffectActive('The Ballad of Jessie Jones')) list.push('BALLAD OF JJ');
    if (seasonEffectActive('Smart Glasses'))        list.push('SMART GLASSES');
    if (seasonEffectActive('Jonesing to Help'))     list.push('JONESING');
    if (list.length === 0) return '';
    return `
      <p class="snes-small snes-success" style="font-size:5px;text-align:center">
        ★ ACTIVE: ${list.join(' · ')}
      </p>
    `;
  }

  // Renders a pip string showing cooldown remaining vs total, e.g. "3r ■■■□□"
  function cdPips(remaining, total) {
    if (remaining <= 0) return 'READY';
    const pips = Array.from({ length: total }, (_, i) => i < remaining ? '■' : '□').join('');
    return `${remaining}r ${pips}`;
  }

  // Returns state for a single active skill node.
  // cdRemaining/cdTotal are the raw cooldown values used for the gradient visual.
  function getActiveSkillState(nodeId) {
    switch (nodeId) {
      case 'FORTUNE.1.1': {
        const ready    = tmlCooldownRemaining === 0 && !roundActiveSkillUsed;
        const usedThis = roundTmlPending !== null;
        const cdTotal  = TML_COOLDOWN_ROUNDS;
        const cdLabel  = cdPips(tmlCooldownRemaining, cdTotal);
        let btnLabel = '▶ USE';
        if (usedThis) btnLabel = roundTmlPending === 'success' ? '✓ SUCCEEDED' : '✗ FAILED';
        return { ready, cdLabel, btnLabel, btnId: 'btn-tml', cdRemaining: tmlCooldownRemaining, cdTotal };
      }
      case 'FORTUNE.1.1.1.1': {
        const ready    = tmlCooldownRemaining === 0 && !roundActiveSkillUsed;
        const usedThis = roundTmlPending !== null;
        const cdTotal  = ATML_COOLDOWN_ROUNDS;
        const cdLabel  = cdPips(tmlCooldownRemaining, cdTotal);
        let btnLabel = '▶ ATML';
        if (usedThis) btnLabel = roundTmlPending === 'success' ? '✓ SUCCEEDED' : '✗ FAILED';
        return { ready, cdLabel, btnLabel, btnId: 'btn-tml', cdRemaining: tmlCooldownRemaining, cdTotal };
      }
      case 'MIND.1.1.1': {
        const cooldown    = hasSkill('MIND.1.1.1.1') ? NEURAL_SCAN_2_COOLDOWN_MATCHES : NEURAL_SCAN_COOLDOWN_MATCHES;
        const ready       = neuralScanMatchesSinceLastUse >= cooldown && !roundActiveSkillUsed;
        const matchesLeft = cooldown - neuralScanMatchesSinceLastUse;
        const cdLabel     = ready ? 'READY' : `${matchesLeft}m ` + Array.from({ length: cooldown }, (_, i) => i < matchesLeft ? '■' : '□').join('');
        return { ready, cdLabel, btnLabel: '▶ SCAN', btnId: 'btn-neural-scan', cdRemaining: matchesLeft, cdTotal: cooldown };
      }
      case 'MIND.1.2.1': {
        const ready = !memoryWipeUsed && !roundActiveSkillUsed;
        return { ready, cdLabel: memoryWipeUsed ? 'USED' : 'READY', btnLabel: '▶ WIPE', btnId: 'btn-memory-wipe', cdRemaining: null, cdTotal: null };
      }
      case 'MYSTIC.1.1.1': {
        const cdTotal = hasSkill('MYSTIC.1.1.1.1') ? TWIST_YOUR_ARM_COOLDOWN_ROUNDS : FORCE_YOUR_HAND_COOLDOWN_ROUNDS;
        const ready   = forceYourHandCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(forceYourHandCooldown, cdTotal);
        const used    = roundForceHandActive;
        return { ready: ready && !used, cdLabel, btnLabel: used ? '✓ ARMED' : '▶ USE', btnId: 'btn-force-hand', cdRemaining: forceYourHandCooldown, cdTotal };
      }
      case 'MYSTIC.1.1.1.1': {
        const cdTotal = TWIST_YOUR_ARM_COOLDOWN_ROUNDS;
        const ready   = forceYourHandCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(forceYourHandCooldown, cdTotal);
        const used    = roundForceHandActive;
        return { ready: ready && !used, cdLabel, btnLabel: used ? '✓ ARMED' : '▶ USE', btnId: 'btn-force-hand', cdRemaining: forceYourHandCooldown, cdTotal };
      }
      case 'FORTUNE.1.2.1': {
        const cdTotal = CHANGE_MY_LUCK_COOLDOWN_ROUNDS;
        const ready   = changeMyLuckCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(changeMyLuckCooldown, cdTotal);
        const used    = roundChangeMyLuckActive;
        return { ready: ready && !used, cdLabel, btnLabel: used ? '✓ ARMED' : '▶ USE', btnId: 'btn-change-luck', cdRemaining: changeMyLuckCooldown, cdTotal };
      }
      case 'MYSTIC.1.2.1': {
        const cdTotal = BRAIN_FART_COOLDOWN_ROUNDS;
        const ready   = brainFartCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(brainFartCooldown, cdTotal);
        return { ready, cdLabel, btnLabel: '▶ USE', btnId: 'btn-brain-fart', cdRemaining: brainFartCooldown, cdTotal };
      }
      case 'MYSTIC.1.2.1.1': {
        const cdTotal = MASSIVE_BRAIN_FART_COOLDOWN_ROUNDS;
        const ready   = massiveBrainFartCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(massiveBrainFartCooldown, cdTotal);
        return { ready, cdLabel, btnLabel: '▶ USE', btnId: 'btn-massive-brain-fart', cdRemaining: massiveBrainFartCooldown, cdTotal };
      }
      case 'MIND.1.1.2.1': {
        const canUse  = hasNPRFiredThisMatch;
        const cdTotal = MENTAL_MYSTICISM_COOLDOWN_ROUNDS;
        const ready   = canUse && mentalMysticismCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = mentalMysticismCooldown > 0
          ? cdPips(mentalMysticismCooldown, cdTotal)
          : (canUse ? 'READY' : 'NEEDS NPR');
        const used = roundMentalMysticismActive;
        return { ready: ready && !used, cdLabel, btnLabel: used ? '✓ ARMED' : '▶ USE', btnId: 'btn-mental-mysticism', cdRemaining: mentalMysticismCooldown, cdTotal };
      }
      case 'MYSTIC.1.1.2.1': {
        const cdTotal = REFUSE_TO_LOSE_COOLDOWN_ROUNDS;
        const ready   = refuseToLoseCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(refuseToLoseCooldown, cdTotal);
        const used    = roundRefuseToLoseActive;
        return { ready: ready && !used, cdLabel, btnLabel: used ? '✓ ARMED' : '▶ USE', btnId: 'btn-refuse-to-lose', cdRemaining: refuseToLoseCooldown, cdTotal };
      }
      case 'FORTUNE.1.1.2.1': {
        const cdTotal = IGAH_COOLDOWN_ROUNDS;
        const ready   = igahCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(igahCooldown, cdTotal);
        return { ready, cdLabel, btnLabel: '▶ HUNCH', btnId: 'btn-igah', cdRemaining: igahCooldown, cdTotal };
      }
      case 'FORTUNE.1.2.1.1': {
        const cdTotal = REVERSAL_OF_FORTUNE_COOLDOWN_ROUNDS;
        const ready   = reversalOfFortuneCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(reversalOfFortuneCooldown, cdTotal);
        const used    = roundReversalActive;
        return { ready: ready && !used, cdLabel, btnLabel: used ? '✓ ARMED' : '▶ USE', btnId: 'btn-reversal', cdRemaining: reversalOfFortuneCooldown, cdTotal };
      }
      case 'FORTUNE.1.2.2.1': {
        const cdTotal = LUCKY_CHARM_COOLDOWN_ROUNDS;
        const ready   = luckyCharmCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(luckyCharmCooldown, cdTotal);
        return { ready, cdLabel, btnLabel: '▶ USE', btnId: 'btn-lucky-charm', cdRemaining: luckyCharmCooldown, cdTotal };
      }
      case 'MIND.1.2.1.1': {
        const ready = !totalRecallUsed && !roundActiveSkillUsed;
        return { ready, cdLabel: totalRecallUsed ? 'USED' : 'READY', btnLabel: '▶ RECALL', btnId: 'btn-memory-wipe', cdRemaining: null, cdTotal: null };
      }
      case 'MIND.1.2.2.1': {
        const cdTotal = NOT_TODAY_COOLDOWN_ROUNDS;
        const ready   = notTodayCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(notTodayCooldown, cdTotal);
        return { ready, cdLabel, btnLabel: '▶ USE', btnId: 'btn-not-today', cdRemaining: notTodayCooldown, cdTotal };
      }
      case 'MYSTIC.1.2.2.1': {
        const cdTotal = PHANTOM_MEMORY_COOLDOWN_ROUNDS;
        const ready   = phantomMemoryCooldown === 0 && !roundActiveSkillUsed;
        const cdLabel = cdPips(phantomMemoryCooldown, cdTotal);
        return { ready, cdLabel, btnLabel: '▶ USE', btnId: 'btn-phantom-memory', cdRemaining: phantomMemoryCooldown, cdTotal };
      }
      default:
        return { ready: false, cdLabel: '—', btnLabel: '▶ USE', btnId: `btn-skill-${nodeId}`, cdRemaining: null, cdTotal: null };
    }
  }

  // Skills panel — lists every purchased active skill with its cooldown and USE button.
  // Driven by SKILL_NODE_INFO so it picks up future L3/L4 actives automatically.
  function renderSkillsPanel() {
    // Collect all purchased active skill node ids.
    // Suppress parent skills when a replacing L4 is owned (shared button/tracker).
    const activeSkills = Object.entries(SKILL_NODE_INFO)
      .filter(([id, info]) => info.kind === 'active' && hasSkill(id))
      .filter(([id]) => {
        if (id === 'MIND.1.1.1'   && hasSkill('MIND.1.1.1.1'))   return false; // NS 2.0 replaces NS
        if (id === 'MYSTIC.1.1.1' && hasSkill('MYSTIC.1.1.1.1')) return false; // Twist Your Arm replaces FYH
        if (id === 'FORTUNE.1.1'  && hasSkill('FORTUNE.1.1.1.1')) return false; // ATML replaces TML
        if (id === 'MIND.1.2.1'   && hasSkill('MIND.1.2.1.1'))   return false; // Total Recall replaces Memory Wipe
        return true;
      })
      .map(([id, info]) => ({ id, name: info.name }));

    if (activeSkills.length === 0) return '';

    const cards = activeSkills.map(({ id, name }) => {
      const { ready, cdLabel, btnLabel, btnId, cdRemaining, cdTotal } = getActiveSkillState(id);

      // Proportional cooldown gradient: left portion shows elapsed (darker blue), right shows remaining (very dark)
      let btnStyle = 'font-size:7px;padding:7px 12px';
      let btnCls   = 'snes-btn';
      if (ready) {
        btnCls += ' snes-btn-yellow';
      } else if (cdRemaining > 0 && cdTotal > 0) {
        const elapsedPct = Math.round(((cdTotal - cdRemaining) / cdTotal) * 100);
        btnStyle += `;background:linear-gradient(to right,#2a2a5a 0%,#2a2a5a ${elapsedPct}%,#0a0a18 ${elapsedPct}%,#0a0a18 100%);border-color:#5050b8;color:#8888d8;cursor:not-allowed`;
      } else {
        btnStyle += ';opacity:0.35;cursor:not-allowed';
      }

      return `
        <div style="display:flex;align-items:center;gap:10px;
                    padding:8px 12px;background:var(--snes-panel-dark);
                    border:2px solid ${ready ? 'var(--snes-yellow)' : 'var(--snes-border)'};
                    border-radius:2px;cursor:pointer"
             data-skill-inspect="${id}">
          <div style="flex:1;min-width:0">
            <p class="snes-small" style="font-size:7px;color:${ready ? 'var(--snes-yellow)' : 'var(--snes-text)'}">
              ${name.toUpperCase()}
            </p>
            <p class="snes-small snes-muted" style="font-size:5px;margin-top:3px">
              ⚡ ACTIVE · ${cdLabel}
            </p>
          </div>
          <button class="${btnCls}" id="${btnId}"
                  style="${btnStyle}"
                  ${ready ? '' : 'disabled'}>
            ${btnLabel}
          </button>
        </div>
      `;
    }).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:6px">
        <p class="snes-small snes-muted" style="font-size:6px">ACTIVE SKILLS</p>
        ${cards}
      </div>
    `;
  }

  // NPR accumulation indicator (L2 MIND.1.1 passive).
  function renderNPRIndicator() {
    if (!hasSkill('MIND.1.1')) return '';
    const pct    = Math.round(nprAccumulation * 100);
    const fillPct  = Math.min(100, pct);
    const dcBonus  = desperateClarityBonus > 0 ? Math.round(desperateClarityBonus * 100) : 0;
    const nearFire = fillPct >= 70 && fillPct < 100;
    const fillClass = nearFire ? 'npr-bar-fill npr-bar-fill--near' : 'npr-bar-fill';
    const floorStyle = dcBonus > 0
      ? `left:${dcBonus}%;width:${Math.max(0, fillPct - dcBonus)}%;`
      : `left:0;width:${fillPct}%;`;
    const floorBarHTML = dcBonus > 0
      ? `<div class="npr-bar-fill" style="left:0;width:${Math.min(dcBonus, fillPct)}%;opacity:0.5;"></div>`
      : '';
    const label = pct >= 100
      ? `<span class="snes-success" style="font-size:5px">★ NPR READY!</span>`
      : `<span class="snes-muted" style="font-size:5px">NPR: ${pct}%${dcBonus > 0 ? ` (+${dcBonus}% floor)` : ''}</span>`;
    return `
      <div style="display:flex;flex-direction:column;gap:3px">
        ${label}
        <div class="npr-bar-track">
          ${floorBarHTML}
          <div class="${fillClass}" style="${floorStyle}"></div>
          <div class="npr-bar-threshold" style="left:90%"></div>
        </div>
      </div>
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
          ${strategyDesc(strategy)}
          <span class="snes-muted">(${accurate ? '90' : 'low'}% confidence)</span>
        </p>
      </div>
    `;
  }

  // ── Skill info helpers ───────────────────────────────────────────────────────

  // Returns a short status string (and muted flag) for any passive/root skill.
  function getPassiveSkillStatus(nodeId) {
    switch (nodeId) {
      case 'MIND.1':       return { status: '5 powerup slots · 4B+1A starting loadout', muted: false };
      case 'MIND.1.2':     return { status: 'NPC cannot see your last 2 throws', muted: false };
      case 'MIND.1.1.2': {
        const pct = Math.round(DESPERATE_CLARITY_NPR_BOOST * 100);
        if (desperateClarityApplied)
          return { status: `NPR floor: +${pct}% applied this match`, muted: false };
        return { status: `${consecutiveLosses}/2 consecutive losses · triggers at 2`, muted: consecutiveLosses === 0 };
      }
      case 'MIND.1.2.2':   return { status: '50% block vs NPC TML/ATML (awaiting NPC)', muted: true };
      case 'MIND.1.1.1.2': return { status: 'NPR: +15%/round instead of +10%', muted: false };
      case 'MIND.1.1.2.2': return { status: '+10% Adv · +5% Leg upgrade chance on drops', muted: false };
      case 'MIND.1.2.1.2': return { status: 'NPC strategy locked 3 rounds after purge (awaiting NPC patterns)', muted: true };
      case 'MIND.1.2.2.2': return { status: 'Upgrades Cooler: 50% → 75% block vs NPC TML (awaiting NPC)', muted: true };
      case 'MYSTIC.1':     return { status: '+15% tier upgrade · +5% Legendary on round-win drops', muted: false };
      case 'MYSTIC.1.1': {
        const pct = Math.round(TWEAK_REALITY_CHANCE * 100);
        return { status: `Ties: ${pct}% → player win`, muted: false };
      }
      case 'MYSTIC.1.2':   return { status: 'Counters NPC active skills (awaiting NPC)', muted: true };
      case 'MYSTIC.1.1.2': {
        if (thirdTimesCharmUsed)
          return { status: '95% boost used this match', muted: false };
        if (thirdTimesCharmFails >= 2)
          return { status: `${thirdTimesCharmFails} failed — 95% boost READY`, muted: false };
        return { status: `${thirdTimesCharmFails}/2 failed tie conversions`, muted: thirdTimesCharmFails === 0 };
      }
      case 'MYSTIC.1.1.1.2': {
        const pct = Math.round(ALTER_REALITY_CHANCE * 100);
        return { status: `Ties: ${pct}% → player win (upgrades Tweak Reality)`, muted: false };
      }
      case 'MYSTIC.1.1.2.2': return { status: '50% chance: non-Basic drop yields 2 copies', muted: false };
      case 'MYSTIC.1.2.2':   return { status: '50% block vs NPC NPR/Neural Scan (awaiting NPC)', muted: true };
      case 'MYSTIC.1.2.1.2': return { status: '25% chance NPC powerup activates for you (awaiting NPC)', muted: true };
      case 'MYSTIC.1.2.2.2': return { status: '90% block vs NPC NPR/Neural Scan (awaiting NPC)', muted: true };
      case 'FORTUNE.1':      return { status: '2× powerup drop rate per round', muted: false };
      case 'FORTUNE.1.1.1': {
        const pct = Math.round(LUCKY_SOCKS_TML_CHANCE * 100);
        return { status: `TML/ATML success: ${pct}%`, muted: false };
      }
      case 'FORTUNE.1.1.2': {
        if (dueForAWinUsed)
          return { status: '95% boost used this match', muted: false };
        if (dueForAWinFails >= 2)
          return { status: `${dueForAWinFails} TML failures — 95% boost READY`, muted: false };
        return { status: `${dueForAWinFails}/2 TML failures`, muted: dueForAWinFails === 0 };
      }
      case 'FORTUNE.1.2': {
        const pct = Math.round(CONSOLATION_PRIZE_CHANCE * 100);
        return { status: `${pct}% drop on round loss`, muted: false };
      }
      case 'FORTUNE.1.1.1.2': return { status: 'TML/ATML success: 95% (replaces Lucky Socks)', muted: false };
      case 'FORTUNE.1.1.2.2': return { status: 'Choose 1 of 2 on every drop (awaiting implementation)', muted: true };
      case 'FORTUNE.1.2.1.2': {
        const pct = Math.round(LOOK_WHAT_I_FOUND_CHANCE * 100);
        return { status: `${pct}% extra drop chance on round loss`, muted: false };
      }
      case 'FORTUNE.1.2.2':   return { status: '50% block vs NPC MYSTIC tie-altering (awaiting NPC)', muted: true };
      case 'FORTUNE.1.2.2.2': return { status: '90% block vs NPC MYSTIC tie-altering (awaiting NPC)', muted: true };
      default:
        return { status: SKILL_NODE_INFO[nodeId]?.effect ?? '', muted: false };
    }
  }

  // Passive skill cards shown during picking + gut_check. Each card is tappable for inspect.
  function renderPassiveSkillsPanel() {
    const passiveNodes = Object.entries(SKILL_NODE_INFO)
      .filter(([id, info]) => {
        if (!hasSkill(id)) return false;
        if (id === 'MIND.1.1') return false; // NPR handled by renderNPRIndicator
        if (info.kind === 'active') return false;
        return true;
      })
      .filter(([id]) => {
        // Suppress passives that have been replaced by an upgrade
        if (id === 'MYSTIC.1.1'    && hasSkill('MYSTIC.1.1.1.2'))  return false; // Tweak→Alter Reality
        if (id === 'FORTUNE.1.1.1' && hasSkill('FORTUNE.1.1.1.2')) return false; // Lucky Socks→Fingers Crossed
        if (id === 'MYSTIC.1.2.2'  && hasSkill('MYSTIC.1.2.2.2'))  return false; // Mind Shield→Mind Fortress
        if (id === 'FORTUNE.1.2.2' && hasSkill('FORTUNE.1.2.2.2')) return false; // Oblivious→Totes Oblivious
        if (id === 'MIND.1.2.2'    && hasSkill('MIND.1.2.2.2'))    return false; // Cooler→Freezer
        return true;
      });

    if (passiveNodes.length === 0) return '';

    const cards = passiveNodes.map(([id, info]) => {
      const name = info.level === 1 ? (info.rootName ?? info.name) : info.name;
      const { status, muted } = getPassiveSkillStatus(id);
      return `
        <div style="display:flex;align-items:center;gap:8px;
                    padding:6px 10px;background:var(--snes-panel-dark);
                    border:2px solid var(--snes-border);border-radius:2px;cursor:pointer"
             data-skill-inspect="${id}">
          <div style="flex:1;min-width:0">
            <p class="snes-small" style="font-size:6px">${name.toUpperCase()}</p>
            <p style="font-family:var(--font-readable);font-size:11px;margin-top:2px;
               color:${muted ? 'var(--snes-muted)' : 'var(--snes-text)'}">
              ◉ PASSIVE · ${status}
            </p>
          </div>
          <span class="snes-small snes-muted" style="font-size:8px;flex-shrink:0">ℹ</span>
        </div>
      `;
    }).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:4px">
        <p class="snes-small snes-muted" style="font-size:6px">PASSIVE SKILLS</p>
        ${cards}
      </div>
    `;
  }

  // Skill inspect popup — shown when player taps any skill card.
  function renderSkillPopup(nodeId) {
    const info = SKILL_NODE_INFO[nodeId];
    if (!info) return '';
    const name   = info.level === 1 ? (info.rootName ?? info.name) : info.name;
    const effect = info.level === 1 ? (info.rootEffect ?? info.effect ?? '') : (info.effect ?? '');
    const isActive   = info.kind === 'active';
    const kindBadge  = isActive ? '⚡ ACTIVE' : '◉ PASSIVE';
    const treeColor  = SKILL_TREE_INFO[info.tree]?.color ?? 'var(--snes-text)';

    let statusHTML = '';
    if (isActive) {
      const ss = getActiveSkillState(nodeId);
      if (ss) {
        statusHTML = `
          <p class="snes-small" style="font-size:6px;margin-bottom:10px;
             color:${ss.ready ? 'var(--snes-yellow)' : 'var(--snes-muted)'}">
            ${ss.ready ? '▶ READY' : `⏳ ${ss.cdLabel}`}
          </p>
        `;
      }
    } else if (nodeId !== 'MIND.1.1') {
      const { status, muted } = getPassiveSkillStatus(nodeId);
      statusHTML = `
        <p class="snes-small" style="font-size:6px;margin-bottom:10px;
           color:${muted ? 'var(--snes-muted)' : 'var(--snes-success)'}">
          ${status}
        </p>
      `;
    }

    return `
      <div id="pu-popup-backdrop"></div>
      <div id="pu-popup">
        <div style="margin-bottom:12px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
            <p class="snes-label snes-highlight" style="font-size:8px;line-height:1.5;flex:1">${name.toUpperCase()}</p>
            <span class="pu-popup-type-badge pu-popup-type-badge--skill" style="background:var(--snes-blue);flex-shrink:0">
              ${kindBadge}
            </span>
          </div>
          <p class="snes-small snes-muted" style="font-size:5px">
            L${info.level} · ${info.tree}
          </p>
        </div>
        <p class="snes-small" style="font-size:6px;line-height:2;margin-bottom:10px;
           border-left:3px solid ${treeColor};padding-left:8px">${effect}</p>
        ${statusHTML}
        <button class="snes-btn" id="btn-skill-popup-close" style="width:100%;font-size:7px">
          ✕ CLOSE
        </button>
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
        ${renderSkillsPanel()}
        ${renderPassiveSkillsPanel()}
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
      const isFocusGroupRead = roundRead &&
        (roundRead.source === 'Focus Group' || roundRead.source === 'Focused Focus Group');
      const readMsg = !roundRead ? '' : isFocusGroupRead
        ? `Most of the crowd seems to be on your side — and right now, it looks like most of them want you to throw <span class="snes-highlight">${THROW_NAME[roundRead.throwName]}</span>.`
        : `They're throwing <span class="snes-highlight">${THROW_NAME[roundRead.throwName]}</span> <span class="snes-muted">(${roundRead.confidence}%)</span>`;
      const readHTML = roundRead ? `
        <div class="snes-panel" style="display:flex;align-items:center;gap:10px">
          <p class="snes-small snes-highlight" style="font-size:7px">★ READ</p>
          <p class="snes-small" style="flex:1;font-size:6px;line-height:1.5">
            <span class="snes-muted">${roundRead.source.toUpperCase()}:</span>
            ${readMsg}
          </p>
        </div>
      ` : '';

      // Schrödinger's Amulet: show original throw and whether player has changed yet
      const schrodingerHTML = roundSchrodingerOriginalThrow !== null ? `
        <div class="snes-panel" style="display:flex;align-items:center;gap:10px">
          <p class="snes-small snes-highlight" style="font-size:7px">★ AMULET</p>
          <p class="snes-small" style="flex:1;font-size:6px;line-height:1.5">
            ${currentThrow === roundSchrodingerOriginalThrow
              ? `Original: <span class="snes-highlight">${THROW_NAME[roundSchrodingerOriginalThrow]}</span>. Change throw — if either wins, you win!`
              : `Both <span class="snes-highlight">${THROW_NAME[roundSchrodingerOriginalThrow]}</span> &amp; <span class="snes-highlight">${THROW_NAME[currentThrow]}</span> count. If either wins, you win!`
            }
          </p>
        </div>
      ` : '';

      // A Word From Your Coach: show eliminated throw
      const coachHTML = roundWordFromCoachElim ? `
        <div class="snes-panel" style="display:flex;align-items:center;gap:10px">
          <p class="snes-small snes-highlight" style="font-size:7px">★ COACH</p>
          <p class="snes-small" style="flex:1;font-size:6px;line-height:1.5">
            Coach confirms: opponent is <strong>NOT</strong> throwing
            <span class="snes-highlight">${THROW_NAME[roundWordFromCoachElim]}</span>.
          </p>
        </div>
      ` : '';

      // Espresso Shot: picker when no backup chosen yet, confirmation once chosen
      const espressoHTML = !roundEspressoShotActive ? '' : roundEspressoShotBonus === null ? `
        <div class="snes-panel" style="display:flex;flex-direction:column;gap:6px">
          <p class="snes-small snes-highlight" style="font-size:7px;text-align:center">★ ESPRESSO SHOT — PICK BACKUP THROW</p>
          <p class="snes-small snes-muted" style="font-size:5px;text-align:center">Best of your two throws counts</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px">
            ${['rock','paper','scissors'].map(t => `
              <button class="throw-btn" data-espresso="${t}">
                <img src="assets/hands/${t}.png" alt="${t}" draggable="false">
                <span>${THROW_NAME[t]}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="snes-panel" style="display:flex;align-items:center;gap:10px">
          <p class="snes-small snes-highlight" style="font-size:7px">★ ESPRESSO</p>
          <p class="snes-small" style="flex:1;font-size:6px;line-height:1.5">
            Backup: <span class="snes-highlight">${THROW_NAME[roundEspressoShotBonus]}</span>.
            Best result counts!
          </p>
        </div>
      `;

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

      const readyDisabled = (matchLuckyPenny && roundLuckyPennyCall === null)
                         || (roundEspressoShotActive && roundEspressoShotBonus === null);
      const readyDisabledNote = !readyDisabled ? ''
        : (roundEspressoShotActive && roundEspressoShotBonus === null)
          ? `<p class="snes-small snes-muted" style="font-size:5px;text-align:center">Pick your backup throw first</p>`
          : `<p class="snes-small snes-muted" style="font-size:5px;text-align:center">Call heads or tails first</p>`;

      const activatedHTML = roundActivated.length > 0
        ? `<p class="snes-small snes-success" style="font-size:5px;text-align:center">★ ACTIVATED: ${roundActivated.map(n => n.toUpperCase()).join(' · ')}</p>`
        : '';

      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} · GUT CHECK ──</p>
        ${renderActiveEffects()}
        ${renderNPRIndicator()}
        ${roundTmlPending === null ? activatedHTML : ''}
        ${renderSkillsPanel()}
        ${renderPassiveSkillsPanel()}
        ${renderStrategyRead()}
        ${readHTML}
        ${schrodingerHTML}
        ${coachHTML}
        ${espressoHTML}
        ${roundTmlPending !== null
          ? (() => {
              const tmlCoinBlocked = matchLuckyPenny && roundLuckyPennyCall === null;
              return `<div class="snes-panel" style="text-align:center;display:flex;flex-direction:column;gap:12px;padding:20px 16px">
               <p class="snes-small snes-highlight" style="font-size:8px">⚡ TRUST MY LUCK</p>
               <p class="snes-small" style="font-size:6px;line-height:2.2">
                 You're trusting your luck and throwing whatever fortune decides.
               </p>
             </div>
             ${luckyPennyHTML}
             ${tmlCoinBlocked ? `<p class="snes-small snes-muted" style="font-size:5px;text-align:center">Call the coin flip first</p>` : ''}
             <button class="snes-btn snes-btn-yellow" id="btn-ready"
                     style="width:100%${tmlCoinBlocked ? ';opacity:0.4;cursor:not-allowed' : ''}"
                     ${tmlCoinBlocked ? 'disabled' : ''}>
               ▶ LET FORTUNE DECIDE
             </button>`;
            })()
          : `<div style="display:flex;align-items:center;justify-content:space-between">
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
             ${lockedNote}`
        }
        <p class="snes-small snes-muted" style="font-size:5px;text-align:center">Tap a powerup to inspect or use it</p>
      `;
    } else if (screenState === 'revealing') {
      const resultMsg   = lastRoundResult === 'player'   ? 'YOU WIN THIS ROUND!'
                        : lastRoundResult === 'opponent' ? 'YOU LOSE THIS ROUND.'
                        : 'TIE!';
      const resultColor = lastRoundResult === 'player'   ? 'snes-success'
                        : lastRoundResult === 'opponent' ? 'snes-error'
                        : 'snes-highlight';
      const revealActivatedHTML = roundActivated.length > 0
        ? `<p class="snes-small snes-success" style="font-size:5px;text-align:center">
             ★ ${roundActivated.map(n => n.toUpperCase()).join(' · ')}
           </p>`
        : '';
      bodyHTML = `
        <p class="snes-small snes-highlight" style="text-align:center">── ROUND ${roundNumber} ──</p>
        ${renderActiveEffects()}
        ${revealActivatedHTML}
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
        ${roundLuckyPennyResult ? (() => {
          const { call, flip, won } = roundLuckyPennyResult;
          return `<p class="snes-small ${won ? 'snes-success' : 'snes-muted'}" style="text-align:center;font-size:5px">
            💰 LUCKY PENNY · YOU CALLED ${call.toUpperCase()}, IT WAS ${flip.toUpperCase()} — ${won ? '✓ EARNED A BASIC POWERUP!' : '✗ NO LUCK THIS ROUND'}
          </p>`;
        })() : ''}
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
        <p class="snes-small snes-error" style="text-align:center">⚠ INVENTORY FULL</p>
        <div class="overflow-new-drop">
          <p class="overflow-new-drop-header">NEW DROP</p>
          <div id="overflow-drop-inspect" style="display:flex;align-items:center;gap:10px;cursor:pointer" title="Tap to inspect">
            ${overflowIcon ? `<img src="${overflowIcon}" alt="" style="width:36px;height:36px;image-rendering:pixelated;object-fit:contain;flex-shrink:0">` : ''}
            <div style="flex:1;min-width:0">
              <p class="snes-small snes-highlight">${overflowDrop.name.toUpperCase()}</p>
              <p style="font-family:var(--font-readable);font-size:11px;color:var(--snes-muted)">${overflowDrop.tier.toUpperCase()} · ${overflowDrop.scope.toUpperCase()}</p>
              <p style="font-family:var(--font-readable);font-size:11px;color:var(--snes-border-light);margin-top:2px">▶ Tap to inspect</p>
            </div>
          </div>
        </div>
        <p class="snes-small overflow-inventory-header">REPLACE WHICH SLOT?</p>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${replaceButtonsHTML}
          <button class="snes-btn" style="width:100%;font-size:6px;padding:8px 10px;opacity:0.7" id="btn-overflow-discard">
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

    // Round history log — emoji throws for instant readability
    const THROW_EMOJI = { rock: '✊', paper: '✋', scissors: '✌' };
    const historyHTML = tournamentData.currentMatch.roundHistory.length > 0
      ? tournamentData.currentMatch.roundHistory.map(r => {
          const won = r.winner === 'player';
          const tie = r.winner === 'tie';
          const pe  = THROW_EMOJI[r.playerThrow]   ?? r.playerThrow[0].toUpperCase();
          const oe  = THROW_EMOJI[r.opponentThrow] ?? r.opponentThrow[0].toUpperCase();
          return `<span class="snes-small ${won ? 'snes-success' : tie ? 'snes-highlight' : 'snes-error'}">
            ${pe}${won ? '▲' : tie ? '─' : '▼'}${oe}
          </span>`;
        }).join(' ')
      : '';

    const greetingHTML = screenState === 'picking' && roundNumber === 1
      ? `<div class="snes-panel">
           <p class="snes-small snes-muted" style="line-height:2">"${npc.greeting}"</p>
         </div>`
      : '';

    const popupHTML = popupPowerup ? renderPopup(popupPowerup)
                    : skillPopup   ? renderSkillPopup(skillPopup)
                    : '';

    container.innerHTML = `
      <div class="screen fade-in" style="gap:0;position:relative">

        ${popupHTML ? `<div id="pu-popup-layer">${popupHTML}</div>` : ''}

        <!-- Reserve space so the fixed HUD chip never overlaps the scoreboard on mobile -->
        <div class="match-hud-spacer"></div>

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
            <div id="match-action-body">${bodyHTML}</div>
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
        skillPopup   = null;
        render();
      });
    });

    // Skill card inspect — tap card body (not the USE button) to see full description.
    container.querySelectorAll('[data-skill-inspect]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // let button handle its own click
        skillPopup   = el.dataset.skillInspect;
        popupPowerup = null;
        render();
      });
    });

    document.getElementById('btn-popup-use')?.addEventListener('click', () => {
      if (!popupPowerup) return;
      handleUsePowerup(popupPowerup.instanceId);
      popupPowerup = null;
      if (screenState === 'gut_check') {
        enterGutCheckPhase();
      } else {
        render();
      }
    });
    document.getElementById('btn-popup-close')?.addEventListener('click', () => {
      popupPowerup = null;
      render();
    });
    document.getElementById('btn-skill-popup-close')?.addEventListener('click', () => {
      skillPopup = null;
      render();
    });
    document.getElementById('pu-popup-backdrop')?.addEventListener('click', () => {
      popupPowerup = null;
      skillPopup   = null;
      render();
    });

    // Active skill buttons (visible in picking + gut_check phases)
    document.getElementById('btn-tml')?.addEventListener('click', handleTrustMyLuck);
    document.getElementById('btn-neural-scan')?.addEventListener('click', handleNeuralScan);
    document.getElementById('btn-memory-wipe')?.addEventListener('click', handleMemoryWipe);
    document.getElementById('btn-force-hand')?.addEventListener('click', handleForceYourHand);
    document.getElementById('btn-change-luck')?.addEventListener('click', handleChangeMyLuck);
    document.getElementById('btn-brain-fart')?.addEventListener('click', handleBrainFart);
    document.getElementById('btn-massive-brain-fart')?.addEventListener('click', handleMassiveBrainFart);
    document.getElementById('btn-mental-mysticism')?.addEventListener('click', handleMentalMysticism);
    document.getElementById('btn-refuse-to-lose')?.addEventListener('click', handleRefuseToLose);
    document.getElementById('btn-igah')?.addEventListener('click', handleIGaH);
    document.getElementById('btn-reversal')?.addEventListener('click', handleReversalOfFortune);
    document.getElementById('btn-lucky-charm')?.addEventListener('click', handleLuckyCharm);
    document.getElementById('btn-not-today')?.addEventListener('click', handleNotToday);
    document.getElementById('btn-phantom-memory')?.addEventListener('click', handlePhantomMemory);

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
      container.querySelectorAll('[data-espresso]').forEach(btn => {
        btn.addEventListener('click', () => {
          roundEspressoShotBonus = btn.dataset.espresso;
          render();
        });
      });
    } else if (screenState === 'revealing') {
      document.getElementById('btn-next')?.addEventListener('click', handleAdvanceFromReveal);
    } else if (screenState === 'drop_result') {
      document.getElementById('btn-drop-ok')?.addEventListener('click', () => {
        if (matchStartPhase) { matchStartPhase = false; checkT08ThenRender(); }
        else { advanceRound(); }
      });
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
    enterGutCheckPhase();
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
    const accRate = hasSkill('MIND.1.1.1.2') ? NPR_ADVANCED_ACCUMULATION : NPR_ACCUMULATION_PER_ROUND;
    nprAccumulation += accRate;
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
      // Desperate Clarity (MIND.1.1.2): permanent NPR floor — bonus stays after fire.
      nprAccumulation = desperateClarityBonus;
    }
  }

  // Computes the per-round informational read from any active reveal effects.
  // Picks the highest-confidence active read; sets roundCanChangeThrow if any
  // reveal grants throw-change ability.
  function generateRoundRead() {
    roundRead              = null;
    roundCanChangeThrow    = false;
    roundWordFromCoachElim = null;

    const candidates = [];
    if (matchFocusedFG) {
      const correct = roll() < 0.80;
      const bestThrow = throwThatBeats(pendingOpponentThrow);
      candidates.push({ source: 'Focused Focus Group', confidence: 80,
                        throwName: correct ? bestThrow : pickWrongThrow(bestThrow) });
    }
    if (matchFocusGroup) {
      const correct = roll() < 0.65;
      const bestThrow = throwThatBeats(pendingOpponentThrow);
      candidates.push({ source: 'Focus Group', confidence: 65,
                        throwName: correct ? bestThrow : pickWrongThrow(bestThrow) });
    }
    if (tournamentEffectActive('Courtside with Jessie') && roll() < COURTSIDE_CHANCE) {
      candidates.push({ source: 'Courtside with Jessie', confidence: 40,
                        throwName: pendingOpponentThrow });
    }
    if (seasonEffectActive('Smart Glasses') && roll() < SMART_GLASSES_CHANCE) {
      candidates.push({ source: 'Smart Glasses', confidence: 20,
                        throwName: pendingOpponentThrow });
    }
    if (tournamentEffectActive('Reading Glasses') && roll() < READING_GLASSES_CHANCE) {
      candidates.push({ source: 'Reading Glasses', confidence: 15,
                        throwName: pendingOpponentThrow });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      roundRead           = candidates[0];
      roundCanChangeThrow = true;
    }

    // A Word From Your Coach: eliminate one throw the NPC is definitely NOT using this round.
    if (matchWordFromCoach && pendingOpponentThrow) {
      const wrongThrows = ['rock', 'paper', 'scissors'].filter(t => t !== pendingOpponentThrow);
      roundWordFromCoachElim = wrongThrows[Math.floor(roll() * wrongThrows.length)];
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

      // ── FORTUNE — Pandora's Box: random both, reset all active cooldowns on win ─
      case "Pandora's Box":
        consumePowerupByInstance(instanceId);
        currentThrow           = randomThrow();
        pendingOpponentThrow   = randomThrow();
        roundLockThrow         = true;
        roundPandorasBoxActive = true;
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

      // ── MYSTIC — Jonesing to Help: season-scope, delivers 1 Advanced at each match start ─
      case 'Jonesing to Help':
        consumePowerupByInstance(instanceId);
        activateSeasonEffect('Jonesing to Help');
        roundActivated.push('Jonesing to Help — Jessie delivers an Advanced powerup each match start!');
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

      // ── MIND — A Word From Your Coach: Monty Hall — eliminate one wrong throw per round ─
      case 'A Word From Your Coach':
        consumePowerupByInstance(instanceId);
        matchWordFromCoach = true;
        if (screenState === 'gut_check') generateRoundRead();
        roundActivated.push('A Word From Your Coach');
        break;

      // ── MIND — Espresso Shot: player picks backup throw in gut_check; better outcome counts ─
      case 'Espresso Shot':
        consumePowerupByInstance(instanceId);
        roundEspressoShotActive = true;
        roundActivated.push('Espresso Shot');
        break;

      // ── MIND — Protein Shake: throw-change + 1 Basic if throw changed and round won ─
      case 'Protein Shake':
        consumePowerupByInstance(instanceId);
        roundProteinShakeOriginalThrow = currentThrow;
        roundCanChangeThrow = true;
        roundActivated.push('Protein Shake');
        break;

      // ── MIND — passive per-round tells (tournament / season scope) ─────────
      case 'Reading Glasses':
        consumePowerupByInstance(instanceId);
        activateTournamentEffect('Reading Glasses');
        if (screenState === 'gut_check') generateRoundRead();
        roundActivated.push('Reading Glasses');
        break;

      case 'Courtside with Jessie':
        consumePowerupByInstance(instanceId);
        activateTournamentEffect('Courtside with Jessie');
        if (screenState === 'gut_check') generateRoundRead();
        roundActivated.push('Courtside with Jessie');
        break;

      case 'Smart Glasses':
        consumePowerupByInstance(instanceId);
        activateSeasonEffect('Smart Glasses');
        if (screenState === 'gut_check') generateRoundRead();
        roundActivated.push('Smart Glasses');
        break;

      // ── MIND — pre-match strategy reveal (99% accurate) ─────────────────────
      case 'Jessie Did Her Homework': {
        consumePowerupByInstance(instanceId);
        const accurate = roll() < 0.99;
        const realStrategy = npc.strategies?.[0] ?? 'unknown';
        const wrongPool    = ['random', 'puristRock', 'puristPaper', 'mirror', 'historian', 'streaker']
                             .filter(s => s !== realStrategy);
        const shownStrategy = accurate
          ? realStrategy
          : (wrongPool[Math.floor(roll() * wrongPool.length)] ?? realStrategy);
        roundActivated.push(`Jessie's Read: ${strategyDesc(shownStrategy)}`);
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

      // ── MYSTIC — Schrödinger's Amulet: change throw; if original OR new beats NPC, win ─
      case "Schrödinger's Amulet":
        consumePowerupByInstance(instanceId);
        roundSchrodingerOriginalThrow = currentThrow;
        roundCanChangeThrow = true;
        roundActivated.push("Schrödinger's Amulet");
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

      // ── MYSTIC — Clockwork Orange: reset all player active-skill round cooldowns ─
      case 'Clockwork Orange':
        consumePowerupByInstance(instanceId);
        resetActiveCooldowns();
        roundActivated.push('Clockwork Orange');
        break;

      // ── MYSTIC — Cuckoo Clock: Clockwork Orange auto-fires at round 3, tournament-scope ─
      case 'Cuckoo Clock':
        consumePowerupByInstance(instanceId);
        activateTournamentEffect('Cuckoo Clock');
        roundActivated.push('Cuckoo Clock');
        break;

      // ── MYSTIC — no-op until later systems land ─────────────────────────────
      case 'Molasses':           // +1 round on opponent active-skill cooldowns
      case 'Padlock':            // blocks NPC powerup activation
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

  // Resets all round-based active-skill cooldowns (Clockwork Orange / Cuckoo Clock).
  function resetActiveCooldowns() {
    tmlCooldownRemaining       = 0;
    forceYourHandCooldown      = 0;
    changeMyLuckCooldown       = 0;
    brainFartCooldown          = 0;
    mentalMysticismCooldown    = 0;
    refuseToLoseCooldown       = 0;
    igahCooldown               = 0;
    reversalOfFortuneCooldown  = 0;
    luckyCharmCooldown         = 0;
    notTodayCooldown           = 0;
    massiveBrainFartCooldown   = 0;
    phantomMemoryCooldown      = 0;
  }

  // ── Match reset (Cosmic Insurance Policy) ────────────────────────────────────

  function resetMatch() {
    playerRoundsWon        = 0;
    opponentRoundsWon      = 0;
    roundNumber            = 1;
    playerWinStreak        = 0;
    matchThreesCompanyDone = false;
    streakAwardedFlags     = {};
    // Match-scope powerup resets
    matchFocusGroup         = false;
    matchFocusedFG          = false;
    matchWordFromCoach       = false;
    matchHotSauce           = false;
    matchThreesCompany      = false;
    matchLuckyPenny         = false;
    matchTabulaRasa         = false;
    matchHiccupPotion       = false;
    matchMysticPizza        = false;
    matchPizzaUsedThisRound = false;
    // L3 match-scope resets
    consecutiveLosses       = 0;
    desperateClarityBonus   = 0;
    desperateClarityApplied = false;
    memoryWipeUsed          = false;
    thirdTimesCharmFails    = 0;
    thirdTimesCharmUsed     = false;
    dueForAWinFails         = 0;
    dueForAWinUsed          = false;
    forceYourHandCooldown      = 0;
    changeMyLuckCooldown       = 0;
    brainFartCooldown          = 0;
    mentalMysticismCooldown    = 0;
    refuseToLoseCooldown       = 0;
    igahCooldown               = 0;
    reversalOfFortuneCooldown  = 0;
    luckyCharmCooldown         = 0;
    notTodayCooldown           = 0;
    massiveBrainFartCooldown   = 0;
    phantomMemoryCooldown      = 0;
    totalRecallUsed            = false;

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

  // ── Countdown overlay ────────────────────────────────────────────────────────

  function runCountdownOverlay(onComplete) {
    const bodyEl = document.getElementById('match-action-body');
    if (!bodyEl) { onComplete(); return; }
    // Use the containing .match-panel so the canvas covers the full result pane.
    // On desktop the panel is flex-stretched to its tallest sibling, giving a
    // stable height that doesn't shrink when gut_check has less content than reveal.
    const targetEl = bodyEl.closest('.match-panel') || bodyEl;
    const rect = targetEl.getBoundingClientRect();

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    canvas.style.cssText = `position:fixed;top:${Math.round(rect.top)}px;left:${Math.round(rect.left)}px;z-index:9000;pointer-events:all`;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    runCountdown(ctx, canvas.width, canvas.height, () => {
      canvas.remove();
      onComplete();
    });
  }

  // ── Phase 3: Resolution ──────────────────────────────────────────────────────

  function handleReady() {
    // Lucky Penny: gate on call selection
    if (matchLuckyPenny && roundLuckyPennyCall === null) return;

    // Resolve, applying forced outcomes if active
    let result = resolveRound(currentThrow, pendingOpponentThrow);

    // Espresso Shot: also play backup throw, use the better of the two outcomes.
    if (roundEspressoShotBonus !== null) {
      const bonusResult = resolveRound(roundEspressoShotBonus, pendingOpponentThrow);
      const ORDER = { player: 2, tie: 1, opponent: 0 };
      if (ORDER[bonusResult] > ORDER[result]) {
        result = bonusResult;
        currentThrow = roundEspressoShotBonus; // backup was better; show it in reveal
      }
    }

    // Schrödinger's Amulet: if player changed throw, check if original would have won too.
    if (roundSchrodingerOriginalThrow !== null
        && currentThrow !== roundSchrodingerOriginalThrow) {
      const originalResult = resolveRound(roundSchrodingerOriginalThrow, pendingOpponentThrow);
      if (originalResult === 'player' && result !== 'player') {
        result       = 'player';
        currentThrow = roundSchrodingerOriginalThrow; // show the throw that actually won
        roundActivated.push("Schrödinger's Amulet: original throw won!");
      }
    }

    // Protein Shake: if throw was changed after activation and round is won, earn 1 Basic.
    // Track before force overrides so we know the natural result of the changed throw.
    proteinShakeBonus =
      roundProteinShakeOriginalThrow !== null &&
      currentThrow !== roundProteinShakeOriginalThrow &&
      result === 'player';

    if (roundForceWin)       result = 'player';
    else if (roundForceLoss) result = 'opponent';

    // Refuse to Lose (MYSTIC.1.1.2.1): active — convert loss → immune tie (90%).
    if (result === 'opponent' && roundRefuseToLoseActive) {
      if (roll() < REFUSE_TO_LOSE_CHANCE) {
        result      = 'tie';
        tieIsImmune = true; // immune tie: no tie-altering skills can touch it
        roundActivated.push('Refuse to Lose!');
      }
    }

    if (result === 'tie' && !tieIsImmune) {
      // Active check runs before passives (per design doc Section 6.5).
      // Mental Mysticism (MIND.1.1.2.1): precondition — NPR fired this match.
      if (roundMentalMysticismActive) {
        if (roll() < MENTAL_MYSTICISM_CHANCE) {
          result = 'player';
          roundActivated.push('Mental Mysticism!');
        }
        // Active fired (hit or miss) — passives do not roll.
      } else if (roundForceHandActive) {
        // Force Your Hand (MYSTIC.1.1.1) / Twist Your Arm (MYSTIC.1.1.1.1): 90% tie→win.
        if (roll() < FORCE_YOUR_HAND_CHANCE) {
          result = 'player';
          roundActivated.push(hasSkill('MYSTIC.1.1.1.1') ? 'Twist Your Arm' : 'Force Your Hand');
        }
        // Active fired — passives do not roll.
      } else if (hasSkill('MYSTIC.1.1') || hasSkill('MYSTIC.1.1.1.2')) {
        // Passive: Alter Reality (MYSTIC.1.1.1.2, 60%) replaces Tweak Reality (30%) when purchased.
        const baseChance = hasSkill('MYSTIC.1.1.1.2') ? ALTER_REALITY_CHANCE : TWEAK_REALITY_CHANCE;
        // Third Time's the Charm (MYSTIC.1.1.2): boost to 95% after 2 consecutive failures.
        let convertChance = baseChance;
        if (hasSkill('MYSTIC.1.1.2') && !thirdTimesCharmUsed && thirdTimesCharmFails >= 2) {
          convertChance = THIRD_TIMES_CHARM_BOOST;
          thirdTimesCharmUsed = true;
        }
        if (roll() < convertChance) {
          result = 'player';
          if (convertChance === THIRD_TIMES_CHARM_BOOST) {
            roundActivated.push("Third Time's the Charm!");
          } else {
            roundActivated.push(hasSkill('MYSTIC.1.1.1.2') ? 'Reality Altered' : 'Reality Tweaked');
          }
          thirdTimesCharmFails = 0;
        } else {
          thirdTimesCharmFails++;
        }
      }
    }

    lastPlayerThrow   = currentThrow;
    lastOpponentThrow = pendingOpponentThrow;
    lastRoundResult   = result;

    if (result === 'player')   playerRoundsWon++;
    if (result === 'opponent') opponentRoundsWon++;

    // Pandora's Box: reset all active-skill cooldowns on a round win.
    if (roundPandorasBoxActive && result === 'player') {
      resetActiveCooldowns();
      roundActivated.push("Pandora's Box: all cooldowns reset!");
    }

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

    // Update streak counters and L3 passive trackers
    if (result === 'player') {
      playerWinStreak++;
      consecutiveLosses = 0;
    } else {
      playerWinStreak = 0;
      resetStreakAwardedFlags();
      if (result === 'opponent') {
        consecutiveLosses++;
        // Desperate Clarity (MIND.1.1.2): +20% permanent NPR floor after 2 consecutive losses.
        if (hasSkill('MIND.1.1.2') && !desperateClarityApplied && consecutiveLosses >= 2) {
          desperateClarityBonus  += DESPERATE_CLARITY_NPR_BOOST;
          nprAccumulation        += DESPERATE_CLARITY_NPR_BOOST;
          desperateClarityApplied = true;
          roundActivated.push('Desperate Clarity: +20% NPR');
        }
      }
    }

    skillPopup = null;

    runCountdownOverlay(() => {
      screenState = 'revealing';

      // T-07: first ever round resolution — auto-dismisses ~3s, outcome-specific line
      const _trophiesT07 = loadTrophies(charId);
      if (!tutorialBeatShown(_trophiesT07, 'T-07')) {
        const outcome = lastRoundResult === 'player' ? 'win'
          : lastRoundResult === 'opponent' ? 'loss' : 'tie';
        const { line, expression } = JESSIE_TUTORIAL_DIALOGUE['T-07'].variants[outcome];
        const { autoDismissMs } = JESSIE_TUTORIAL_DIALOGUE['T-07'];
        showJessieDialogue(container, [line], expression, () => {
          markTutorialBeat(_trophiesT07, 'T-07');
          saveTrophies(charId, _trophiesT07);
          render();
        }, { autoDismissMs });
        return;
      }
      render();
    });
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
      // Protein Shake: player changed throw after activation and the changed throw won.
      if (proteinShakeBonus) {
        earnedDrops.push(...generateBonusDrops([{ tier: 'Basic', count: 1 }], progress.treeState));
        roundActivated.push('Protein Shake paid off!');
      }
    } else {
      earnedDrops = [];
      if (lastRoundResult === 'opponent') {
        // Consolation Prize (FORTUNE.1.2): 30% Basic drop on player loss.
        if (hasSkill('FORTUNE.1.2') && roll() < CONSOLATION_PRIZE_CHANCE) {
          earnedDrops.push(...generateBonusDrops([{ tier: 'Basic', count: 1 }], progress.treeState));
        }
        // Look What I Found (FORTUNE.1.2.1.2): independent 25% Advanced drop on loss.
        if (hasSkill('FORTUNE.1.2.1.2') && roll() < LOOK_WHAT_I_FOUND_CHANCE) {
          earnedDrops.push(...generateBonusDrops([{ tier: 'Advanced', count: 1 }], progress.treeState));
        }
        // Change My Luck (FORTUNE.1.2.1): armed this round → 2 Basic+ drops on loss.
        if (roundChangeMyLuckActive) {
          earnedDrops.push(...generateBonusDrops([{ tier: 'Basic', count: 2 }], progress.treeState));
          roundActivated.push('Change My Luck paid off!');
        }
        // Reversal of Fortune (FORTUNE.1.2.1.1): armed this round → 2 Advanced+ drops on loss.
        if (roundReversalActive) {
          earnedDrops.push(...generateBonusDrops([{ tier: 'Advanced', count: 2 }], progress.treeState));
          roundActivated.push('Reversal of Fortune paid off!');
        }
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
    const won  = flip === roundLuckyPennyCall;
    roundLuckyPennyResult = { call: roundLuckyPennyCall, flip, won };
    if (won) {
      earnedDrops.push(...generateBonusDrops([{ tier: 'Basic', count: 1 }], progress.treeState));
    }
  }

  function processNextDrop() {
    if (earnedDrops.length === 0) {
      if (resolvedDrops.length > 0) {
        screenState = 'drop_result';
        // T-09: introduce powerups on first in-match drop (non-MIND players; MIND fires at mount)
        const _trophiesT09 = loadTrophies(charId);
        if (!tutorialBeatShown(_trophiesT09, 'T-09')) {
          const { expression, lines } = JESSIE_TUTORIAL_DIALOGUE['T-09'];
          showJessieDialogue(container, lines, expression, () => {
            markTutorialBeat(_trophiesT09, 'T-09');
            saveTrophies(charId, _trophiesT09);
            render();
          });
        } else {
          render();
        }
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
    // Cuckoo Clock: auto-fire Clockwork Orange at the start of round 3.
    if (tournamentEffectActive('Cuckoo Clock') && roundNumber === 3) {
      resetActiveCooldowns();
    }
    // Decrement active-skill cooldowns for the new round.
    if (tmlCooldownRemaining      > 0) tmlCooldownRemaining--;
    if (forceYourHandCooldown     > 0) forceYourHandCooldown--;
    if (changeMyLuckCooldown      > 0) changeMyLuckCooldown--;
    if (brainFartCooldown         > 0) brainFartCooldown--;
    if (mentalMysticismCooldown   > 0) mentalMysticismCooldown--;
    if (refuseToLoseCooldown      > 0) refuseToLoseCooldown--;
    if (igahCooldown              > 0) igahCooldown--;
    if (reversalOfFortuneCooldown > 0) reversalOfFortuneCooldown--;
    if (luckyCharmCooldown        > 0) luckyCharmCooldown--;
    if (notTodayCooldown          > 0) notTodayCooldown--;
    if (massiveBrainFartCooldown  > 0) massiveBrainFartCooldown--;
    if (phantomMemoryCooldown     > 0) phantomMemoryCooldown--;
    resetRoundScopeState();
    screenState = 'picking';
    checkT08ThenRender();
  }

  // Mystic Pizza replay — return to picking phase WITHOUT incrementing round number
  function replayRound() {
    resetRoundScopeState();
    screenState = 'picking';
    checkT08ThenRender();
  }

  function resetRoundScopeState() {
    currentThrow             = null;
    pendingOpponentThrow     = null;
    changedMyMindUsed        = false;
    roundForceWin            = false;
    roundForceLoss           = false;
    roundInstantMatchWin     = false;
    roundLockThrow           = false;
    roundPandorasBoxActive   = false;
    roundOtherUsesDisabled   = false;
    roundBonusOnWin          = [];
    roundLuckyPennyCall      = null;
    roundLuckyPennyResult    = null;
    roundDizzySpell          = false;
    roundMysticPizza         = false;
    roundCanChangeThrow      = false;
    roundActiveSkillUsed     = false;
    roundTmlPending          = null;
    roundRead                = null;
    roundStrategyRead        = null;
    roundActivated           = [];
    popupPowerup             = null;
    roundForceHandActive          = false;
    roundChangeMyLuckActive       = false;
    roundMentalMysticismActive    = false;
    roundRefuseToLoseActive       = false;
    roundReversalActive           = false;
    tieIsImmune                   = false;   // Refuse to Lose — clear each round
    roundEspressoShotActive       = false;
    roundEspressoShotBonus        = null;
    roundWordFromCoachElim        = null;
    roundSchrodingerOriginalThrow  = null;
    roundProteinShakeOriginalThrow = null;
    proteinShakeBonus              = false;
  }

  // ── Active skill: Trust My Luck (FORTUNE.1.1) ────────────────────────────────

  // Returns the throw that beats the given throw.
  function throwThatBeats(t) {
    return t === 'rock' ? 'paper' : t === 'paper' ? 'scissors' : 'rock';
  }
  // Returns the throw that loses to the given throw.
  function throwThatLosesTo(t) {
    return t === 'rock' ? 'scissors' : t === 'paper' ? 'rock' : 'paper';
  }

  function handleTrustMyLuck() {
    if (!hasSkill('FORTUNE.1.1'))      return;
    if (tmlCooldownRemaining > 0)      return;
    if (roundActiveSkillUsed)          return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    // Compute opponent's throw now — needed to assign the correct player throw.
    if (pendingOpponentThrow === null) pendingOpponentThrow = computeNpcThrow();

    // Lucky Socks (FORTUNE.1.1.1) → 85%. Fingers Crossed (FORTUNE.1.1.1.2) → 95% (replaces).
    let successChance = TML_SUCCESS_CHANCE;
    if (hasSkill('FORTUNE.1.1.1.2'))     successChance = FINGERS_CROSSED_TML_CHANCE;
    else if (hasSkill('FORTUNE.1.1.1'))  successChance = LUCKY_SOCKS_TML_CHANCE;

    // Due for a Win (FORTUNE.1.1.2): 95% boost after 2 consecutive failures (one-time).
    let dueForAWinFired = false;
    if (hasSkill('FORTUNE.1.1.2') && !dueForAWinUsed && dueForAWinFails >= 2) {
      successChance  = DUE_FOR_A_WIN_BOOST;
      dueForAWinFired = true;
    }

    const success = roll() < successChance;

    if (success) {
      roundForceWin   = true;
      roundTmlPending = 'success';
      currentThrow    = throwThatBeats(pendingOpponentThrow);   // fortune picks correctly
      dueForAWinFails = 0;
    } else {
      roundForceLoss  = true;
      roundTmlPending = 'failure';
      currentThrow    = throwThatLosesTo(pendingOpponentThrow); // fortune picks wrong
      dueForAWinFails++;
    }

    if (dueForAWinFired) {
      dueForAWinUsed = true;
      roundActivated.push(success ? 'Due for a Win + TML!' : 'Due for a Win fizzled');
    }

    roundActiveSkillUsed = true;
    // ATML (FORTUNE.1.1.1.1) has shorter cooldown (3 rounds vs 5).
    tmlCooldownRemaining = hasSkill('FORTUNE.1.1.1.1') ? ATML_COOLDOWN_ROUNDS : TML_COOLDOWN_ROUNDS;
    roundLockThrow       = true;
    // "TML Succeeded/Failed" is pushed now but only shown in the reveal — the gut_check
    // TML panel intentionally hides activatedHTML so the player doesn't see the outcome
    // before hitting "Let Fortune Decide".
    roundActivated.push(success ? 'TML Succeeded' : 'TML Failed');

    // Advance from picking to gut_check to show the TML waiting panel.
    if (screenState === 'picking') {
      screenState = 'gut_check';
      processNPR();
      generateRoundRead();
      enterGutCheckPhase();
      return;
    }

    render();
  }

  // ── Active skill: Neural Scan (MIND.1.1.1) ───────────────────────────────────

  function handleNeuralScan() {
    if (!hasSkill('MIND.1.1.1')) return;
    const cooldown = hasSkill('MIND.1.1.1.1') ? NEURAL_SCAN_2_COOLDOWN_MATCHES : NEURAL_SCAN_COOLDOWN_MATCHES;
    if (neuralScanMatchesSinceLastUse < cooldown) return;
    if (roundActiveSkillUsed) return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    const accurate      = roll() >= NPR_FALSE_RESULT_CHANCE; // 10% false read (always flat)
    const realStrategy  = npcMatchState.strategy ?? 'unknown';
    const wrongPool     = ['random', 'puristRock', 'puristPaper', 'mirror', 'historian',
                            'streaker', 'momentum', 'counter', 'cycler']
                            .filter(s => s !== realStrategy);
    const shown = accurate
      ? realStrategy
      : (wrongPool[Math.floor(roll() * wrongPool.length)] ?? realStrategy);

    roundStrategyRead             = { source: 'Neural Scan', strategy: shown, accurate };
    hasNPRFiredThisMatch          = true;
    roundActiveSkillUsed          = true;
    neuralScanMatchesSinceLastUse = 0;

    // Persist cross-match cooldown immediately.
    progress.crossMatchState = { ...(progress.crossMatchState ?? {}), neuralScanMatchesSinceLastUse: 0 };
    saveProgress(charId, progress);

    roundActivated.push('Neural Scan');
    render();
  }

  // ── Active skill: Memory Wipe (MIND.1.2.1) / Total Recall (MIND.1.2.1.1) ─────

  function handleMemoryWipe() {
    if (!hasSkill('MIND.1.2.1'))                       return;
    if (hasSkill('MIND.1.2.1.1') ? totalRecallUsed : memoryWipeUsed) return;
    if (roundActiveSkillUsed)                          return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    npcMatchState        = initNpcMatchState(npc); // NPC forgets everything
    memoryWipeUsed       = true;
    if (hasSkill('MIND.1.2.1.1')) totalRecallUsed = true;
    roundActiveSkillUsed = true;

    // Recompute NPC throw if one is already pending (they've now forgotten strategy).
    if (pendingOpponentThrow !== null) {
      pendingOpponentThrow = computeNpcThrow();
      generateRoundRead();
    }

    const label = hasSkill('MIND.1.2.1.1') ? 'Total Recall' : 'Memory Wipe';
    roundActivated.push(label);
    render();
  }

  // ── Active skill: Brain Fart (MYSTIC.1.2.1) — no-op until NPC active skills ────

  function handleBrainFart() {
    if (!hasSkill('MYSTIC.1.2.1')) return;
    if (brainFartCooldown > 0)     return;
    if (roundActiveSkillUsed)      return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    brainFartCooldown    = BRAIN_FART_COOLDOWN_ROUNDS;
    roundActiveSkillUsed = true;
    roundActivated.push('Brain Fart (no-op until NPC uses active skills)');
    render();
  }

  // ── Active skill: Massive Brain Fart (MYSTIC.1.2.1.1) — no-op ───────────────

  function handleMassiveBrainFart() {
    if (!hasSkill('MYSTIC.1.2.1.1')) return;
    if (massiveBrainFartCooldown > 0) return;
    if (roundActiveSkillUsed)         return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    massiveBrainFartCooldown = MASSIVE_BRAIN_FART_COOLDOWN_ROUNDS;
    roundActiveSkillUsed     = true;
    roundActivated.push('Massive Brain Fart (no-op until NPC uses active skills)');
    render();
  }

  // ── Active skill: Mental Mysticism (MIND.1.1.2.1) ───────────────────────────

  function handleMentalMysticism() {
    if (!hasSkill('MIND.1.1.2.1'))      return;
    if (!hasNPRFiredThisMatch)          return; // precondition
    if (mentalMysticismCooldown > 0)    return;
    if (roundActiveSkillUsed)           return;
    if (roundMentalMysticismActive)     return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    roundMentalMysticismActive = true;
    mentalMysticismCooldown    = MENTAL_MYSTICISM_COOLDOWN_ROUNDS;
    roundActiveSkillUsed       = true;
    roundActivated.push('Mental Mysticism armed — 90% tie→win');
    render();
  }

  // ── Active skill: Refuse to Lose (MYSTIC.1.1.2.1) ───────────────────────────

  function handleRefuseToLose() {
    if (!hasSkill('MYSTIC.1.1.2.1')) return;
    if (refuseToLoseCooldown > 0)    return;
    if (roundActiveSkillUsed)        return;
    if (roundRefuseToLoseActive)     return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    roundRefuseToLoseActive  = true;
    refuseToLoseCooldown     = REFUSE_TO_LOSE_COOLDOWN_ROUNDS;
    roundActiveSkillUsed     = true;
    roundActivated.push('Refuse to Lose armed — 90% loss→immune tie');
    render();
  }

  // ── Active skill: I've Got a Hunch / IGaH (FORTUNE.1.1.2.1) ─────────────────

  function handleIGaH() {
    if (!hasSkill('FORTUNE.1.1.2.1')) return;
    if (igahCooldown > 0)             return;
    if (roundActiveSkillUsed)         return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    igahCooldown         = IGAH_COOLDOWN_ROUNDS;
    roundActiveSkillUsed = true;

    if (roll() < IGAH_CHANCE) {
      // Fires: strategy read at 90% accuracy. NOT blocked by Mind Shield.
      const accurate      = roll() >= NPR_FALSE_RESULT_CHANCE;
      const realStrategy  = npcMatchState.strategy ?? 'unknown';
      const wrongPool     = ['random', 'puristRock', 'puristPaper', 'mirror', 'historian',
                              'streaker', 'momentum', 'counter', 'cycler']
                              .filter(s => s !== realStrategy);
      const shown = accurate
        ? realStrategy
        : (wrongPool[Math.floor(roll() * wrongPool.length)] ?? realStrategy);
      roundStrategyRead    = { source: "I've Got a Hunch", strategy: shown, accurate };
      hasNPRFiredThisMatch = true;
      roundActivated.push("I've Got a Hunch fired!");
    } else {
      roundActivated.push("I've Got a Hunch: fizzled");
    }
    render();
  }

  // ── Active skill: Reversal of Fortune (FORTUNE.1.2.1.1) ─────────────────────

  function handleReversalOfFortune() {
    if (!hasSkill('FORTUNE.1.2.1.1'))  return;
    if (reversalOfFortuneCooldown > 0) return;
    if (roundActiveSkillUsed)          return;
    if (roundReversalActive)           return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    roundReversalActive          = true;
    reversalOfFortuneCooldown    = REVERSAL_OF_FORTUNE_COOLDOWN_ROUNDS;
    roundActiveSkillUsed         = true;
    roundActivated.push('Reversal of Fortune armed — earn 2 Advanced+ drops if you lose');
    render();
  }

  // ── Active skill: Lucky Charm (FORTUNE.1.2.2.1) — no-op until NPC MYSTIC ────

  function handleLuckyCharm() {
    if (!hasSkill('FORTUNE.1.2.2.1')) return;
    if (luckyCharmCooldown > 0)       return;
    if (roundActiveSkillUsed)         return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    luckyCharmCooldown   = LUCKY_CHARM_COOLDOWN_ROUNDS;
    roundActiveSkillUsed = true;
    roundActivated.push('Lucky Charm (no-op until NPC uses MYSTIC tie-altering)');
    render();
  }

  // ── Active skill: Not Today! (MIND.1.2.2.1) — no-op until NPC TML ───────────

  function handleNotToday() {
    if (!hasSkill('MIND.1.2.2.1')) return;
    if (notTodayCooldown > 0)      return;
    if (roundActiveSkillUsed)      return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    notTodayCooldown     = NOT_TODAY_COOLDOWN_ROUNDS;
    roundActiveSkillUsed = true;
    roundActivated.push('Not Today! (no-op until NPC uses TML)');
    render();
  }

  // ── Active skill: Phantom Memory (MYSTIC.1.2.2.1) — no-op ───────────────────

  function handlePhantomMemory() {
    if (!hasSkill('MYSTIC.1.2.2.1')) return;
    if (phantomMemoryCooldown > 0)   return;
    if (roundActiveSkillUsed)        return;
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    phantomMemoryCooldown = PHANTOM_MEMORY_COOLDOWN_ROUNDS;
    roundActiveSkillUsed  = true;
    roundActivated.push('Phantom Memory (no-op until NPC uses Neural Scan)');
    render();
  }

  // ── Active skill: Force Your Hand (MYSTIC.1.1.1) / Twist Your Arm (MYSTIC.1.1.1.1) ──────

  function handleForceYourHand() {
    if (!hasSkill('MYSTIC.1.1.1'))   return;
    if (forceYourHandCooldown > 0)   return;
    if (roundActiveSkillUsed)        return;
    if (roundForceHandActive)        return; // already armed
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    roundForceHandActive  = true;
    roundActiveSkillUsed  = true;
    // Twist Your Arm (MYSTIC.1.1.1.1) has shorter cooldown (3 rounds vs 5).
    forceYourHandCooldown = hasSkill('MYSTIC.1.1.1.1')
      ? TWIST_YOUR_ARM_COOLDOWN_ROUNDS
      : FORCE_YOUR_HAND_COOLDOWN_ROUNDS;
    roundActivated.push(hasSkill('MYSTIC.1.1.1.1') ? 'Twist Your Arm armed' : 'Force Your Hand armed');
    render();
  }

  // ── Active skill: Change My Luck (FORTUNE.1.2.1) ─────────────────────────────

  function handleChangeMyLuck() {
    if (!hasSkill('FORTUNE.1.2.1')) return;
    if (changeMyLuckCooldown > 0)   return;
    if (roundActiveSkillUsed)       return;
    if (roundChangeMyLuckActive)    return; // already armed
    if (screenState !== 'picking' && screenState !== 'gut_check') return;

    roundChangeMyLuckActive = true;
    changeMyLuckCooldown    = CHANGE_MY_LUCK_COOLDOWN_ROUNDS;
    roundActiveSkillUsed    = true;

    roundActivated.push('Change My Luck armed — earn 2 drops if you lose');
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
    progress.worldRank     = newRank;
    progress.peakWorldRank = Math.min(progress.peakWorldRank ?? (TOTAL_PLAYERS + 1), newRank);

    // Neural Scan (MIND.1.1.1): increment cross-match cooldown counter after each match.
    if (hasSkill('MIND.1.1.1')) {
      const cooldown = hasSkill('MIND.1.1.1.1') ? NEURAL_SCAN_2_COOLDOWN_MATCHES : NEURAL_SCAN_COOLDOWN_MATCHES;
      const prev = progress.crossMatchState?.neuralScanMatchesSinceLastUse ?? 0;
      progress.crossMatchState = {
        ...(progress.crossMatchState ?? {}),
        neuralScanMatchesSinceLastUse: Math.min(prev + 1, cooldown),
      };
    }

    saveProgress(charId, progress);

    const stats = loadStats(charId);
    stats.career.totalMatches++;
    stats.career[playerWon ? 'matchWins' : 'matchLosses']++;
    saveStats(charId, stats);

    navigate('tournament', { charId });
  }

  // ── Tutorial helpers ──────────────────────────────────────────────────────────

  // Returns the display name of the first active skill that is ready in the picking phase,
  // or null if none are ready. Used by T-08.
  function getFirstReadyActiveSkillName() {
    const nsCooldown = _nsCooldown();
    if (hasSkill('FORTUNE.1.1.1.1') && tmlCooldownRemaining === 0) return 'ATML';
    if (hasSkill('FORTUNE.1.1') && !hasSkill('FORTUNE.1.1.1.1') && tmlCooldownRemaining === 0) return 'Trust My Luck';
    if ((hasSkill('MIND.1.1.1') || hasSkill('MIND.1.1.1.1')) && neuralScanMatchesSinceLastUse >= nsCooldown)
      return hasSkill('MIND.1.1.1.1') ? 'Neural Scan 2.0' : 'Neural Scan';
    if (hasSkill('MYSTIC.1.1.1.1') && forceYourHandCooldown === 0) return 'Twist Your Arm';
    if (hasSkill('MYSTIC.1.1.1') && !hasSkill('MYSTIC.1.1.1.1') && forceYourHandCooldown === 0) return 'Force Your Hand';
    if (hasSkill('FORTUNE.1.2.1') && !hasSkill('FORTUNE.1.2.1.1') && changeMyLuckCooldown === 0) return 'Change My Luck';
    if (hasSkill('MIND.1.2.1.1') && !totalRecallUsed) return 'Total Recall';
    if (hasSkill('MIND.1.2.1') && !hasSkill('MIND.1.2.1.1') && !memoryWipeUsed) return 'Memory Wipe';
    if (hasSkill('MYSTIC.1.2.1.1') && massiveBrainFartCooldown === 0) return 'Massive Brain Fart';
    if (hasSkill('MYSTIC.1.2.1') && !hasSkill('MYSTIC.1.2.1.1') && brainFartCooldown === 0) return 'Brain Fart';
    if (hasSkill('MIND.1.1.2.1') && mentalMysticismCooldown === 0 && hasNPRFiredThisMatch) return 'Mental Mysticism';
    if (hasSkill('MYSTIC.1.1.2.1') && refuseToLoseCooldown === 0) return 'Refuse to Lose';
    if (hasSkill('FORTUNE.1.1.2.1') && igahCooldown === 0) return "I've Got a Hunch";
    if (hasSkill('FORTUNE.1.2.1.1') && reversalOfFortuneCooldown === 0) return 'Reversal of Fortune';
    if (hasSkill('FORTUNE.1.2.2.1') && luckyCharmCooldown === 0) return 'Lucky Charm';
    if (hasSkill('MIND.1.2.2.1') && notTodayCooldown === 0) return 'Not Today!';
    return null;
  }

  // T-08: introduce active skill button on first round where one is ready.
  function checkT08ThenRender() {
    const trophies = loadTrophies(charId);
    if (!tutorialBeatShown(trophies, 'T-08')) {
      const skillName = getFirstReadyActiveSkillName();
      if (skillName) {
        const line = JESSIE_TUTORIAL_DIALOGUE['T-08'].lineTemplate.replace('[SKILL_NAME]', skillName);
        showJessieDialogue(container, [line], JESSIE_TUTORIAL_DIALOGUE['T-08'].expression, () => {
          markTutorialBeat(trophies, 'T-08');
          saveTrophies(charId, trophies);
          render();
        });
        return;
      }
    }
    render();
  }

  // T-06: introduce gut check on first ever transition to Phase 2.
  function enterGutCheckPhase() {
    const trophies = loadTrophies(charId);
    if (!tutorialBeatShown(trophies, 'T-06')) {
      const { expression, lines } = JESSIE_TUTORIAL_DIALOGUE['T-06'];
      showJessieDialogue(container, lines, expression, () => {
        markTutorialBeat(trophies, 'T-06');
        saveTrophies(charId, trophies);
        render();
      });
      return;
    }
    render();
  }

  // ── Go ────────────────────────────────────────────────────────────────────────

  // If Jonesing to Help is season-active, deliver 1 Advanced powerup before first round.
  function deliverJonesingDropIfActive() {
    if (seasonEffectActive('Jonesing to Help')) {
      matchStartPhase = true;
      resolvedDrops   = [];
      earnedDrops     = generateBonusDrops([{ tier: 'Advanced', count: 1 }], progress.treeState);
      processNextDrop();
      return;
    }
    checkT08ThenRender();
  }

  // Mount-time tutorial sequence: T-05 → T-09 (MIND with starting inventory) → T-08 → render
  (function mountTutorialSequence() {
    const trophies = loadTrophies(charId);

    // T-05: introduce Phase 1 (Blind Selection) before the very first match
    if (!tutorialBeatShown(trophies, 'T-05')) {
      const { expression, lines } = JESSIE_TUTORIAL_DIALOGUE['T-05'];
      showJessieDialogue(container, lines, expression, () => {
        markTutorialBeat(trophies, 'T-05');
        saveTrophies(charId, trophies);
        checkT09MindThenRender();
      });
      return;
    }
    checkT09MindThenRender();

    // T-09 for MIND players with starting inventory (fires before first Phase 1)
    function checkT09MindThenRender() {
      const t = loadTrophies(charId);
      if (!tutorialBeatShown(t, 'T-09') && hasSkill('MIND.1') && (progress.powerupInventory ?? []).length > 0) {
        const { expression, lines } = JESSIE_TUTORIAL_DIALOGUE['T-09'];
        showJessieDialogue(container, lines, expression, () => {
          markTutorialBeat(t, 'T-09');
          saveTrophies(charId, t);
          deliverJonesingDropIfActive();
        });
        return;
      }
      deliverJonesingDropIfActive();
    }
  })();
}
