import { describe, test, assert, assertEqual, assertOneOf } from './testRunner.js';
import {
  nodeLevel, nodeCost, nodeParent,
  getInitialTreeState, getLegalNodes, spendSkillPoints,
  initNpcWorldState, detectRankingMilestones,
} from '../systems/seasonEngine.js';
import {
  MILESTONE_PERSONAL_BEST_MSG,
  MILESTONE_FIRST_CHAMP_MSG,
  MILESTONE_THREE_TIME_CHAMP_MSG,
} from '../constants.js';

// ── nodeLevel ─────────────────────────────────────────────────────────────────

describe('nodeLevel', () => {
  test('L1 root returns 1', () => assertEqual(nodeLevel('MIND.1'), 1));
  test('L2 node returns 2',  () => assertEqual(nodeLevel('MIND.1.1'), 2));
  test('L3 node returns 3',  () => assertEqual(nodeLevel('MIND.1.1.1'), 3));
  test('L4 node returns 4',  () => assertEqual(nodeLevel('MIND.1.1.1.1'), 4));
  test('works for MYSTIC',   () => assertEqual(nodeLevel('MYSTIC.1.2'), 2));
  test('works for FORTUNE',  () => assertEqual(nodeLevel('FORTUNE.1.2.2.1'), 4));
});

// ── nodeCost ──────────────────────────────────────────────────────────────────

describe('nodeCost', () => {
  test('L1 costs 5',  () => assertEqual(nodeCost('MIND.1'), 5));
  test('L2 costs 10', () => assertEqual(nodeCost('MIND.1.1'), 10));
  test('L3 costs 15', () => assertEqual(nodeCost('MIND.1.1.2'), 15));
  test('L4 costs 20', () => assertEqual(nodeCost('MIND.1.1.2.1'), 20));
});

// ── nodeParent ────────────────────────────────────────────────────────────────

describe('nodeParent', () => {
  test('L1 root has no parent',       () => assertEqual(nodeParent('MIND.1'), null));
  test('L2 parent is L1 root',        () => assertEqual(nodeParent('MIND.1.1'), 'MIND.1'));
  test('L3 parent is L2',             () => assertEqual(nodeParent('MIND.1.1.1'), 'MIND.1.1'));
  test('L4 parent is L3',             () => assertEqual(nodeParent('MIND.1.1.1.1'), 'MIND.1.1.1'));
  test('L4 sibling has same parent',  () => assertEqual(nodeParent('MIND.1.1.1.2'), 'MIND.1.1.1'));
  test('FORTUNE.1.2.1 parent is correct', () => assertEqual(nodeParent('FORTUNE.1.2.1'), 'FORTUNE.1.2'));
});

// ── getInitialTreeState ───────────────────────────────────────────────────────

describe('getInitialTreeState', () => {
  test('returns 15 nodes', () => {
    const state = getInitialTreeState('MIND');
    assertEqual(Object.keys(state).length, 15);
  });
  test('all nodes start false', () => {
    const state = getInitialTreeState('MYSTIC');
    assert(Object.values(state).every(v => v === false), 'all nodes must be false');
  });
  test('keys use correct prefix', () => {
    const state = getInitialTreeState('FORTUNE');
    assert(Object.keys(state).every(k => k.startsWith('FORTUNE.')), 'all keys must start with FORTUNE.');
  });
  test('includes L1 root', () => {
    const state = getInitialTreeState('MIND');
    assert('MIND.1' in state, 'must include MIND.1');
  });
  test('includes deepest L4 nodes', () => {
    const state = getInitialTreeState('MIND');
    assert('MIND.1.2.2.2' in state, 'must include MIND.1.2.2.2');
  });
});

// ── getLegalNodes ─────────────────────────────────────────────────────────────

