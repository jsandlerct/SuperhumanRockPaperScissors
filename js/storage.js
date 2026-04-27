// All localStorage access in the game goes through this file. Never call localStorage directly elsewhere.
import { SCHEMA_VERSION } from './constants.js';

// ── Migration ─────────────────────────────────────────────────────────────────

export function migrateIfNeeded() {
  const meta = JSON.parse(localStorage.getItem('srps_meta') || '{}');
  const currentVersion = meta.schemaVersion || 0;

  if (currentVersion < 1) {
    meta.schemaVersion = 1;
    meta.accountUsernames = meta.accountUsernames || [];
    localStorage.setItem('srps_meta', JSON.stringify(meta));
  }
  // Future migrations: if (currentVersion < 2) { ... meta.schemaVersion = 2; }
}

// ── Meta ──────────────────────────────────────────────────────────────────────

export function loadMeta() {
  return JSON.parse(localStorage.getItem('srps_meta') || '{}');
}

export function saveMeta(meta) {
  localStorage.setItem('srps_meta', JSON.stringify(meta));
}

// ── Session ───────────────────────────────────────────────────────────────────

export function saveSession(session) {
  localStorage.setItem('srps_session', JSON.stringify(session));
}

export function loadSession() {
  return JSON.parse(localStorage.getItem('srps_session') || 'null');
}

export function clearSession() {
  localStorage.removeItem('srps_session');
}

// ── Account ───────────────────────────────────────────────────────────────────

export function saveAccount(username, account) {
  localStorage.setItem(`srps_acct_${username.toLowerCase()}`, JSON.stringify(account));
}

export function loadAccount(username) {
  return JSON.parse(localStorage.getItem(`srps_acct_${username.toLowerCase()}`) || 'null');
}

// ── Identity ──────────────────────────────────────────────────────────────────

export function saveIdentity(charId, identity) {
  localStorage.setItem(`srps_char_${charId}_identity`, JSON.stringify(identity));
}

export function loadIdentity(charId) {
  return JSON.parse(localStorage.getItem(`srps_char_${charId}_identity`) || 'null');
}

// ── Progress ──────────────────────────────────────────────────────────────────

export function saveProgress(charId, progress) {
  localStorage.setItem(`srps_char_${charId}_progress`, JSON.stringify(progress));
}

export function loadProgress(charId) {
  return JSON.parse(localStorage.getItem(`srps_char_${charId}_progress`) || 'null');
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function saveStats(charId, stats) {
  localStorage.setItem(`srps_char_${charId}_stats`, JSON.stringify(stats));
}

export function loadStats(charId) {
  return JSON.parse(localStorage.getItem(`srps_char_${charId}_stats`) || 'null');
}

// ── Trophies ──────────────────────────────────────────────────────────────────

export function saveTrophies(charId, trophies) {
  localStorage.setItem(`srps_char_${charId}_trophies`, JSON.stringify(trophies));
}

export function loadTrophies(charId) {
  return JSON.parse(localStorage.getItem(`srps_char_${charId}_trophies`) || 'null');
}

// ── Tournament ────────────────────────────────────────────────────────────────

export function saveTournament(charId, tournament) {
  localStorage.setItem(`srps_char_${charId}_tournament`, JSON.stringify(tournament));
}

export function loadTournament(charId) {
  return JSON.parse(localStorage.getItem(`srps_char_${charId}_tournament`) || 'null');
}

// ── World ─────────────────────────────────────────────────────────────────────

export function saveWorld(charId, world) {
  localStorage.setItem(`srps_char_${charId}_world`, JSON.stringify(world));
}

export function loadWorld(charId) {
  return JSON.parse(localStorage.getItem(`srps_char_${charId}_world`) || 'null');
}
