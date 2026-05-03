import { roll } from '../utils/rng.js';
import { calcNewElo, winProbability } from './elo.js';
import {
  NODE_COST,
  NPC_STARTING_BUDGET_BY_TIER,
  TOURNAMENT_CONFIG,
  SKILL_POINTS_AWARD,
  TOTAL_PLAYERS,
  RANKING_MILESTONES,
  MILESTONE_PERSONAL_BEST_MSG,
} from '../constants.js';
import {
  saveWorld, saveProgress, saveTrophies, saveStats,
} from '../storage.js';

// ── Tree structure ─────────────────────────────────────────────────────────────

// All 15 node suffixes per tree (shared structure across MIND, MYSTIC, FORTUNE)
const TREE_NODE_SUFFIXES = [
  '1',
  '1.1', '1.2',
  '1.1.1', '1.1.2', '1.2.1', '1.2.2',
  '1.1.1.1', '1.1.1.2', '1.1.2.1', '1.1.2.2',
  '1.2.1.1', '1.2.1.2', '1.2.2.1', '1.2.2.2',
];

// Level = number of dot-separated segments after the tree name prefix
// e.g. MIND.1 → 2 parts → L1; MIND.1.1 → 3 parts → L2
export function nodeLevel(nodeId) {
  return nodeId.split('.').length - 1;
}

export function nodeCost(nodeId) {
  return NODE_COST[`L${nodeLevel(nodeId)}`];
}

// Returns the parent node ID, or null for L1 roots (no parent)
export function nodeParent(nodeId) {
  const parts = nodeId.split('.');
  if (parts.length <= 2) return null;
  return parts.slice(0, -1).join('.');
}

// Returns a fresh treeState object for one tree with all nodes set to false
export function getInitialTreeState(treeName) {
  const state = {};
  for (const suffix of TREE_NODE_SUFFIXES) {
    state[`${treeName}.${suffix}`] = false;
  }
  return state;
}

// ── Skill point spending ───────────────────────────────────────────────────────

// Returns all node IDs that are legal to purchase right now:
//   (a) not yet purchased
//   (b) parent is purchased (or node is L1 root)
//   (c) cost <= remaining budget
export function getLegalNodes(treeState, primaryTree, secondaryTree, budget) {
  const legal = [];
  const trees = [primaryTree, secondaryTree].filter(Boolean);

  for (const treeName of trees) {
    const treeNodes = treeState[treeName];
    if (!treeNodes) continue;

    for (const [nodeId, purchased] of Object.entries(treeNodes)) {
      if (purchased) continue;
      const cost = nodeCost(nodeId);
      if (cost > budget) continue;
      const parent = nodeParent(nodeId);
      if (parent !== null && !treeNodes[parent]) continue;
      legal.push(nodeId);
    }
  }

  return legal;
}

// Spends points using random-from-legal-nodes. Modifies treeState in place.
// Returns remaining unspent points (carry-over to next season).
export function spendSkillPoints(treeState, primaryTree, secondaryTree, budget) {
  while (budget > 0) {
    const legal = getLegalNodes(treeState, primaryTree, secondaryTree, budget);
    if (!legal.length) break;

    const chosen   = legal[Math.floor(roll() * legal.length)];
    const treeName = chosen.split('.')[0];
    treeState[treeName][chosen] = true;
    budget -= nodeCost(chosen);
  }
  return budget;
}

// ── NPC world state initialisation ────────────────────────────────────────────

// Called once when a character's first season begins (world bucket is null).
// Sets starting ELO from roster and spends the tier-based starting budget.
export function initNpcWorldState(roster) {
  const npcs = {};
  for (const npc of roster) {
    const budget    = NPC_STARTING_BUDGET_BY_TIER[npc.tournamentLevel];
    const treeState = { [npc.primaryTree]: getInitialTreeState(npc.primaryTree) };
    if (npc.secondaryTree) {
      treeState[npc.secondaryTree] = getInitialTreeState(npc.secondaryTree);
    }
    const remaining = spendSkillPoints(treeState, npc.primaryTree, npc.secondaryTree, budget);
    npcs[npc.id] = {
      currentElo:         npc.startingElo,
      treeState,
      powerupInventory:   [],
      unspentSkillPoints: remaining,
    };
  }
  return { season: 1, npcs };
}

// ── Bracket simulation ─────────────────────────────────────────────────────────

// Single-elimination bracket. participants must have length = power of 2.
// eloMap is mutated in place as each match resolves.
// Returns { winner, runnerUp } — both are {id, elo} objects (post-match ELOs).
function runBracketSimulation(participants, eloMap) {
  let round    = participants.map(p => ({ id: p.id, elo: eloMap[p.id] }));
  let runnerUp = null;

  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const a    = round[i];
      const b    = round[i + 1];
      const aWins = roll() < winProbability(a.elo, b.elo);

      const newAElo = calcNewElo(a.elo, b.elo, aWins ? 1 : 0);
      const newBElo = calcNewElo(b.elo, a.elo, aWins ? 0 : 1);

      eloMap[a.id] = newAElo;
      eloMap[b.id] = newBElo;
      a.elo = newAElo;
      b.elo = newBElo;

      const winner = aWins ? a : b;
      const loser  = aWins ? b : a;

      if (round.length === 2) runnerUp = loser;
      next.push(winner);
    }
    round = next;
  }

  return { winner: round[0] ?? null, runnerUp };
}

// ── Season simulation ─────────────────────────────────────────────────────────