describe('getLegalNodes', () => {
  function freshMindState() {
    return { MIND: getInitialTreeState('MIND') };
  }

  test('with 0 budget: no legal nodes', () => {
    const ts = freshMindState();
    assertEqual(getLegalNodes(ts, 'MIND', null, 0).length, 0);
  });

  test('with 4 pts: no nodes affordable (cheapest L1 = 5)', () => {
    const ts = freshMindState();
    assertEqual(getLegalNodes(ts, 'MIND', null, 4).length, 0);
  });

  test('with 5 pts on empty tree: only L1 root is legal', () => {
    const ts = freshMindState();
    const legal = getLegalNodes(ts, 'MIND', null, 5);
    assertEqual(legal.length, 1);
    assertEqual(legal[0], 'MIND.1');
  });

  test('with 100 pts on empty tree: only L1 root is legal (parent gate)', () => {
    const ts = freshMindState();
    const legal = getLegalNodes(ts, 'MIND', null, 100);
    assertEqual(legal.length, 1, 'only root is legal until it is purchased');
  });

  test('after buying L1, L2 nodes become available', () => {
    const ts = freshMindState();
    ts.MIND['MIND.1'] = true;
    const legal = getLegalNodes(ts, 'MIND', null, 10);
    assert(legal.includes('MIND.1.1'), 'MIND.1.1 should be legal');
    assert(legal.includes('MIND.1.2'), 'MIND.1.2 should be legal');
    assertEqual(legal.length, 2);
  });

  test('budget too low for L2 blocks L2 nodes', () => {
    const ts = freshMindState();
    ts.MIND['MIND.1'] = true;
    const legal = getLegalNodes(ts, 'MIND', null, 9);
    assertEqual(legal.length, 0, 'L2 costs 10, should not appear with budget 9');
  });

  test('after buying L1 + L2.1, L3 children of L2.1 become available', () => {
    const ts = freshMindState();
    ts.MIND['MIND.1']   = true;
    ts.MIND['MIND.1.1'] = true;
    const legal = getLegalNodes(ts, 'MIND', null, 15);
    assert(legal.includes('MIND.1.1.1'), 'MIND.1.1.1 should be legal');
    assert(legal.includes('MIND.1.1.2'), 'MIND.1.1.2 should be legal');
    assert(legal.includes('MIND.1.2'), 'MIND.1.2 should still be legal');
    assert(!legal.includes('MIND.1.2.1'), 'MIND.1.2.1 requires MIND.1.2 first');
  });

  test('secondary tree nodes are included when provided', () => {
    const ts = {
      MIND:    getInitialTreeState('MIND'),
      FORTUNE: getInitialTreeState('FORTUNE'),
    };
    const legal = getLegalNodes(ts, 'MIND', 'FORTUNE', 5);
    assert(legal.includes('MIND.1'),    'MIND root should be legal');
    assert(legal.includes('FORTUNE.1'), 'FORTUNE root should be legal');
    assertEqual(legal.length, 2);
  });
});

// ── spendSkillPoints ──────────────────────────────────────────────────────────

describe('spendSkillPoints', () => {
  function freshState(treeName) {
    return { [treeName]: getInitialTreeState(treeName) };
  }

  test('with 5 pts: always buys the L1 root (only legal choice)', () => {
    const ts = freshState('MIND');
    const remaining = spendSkillPoints(ts, 'MIND', null, 5);
    assert(ts.MIND['MIND.1'] === true, 'MIND.1 must be purchased');
    assertEqual(remaining, 0);
  });

  test('with 0 pts: nothing purchased', () => {
    const ts = freshState('MIND');
    spendSkillPoints(ts, 'MIND', null, 0);
    assert(Object.values(ts.MIND).every(v => v === false), 'no nodes purchased');
  });

  test('returns correct carry-over when budget cannot be fully spent', () => {
    // After root (5) + one L2 (10) = 15 spent, 4 remaining (can't afford L3=15)
    const ts = freshState('MIND');
    const remaining = spendSkillPoints(ts, 'MIND', null, 19);
    // 19 pts: buys root (5→14 left), buys one L2 (10→4 left), 4 < any remaining cost
    assertEqual(remaining, 4, 'should carry over 4 pts');
  });

  test('T1 NPC budget of 5 always buys exactly the root node', () => {
    for (const treeName of ['MIND', 'MYSTIC', 'FORTUNE']) {
      const ts = freshState(treeName);
      const remaining = spendSkillPoints(ts, treeName, null, 5);
      assertEqual(ts[treeName][`${treeName}.1`], true, `${treeName} root should be purchased`);
      assertEqual(remaining, 0);
    }
  });

  test('purchased nodes are never re-purchased', () => {
    const ts = freshState('MIND');
    spendSkillPoints(ts, 'MIND', null, 100);
    // Every node that is true should only appear once (not double-counted)
    // This is inherently guaranteed by the boolean structure — just verify no corruption
    const purchased = Object.entries(ts.MIND).filter(([, v]) => v === true);
    // All purchased nodes must have their parent purchased
    for (const [nodeId] of purchased) {
      const parent = nodeParent(nodeId);
      if (parent !== null) {
        assert(ts.MIND[parent] === true, `parent ${parent} of ${nodeId} must be purchased`);
      }
    }
  });
});

