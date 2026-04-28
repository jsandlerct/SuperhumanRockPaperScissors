import { migrateIfNeeded, loadSession, loadProgress, loadTournament } from './storage.js';
import { mount as mountIntro }           from './screens/intro.js';
import { mount as mountLogin }           from './screens/login.js';
import { mount as mountCharacterSelect } from './screens/characterSelect.js';
import { mount as mountCharacterCreate } from './screens/characterCreate.js';
import { mount as mountSkillTree }       from './screens/skillTree.js';
import { mount as mountTournament }      from './screens/tournament.js';
import { mount as mountMatch }           from './screens/match.js';
import { mount as mountSummary }         from './screens/summary.js';

// ── NPC Roster ────────────────────────────────────────────────────────────────
// Loaded once at init, read-only at runtime. All access via helpers below.

let npcRoster = null;

export function getNpcById(id) {
  return npcRoster?.find(n => n.id === id) ?? null;
}

export function getNpcsByTier(level) {
  return npcRoster?.filter(n => n.tournamentLevel === level) ?? [];
}

async function loadNpcRoster() {
  const res = await fetch('data/npc_roster_v0_9.json');
  npcRoster = (await res.json()).npcs;
}

// ── Router ────────────────────────────────────────────────────────────────────

const app = document.getElementById('app');

export function navigate(screen, options = {}) {
  app.innerHTML = '';
  switch (screen) {
    case 'intro':           mountIntro(app, options);           break;
    case 'login':           mountLogin(app, options);           break;
    case 'characterSelect': mountCharacterSelect(app, options); break;
    case 'create':          mountCharacterCreate(app, options); break;
    case 'skillTree':  mountSkillTree(app, options);       break;
    case 'tournament': mountTournament(app, options);      break;
    case 'match':      mountMatch(app, options);           break;
    case 'summary':    mountSummary(app, options);         break;
    default:
      app.innerHTML = `<div class="screen" style="justify-content:center;align-items:center">
        <p class="snes-label snes-error">Unknown screen: ${screen}</p>
      </div>`;
  }
}

// ── Phase Router ─────────────────────────────────────────────────────────────
// Called after login and on cold app load. Routes to the correct screen based
// on the character's current progress phase.

export function routeByPhase(charId) {
  if (!charId) {
    navigate('create');
    return;
  }

  const progress = loadProgress(charId);
  if (!progress) {
    navigate('create');
    return;
  }

  const tournament = loadTournament(charId);
  if (progress.phase === 'active_season' && tournament?.currentMatch !== null) {
    // TODO v0.2: surface proper resume/forfeit prompt
    navigate('tournament', { charId });
    return;
  }

  switch (progress.phase) {
    case 'pre_season':    navigate('skillTree',  { charId }); break;
    case 'active_season': navigate('tournament', { charId }); break;
    case 'off_season':    navigate('skillTree',  { charId }); break;
    case 'complete':      navigate('summary',    { charId }); break;
    default:              navigate('login');
  }
}

// ── App Init ──────────────────────────────────────────────────────────────────

async function init() {
  migrateIfNeeded();

  try {
    await loadNpcRoster();
  } catch (e) {
    app.innerHTML = `<div class="screen" style="justify-content:center;align-items:center">
      <p class="snes-label snes-error">Failed to load NPC data.<br>Check that data/npc_roster_v0_9.json exists.</p>
    </div>`;
    return;
  }

  // Always play intro on every page load — it checks session on completion
  navigate('intro');
}

document.addEventListener('DOMContentLoaded', init);