// Runs at season end. Follows the mandatory write order from the schema doc:
//   1. Simulate all NPC vs NPC tournament results (ELO-probability)
//   2. Award NPC skill points; spend via random-from-legal-nodes
//   3. Update all NPC currentElo values
//   4. Recompute player worldRank from full ELO standings
//   5. Write world bucket
//   6. Write progress bucket
//   7. Write trophies bucket
//   8. Write stats bucket (zero season after career totals already updated by caller)
//
// progress and stats are modified in place; callers should re-read them if needed.
export function runSeasonSimulation(charId, worldData, roster, progress, stats, trophies) {
  // Initialise world state on first season
  if (!worldData || !worldData.npcs) {
    worldData = initNpcWorldState(roster);
  }

  // Working ELO map — all NPC ELOs live here during simulation
  const eloMap = {};
  for (const npc of roster) {
    eloMap[npc.id] = worldData.npcs[npc.id]?.currentElo ?? npc.startingElo;
  }

  // ── Step 1: Simulate all 5 tournament brackets ──────────────────────────────

  const pointsEarned = {}; // npcId → total skill points earned this season

  for (let tier = 1; tier <= 5; tier++) {
    const config   = TOURNAMENT_CONFIG[tier - 1];
    const eligible = roster.filter(n => n.tournamentLevel <= tier);
    const n        = Math.min(config.players, eligible.length);
    if (n < 2) continue;

    // Reduce to nearest power of 2 (defensive — should always be clean with real data)
    const pow2 = Math.pow(2, Math.floor(Math.log2(n)));

    // Random selection from eligible pool, then seed by ELO descending
    const selected = [...eligible]
      .sort(() => roll() - 0.5)
      .slice(0, pow2)
      .map(npc => ({ id: npc.id, elo: eloMap[npc.id] }))
      .sort((a, b) => b.elo - a.elo);

    const { winner, runnerUp } = runBracketSimulation(selected, eloMap);

    if (winner) {
      pointsEarned[winner.id] = (pointsEarned[winner.id] ?? 0) + SKILL_POINTS_AWARD[tier].winner;
    }
    if (runnerUp) {
      pointsEarned[runnerUp.id] = (pointsEarned[runnerUp.id] ?? 0) + SKILL_POINTS_AWARD[tier].runnerUp;
    }
  }

  // ── Steps 2 & 3: Award skill points, spend them, update ELOs ───────────────

  for (const npc of roster) {
    const npcState = worldData.npcs[npc.id];
    if (!npcState) continue;

    npcState.currentElo = eloMap[npc.id] ?? npcState.currentElo;

    const carried = npcState.unspentSkillPoints ?? 0;
    const earned  = pointsEarned[npc.id] ?? 0;
    const remaining = spendSkillPoints(
      npcState.treeState, npc.primaryTree, npc.secondaryTree, carried + earned
    );
    npcState.unspentSkillPoints = remaining;
  }

  // ── Step 4: Recompute player worldRank ─────────────────────────────────────

  const playerElo = progress.currentElo;
  const npcElos   = roster.map(n => eloMap[n.id] ?? 0);
  const worldRank = npcElos.filter(e => e > playerElo).length + 1;
  // +1 because rank 1 means no one is above you

  const season = progress.currentSeason ?? 1;

  // ── Step 5: Write world bucket ──────────────────────────────────────────────

  worldData.season = season;
  saveWorld(charId, worldData);

  // ── Step 6: Write progress bucket ──────────────────────────────────────────

  progress.worldRank     = worldRank;
  progress.peakElo       = Math.max(progress.peakElo ?? 0, playerElo);
  progress.peakWorldRank = Math.min(progress.peakWorldRank ?? (TOTAL_PLAYERS + 1), worldRank);
  saveProgress(charId, progress);

  // ── Step 7: Write trophies bucket ──────────────────────────────────────────

  trophies.seasonEloHistory = trophies.seasonEloHistory ?? [];
  trophies.seasonEloHistory.push({ season, endElo: playerElo, worldRank });
  saveTrophies(charId, trophies);

  // ── Step 8: Write stats bucket (zero season stats) ─────────────────────────
  // Caller must have already updated career totals before calling here.

  if (stats) {
    stats.season = {
      rock: 0, paper: 0, scissors: 0,
      rockWins: 0, paperWins: 0, scissorsWins: 0,
    };
    saveStats(charId, stats);
  }
}

// ── Mid-season rank refresh ────────────────────────────────────────────────────

// Computes world rank from the current stored NPC ELOs (no simulation).
// Called after every tournament match so the HUD rank stays current.
export function computeMidSeasonRank(playerElo, worldData, roster) {
  if (!worldData?.npcs) return null;
  const npcElos = roster.map(n => worldData.npcs[n.id]?.currentElo ?? n.startingElo);
  return npcElos.filter(e => e > playerElo).length + 1;
}

// ── Milestone detection ────────────────────────────────────────────────────────

// Pure function: determines which ranking milestone messages to show this season.
// newRank        — worldRank after season simulation (1 = best)
// prevPeakRank   — player's best rank before this season (null = never ranked)
// achievedSet    — array of already-triggered one-shot milestone IDs
// Returns { messages, newAchieved } — messages to display, updated achieved array.
export function detectRankingMilestones(newRank, prevPeakRank, achievedSet) {
  const messages   = [];
  const newAchieved = [...achievedSet];

  for (const ms of RANKING_MILESTONES) {
    if (newRank <= ms.threshold && !newAchieved.includes(ms.id)) {
      messages.push(ms.message);
      newAchieved.push(ms.id);
    }
  }

  // Personal best fires whenever rank improves past previous best (repeatable).
  if (prevPeakRank === null || newRank < prevPeakRank) {
    messages.push(MILESTONE_PERSONAL_BEST_MSG);
  }

  return { messages, newAchieved };
}