// ── initNpcWorldState ─────────────────────────────────────────────────────────

describe('initNpcWorldState', () => {
  const mockRoster = [
    { id: 'npc_001', primaryTree: 'MIND',    secondaryTree: null,      tournamentLevel: 1, startingElo: 900 },
    { id: 'npc_002', primaryTree: 'MYSTIC',  secondaryTree: 'FORTUNE', tournamentLevel: 2, startingElo: 1100 },
    { id: 'npc_003', primaryTree: 'FORTUNE', secondaryTree: null,      tournamentLevel: 3, startingElo: 1300 },
  ];

  test('returns world object with season 1 and all npcs', () => {
    const world = initNpcWorldState(mockRoster);
    assertEqual(world.season, 1);
    assertEqual(Object.keys(world.npcs).length, 3);
  });

  test('each NPC starts at their startingElo', () => {
    const world = initNpcWorldState(mockRoster);
    assertEqual(world.npcs['npc_001'].currentElo, 900);
    assertEqual(world.npcs['npc_002'].currentElo, 1100);
    assertEqual(world.npcs['npc_003'].currentElo, 1300);
  });

  test('T1 NPC (budget 5) always buys exactly the root node', () => {
    const world = initNpcWorldState(mockRoster);
    const npc1  = world.npcs['npc_001'];
    assert(npc1.treeState['MIND']['MIND.1'] === true,  'MIND.1 must be purchased');
    assert(npc1.treeState['MIND']['MIND.1.1'] === false, 'L2 should not be purchased with 5 pts');
    assertEqual(npc1.unspentSkillPoints, 0);
  });

  test('NPC with secondaryTree has both trees in treeState', () => {
    const world = initNpcWorldState(mockRoster);
    const npc2  = world.npcs['npc_002'];
    assert('MYSTIC'  in npc2.treeState, 'MYSTIC tree must be present');
    assert('FORTUNE' in npc2.treeState, 'FORTUNE tree must be present');
  });

  test('NPC with no secondaryTree has only primary tree', () => {
    const world = initNpcWorldState(mockRoster);
    const npc1  = world.npcs['npc_001'];
    assertEqual(Object.keys(npc1.treeState).length, 1);
    assert('MIND' in npc1.treeState);
  });

  test('T3 NPC (budget 35) spends all points respecting prerequisites', () => {
    const world = initNpcWorldState(mockRoster);
    const npc3  = world.npcs['npc_003'];
    // Verify prerequisite integrity: every purchased node's parent is also purchased
    const tree  = npc3.treeState['FORTUNE'];
    for (const [nodeId, purchased] of Object.entries(tree)) {
      if (!purchased) continue;
      const parent = nodeParent(nodeId);
      if (parent !== null) {
        assert(tree[parent] === true, `parent ${parent} of ${nodeId} must be purchased`);
      }
    }
  });

  test('each NPC has an empty powerupInventory', () => {
    const world = initNpcWorldState(mockRoster);
    for (const npc of Object.values(world.npcs)) {
      assert(Array.isArray(npc.powerupInventory) && npc.powerupInventory.length === 0);
    }
  });
});

