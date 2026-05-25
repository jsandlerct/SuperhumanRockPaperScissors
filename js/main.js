import { migrateIfNeeded, loadSession, loadProgress, loadTournament, loadMeta, saveMeta } from './storage.js';
import * as hud from './ui/hud.js';
import { mount as mountIntro }           from './screens/intro.js';
import { mount as mountTitle }           from './screens/title.js';
import { mount as mountLogin }           from './screens/login.js';
import { mount as mountCharacterSelect } from './screens/characterSelect.js';
import { mount as mountCharacterCreate } from './screens/characterCreate.js';
import { mount as mountSkillTree }       from './screens/skillTree.js';
import { mount as mountTournament }      from './screens/tournament.js';
import { mount as mountMatch }           from './screens/match.js';
import { mount as mountSummary }         from './screens/summary.js';
import { mount as mountCareerSummary }   from './screens/careerSummary.js';
import { mount as mountOffSeason }       from './screens/offSeason.js';
import { mount as mountHofSuspense }     from './screens/hofSuspense.js';
import { mount as mountHofInduction }    from './screens/hofInduction.js';

// ── NPC Roster ────────────────────────────────────────────────────────────────
// Loaded once at init, read-only at runtime. All access via helpers below.

let npcRoster = null;

export function getNpcById(id) {
  return npcRoster?.find(n => n.id === id) ?? null;
}

export function getNpcsByTier(level) {
  return npcRoster?.filter(n => n.tournamentLevel === level) ?? [];
}

export function getAllNpcs() {
  return npcRoster ?? [];
}

async function loadNpcRoster() {
  const res = await fetch('data/npc_roster_v0_9.json');
  npcRoster = (await res.json()).npcs;
}

// ── Router ────────────────────────────────────────────────────────────────────

const app = document.getElementById('app');

export function navigate(screen, options = {}) {
  // Fade out → swap content → fade in
  app.classList.add('fading');
  setTimeout(() => {
    app.innerHTML = '';
    hud.update(screen);
    switch (screen) {
      case 'intro':           mountIntro(app, options);           break;
      case 'title':           mountTitle(app, options);           break;
      case 'login':           mountLogin(app, options);           break;
      case 'characterSelect': mountCharacterSelect(app, options); break;
      case 'create':          mountCharacterCreate(app, options); break;
      case 'skillTree':  mountSkillTree(app, options);       break;
      case 'tournament': mountTournament(app, options);      break;
      case 'match':      mountMatch(app, options);           break;
      case 'summary':        mountSummary(app, options);        break;
      case 'careerSummary':  mountCareerSummary(app, options);  break;
      case 'offSeason':      mountOffSeason(app, options);      break;
      case 'hofSuspense':    mountHofSuspense(app, options);    break;
      case 'hofInduction':   mountHofInduction(app, options);   break;
      default:
        app.innerHTML = `<div class="screen" style="justify-content:center;align-items:center">
          <p class="snes-label snes-error">Unknown screen: ${screen}</p>
        </div>`;
    }
    // Tick to let the DOM paint before fading back in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => app.classList.remove('fading'));
    });
  }, 150);
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
    case 'pre_season':    navigate('skillTree',    { charId }); break;
    case 'active_season': navigate('tournament',  { charId }); break;
    case 'off_season':    navigate('offSeason',   { charId }); break;
    case 'complete':      navigate('careerSummary', { charId }); break;
    default:              navigate('login');
  }
}

// ── App Init ──────────────────────────────────────────────────────────────────

async function init() {
  migrateIfNeeded();

  // Test hook: if a screen override is queued in localStorage, consume it and navigate there.
  // Set by hof_test.html — never set by game code. Clears itself immediately on read.
  const _testNav = localStorage.getItem('srps_test_navigate');
  if (_testNav) {
    localStorage.removeItem('srps_test_navigate');
    const { screen, charId } = JSON.parse(_testNav);
    navigate(screen, { charId });
    return;
  }

  try {
    await loadNpcRoster();
  } catch (e) {
    app.innerHTML = `<div class="screen" style="justify-content:center;align-items:center">
      <p class="snes-label snes-error">Failed to load NPC data.<br>Check that data/npc_roster_v0_9.json exists.</p>
    </div>`;
    return;
  }

  // Show intro only on first-ever visit; returning players go straight to title.
  const meta = loadMeta();
  if (meta?.introSeen) {
    navigate('title');
  } else {
    navigate('intro');
  }
}

document.addEventListener('DOMContentLoaded', init);