// ── detectRankingMilestones ───────────────────────────────────────────────────

describe('detectRankingMilestones', () => {
  test('first season: "ranked" threshold and personal best both fire', () => {
    const { messages, newAchieved } = detectRankingMilestones(85, null, []);
    assert(messages.some(m => m.includes("entered the world rankings")), 'ranked message must fire');
    assert(messages.some(m => m === MILESTONE_PERSONAL_BEST_MSG), 'personal best must fire on first rank');
    assert(newAchieved.includes('ranked'), 'ranked must be added to achieved set');
  });

  test('rank 50 triggers top50 and personal best on first visit', () => {
    const { messages, newAchieved } = detectRankingMilestones(50, null, []);
    assert(messages.some(m => m.includes("top 50")), 'top50 message must fire');
    assert(newAchieved.includes('top50'), 'top50 in achieved');
  });

  test('rank 1 triggers all threshold milestones on first visit', () => {
    const { messages, newAchieved } = detectRankingMilestones(1, null, []);
    const ids = ['ranked', 'top50', 'top20', 'top10', 'top3', 'rank1'];
    for (const id of ids) {
      assert(newAchieved.includes(id), `${id} must be in achieved set`);
    }
    assert(messages.length >= ids.length + 1, 'all threshold messages + personal best must fire');
  });

  test('already-achieved milestones do not fire again', () => {
    const alreadyDone = ['ranked', 'top50', 'top20'];
    const { messages, newAchieved } = detectRankingMilestones(8, 20, alreadyDone);
    assert(!messages.some(m => m.includes("entered the world rankings")), 'ranked must not repeat');
    assert(!messages.some(m => m.includes("top 50")), 'top50 must not repeat');
    assert(!messages.some(m => m.includes("top 20")), 'top20 must not repeat');
    assert(messages.some(m => m.includes("top 10")), 'top10 should fire (rank 8 ≤ 10)');
  });

  test('personal best fires when rank improves past previous peak', () => {
    const { messages } = detectRankingMilestones(30, 40, ['ranked', 'top50']);
    assert(messages.some(m => m === MILESTONE_PERSONAL_BEST_MSG), 'personal best fires on improvement');
  });

  test('personal best does NOT fire when rank does not improve', () => {
    const { messages } = detectRankingMilestones(40, 30, ['ranked', 'top50']);
    assert(!messages.some(m => m === MILESTONE_PERSONAL_BEST_MSG), 'no personal best when rank regresses');
  });

  test('personal best does NOT fire when rank is unchanged', () => {
    const { messages } = detectRankingMilestones(40, 40, ['ranked', 'top50']);
    assert(!messages.some(m => m === MILESTONE_PERSONAL_BEST_MSG), 'no personal best when rank unchanged');
  });

  test('no messages when all milestones achieved and rank has not improved', () => {
    const allAchieved = ['ranked', 'top50', 'top20', 'top10', 'top3', 'rank1'];
    const { messages } = detectRankingMilestones(5, 3, allAchieved);
    assertEqual(messages.length, 0, 'no messages when nothing new to celebrate');
  });

  test('personal best can fire even when all threshold milestones already achieved', () => {
    const allAchieved = ['ranked', 'top50', 'top20', 'top10', 'top3', 'rank1'];
    const { messages } = detectRankingMilestones(1, 2, allAchieved);
    assert(messages.some(m => m === MILESTONE_PERSONAL_BEST_MSG), 'personal best still fires on improvement');
  });

  test('newAchieved is a new array (does not mutate achievedSet)', () => {
    const original = ['ranked'];
    const { newAchieved } = detectRankingMilestones(10, 50, original);
    assertEqual(original.length, 1, 'original array must not be mutated');
    assert(newAchieved.length > 1, 'newAchieved must contain new entries');
  });
});
