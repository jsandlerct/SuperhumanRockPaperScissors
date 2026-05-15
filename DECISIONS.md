# DECISIONS.md — SRPS Locked Decisions
**Append-only.** Decisions here are not up for debate in implementation sessions.
**If a decision needs revisiting, raise it with the designer first — do not just implement differently.**
**Format:** `[vX.XX | Date] Decision — Rationale`

---

## Off-Season Respec (v0.3 revision)

**[v0.3 | 2026-05-15] Off-season respec preserves L1 root nodes; only L2+ nodes are refunded.**
`computeRefund` and `clearTreeState` in `offSeason.js` skip level-1 nodes. The player keeps their committed trees but gets all other points back to reallocate. Rationale: makes it visually and mechanically clear that tree identity is permanent — the root stays purchased; only the build within the tree is resettable.

---

## Complete Powerup Catalog (v0.3)

**[v0.3 | 2026-05-09] Protein Shake (Basic | MIND | round) implemented: sets `roundCanChangeThrow = true`, records `roundProteinShakeOriginalThrow` at activation. In `handleAdvanceFromReveal`, if throw changed AND result was player win (before force overrides), awards 1 Basic drop via `generateBonusDrops`. Reset in `resetRoundScopeState`.**

**[v0.3 | 2026-05-09] Jonesing to Help (Legendary | MYSTIC | season | jessieOnly) implemented: activates via `activateSeasonEffect('Jonesing to Help')` in `activatePowerup`. At match start (mount-time), `deliverJonesingDropIfActive()` checks `seasonEffectActive('Jonesing to Help')` — if true, generates 1 Advanced drop via `generateBonusDrops`, sets `matchStartPhase = true`, and calls `processNextDrop()` to deliver it before first round. `matchStartPhase` flag reroutes `btn-drop-ok` to `checkT08ThenRender()` instead of `advanceRound()` so round number is not incremented by the match-start delivery.**

**[v0.3 | 2026-05-09] Clockwork Orange removed from POWERUP_NO_OP. It was never in the set — it has a working implementation (`resetActiveCooldowns()` in the switch case). Comment in POWERUP_IMPLEMENTED corrected accordingly.**

---

## Coach Jessie — Tutorial Beat Rework (v0.3)

**[v0.3 | 2026-05-09] Tutorial beat system fully reworked to match design doc Section 15.4 (SRPS_Tutorial_Flow_DRAFT_v3.pdf). Beats T-01 through T-14 replace earlier T-01 through T-05 implementation.**
Beat mapping and trigger points: T-01 (Meet Jessie — 14-box narration+Jessie sequence, 4 narration-only boxes) fires in `characterCreate.js` after saving character data, before `navigate('skillTree')`; T-02 (skill trees intro) + T-03 (skill allocation) fire in sequence in `skillTree.js` on Season 1 pre-season mount; T-04 (bracket navigation) fires in `tournament.js` on tier 1 mount; T-05 (round mechanic) fires in `match.js` at mount before first render; T-06 (gut check intro) fires on first gut_check phase entry via `enterGutCheckPhase()` helper; T-07 (first round result — win/loss/tie variants) fires in `handleReady()` after first round resolves, auto-dismisses after 3s; T-08 (active skill introduction) fires when first ready active skill exists, via `checkT08ThenRender()` helper called from `advanceRound` / `replayRound`; T-09 (powerup intro) fires at match mount for MIND players with starting inventory, otherwise at first `drop_result` state; T-10 dropped (merged into T-08); T-11 merged into T-08; T-12 (ELO & rankings) fires in `rankingsOverlay.js` on first ever overlay open, using a temporary full-screen container; T-13 (off-season respec) fires in `offSeason.js` on first mount; T-14 (second tree unlock) fires in `skillTree.js` on Season 2+ pre-season mount.

**[v0.3 | 2026-05-09] `showJessieDialogue` extended to support narration boxes and auto-dismiss.**
New signature: `showJessieDialogue(container, messages, expression, onComplete, opts = {})`. Message items can be strings (standard Jessie box) or `{ text, narration: true }` objects (no portrait, centered italic panel). `opts.autoDismissMs` adds `setTimeout(onComplete, ms)` on last message; button label changes to "▶ SKIP"; tap clears the timer and advances. Used by T-01 (narration boxes) and T-07 (auto-dismiss 3s).

**[v0.3 | 2026-05-09] T-01 `[SKILL_POINTS]` placeholder replaced at call site in `characterCreate.js`.**
The constant stores the literal string `[SKILL_POINTS]`; `characterCreate.js` maps the messages array and replaces it with `String(STARTING_SKILL_POINTS_SEASON_1)` before calling `showJessieDialogue`.

**[v0.3 | 2026-05-09] T-08 `[SKILL_NAME]` placeholder replaced at call site in `match.js`.**
`JESSIE_TUTORIAL_DIALOGUE['T-08']` stores `lineTemplate` with `[SKILL_NAME]`. `getFirstReadyActiveSkillName()` returns the display name of the first active skill with cooldown ready (or null). The template is replaced before calling `showJessieDialogue`.

---

## Skill Information Phase (v0.3)

**[v0.3 | 2026-05-09] Passive skills panel added to match screen (picking + gut_check phases).**
All purchased passive skills (and L1 roots) appear as tappable cards with a live status line below active skills. MIND.1.1 (NPR) is excluded from the passive panel (handled by renderNPRIndicator). Replaced passives are suppressed (e.g. Lucky Socks hidden when Fingers Crossed owned). Tapping any skill card (active or passive) opens a skill inspect popup showing full effect text, level/tree/kind badge, and current status. Popup uses the same pu-popup-layer and backdrop as the powerup popup — only one popup can be open at a time. skillPopup state is cleared on transition to revealing phase.

**[v0.3 | 2026-05-09] L4 skill tree node boxes: height 50 → 64px; font size reduced for L4 only.**
`nh(4)` changed from 50 to 64 (CH updated accordingly). L4 name font uses `Math.max(6, COL * 0.088)` instead of `Math.max(7, COL * 0.10)`, cost font uses `Math.max(5, COL * 0.075)`. Ensures long names like "Mental Mysticism" and "Adv. Neural Pattern Rec." fit without clipping and the word "Mysticism" does not split across lines.

---

## Coach Jessie — Tutorial + Milestone Dialogues (v0.3)

**[v0.3 | 2026-05-09] Jessie tutorial + milestone system fully implemented.**
Shared utility in `js/ui/jessieDialogue.js` exports `showJessieDialogue` (full-screen tap-through), `jessieInlinePanel` (static inline HTML), `tutorialBeatShown`, `markTutorialBeat`. All dialogue constants live in `constants.js`: `JESSIE_TUTORIAL_DIALOGUE` (T-01–T-05), `JESSIE_MILESTONE_DIALOGUE`, `JESSIE_MILESTONE_PRIORITY`, `JESSIE_SEASON_CHECKIN` (8 rotating M-12 entries). One-shot beats tracked in `_trophies.jessieOneShots`; M-12 rotation tracked in `_trophies.jessieSeasonCheckInHistory` (resets after all 8 used).

**[v0.3 | 2026-05-09] Tutorial beat firing points.**
T-01 (skill trees): `skillTree.js` mount — Season 1, pre-season only, fires before `render()`. T-02 (tournament/bracket): `tournament.js` mount — tier 1 only, fires before first `renderScreen()`. T-03 (round mechanic): `match.js` mount — fires before first `render()` on any match. T-04 (powerups): `match.js` `processNextDrop()` — fires once when `drop_result` state is first entered. T-05 (off-season respec): `offSeason.js` mount — first visit; no M-12 panel on the same visit. M-12 inline panel shown on all subsequent off-seasons from the `JESSIE_SEASON_CHECKIN` rotation array.

**[v0.3 | 2026-05-09] Milestone dialogue routing in summary.js.**
`runSeasonEnd()` snapshots `prevAchievedSet` before calling `detectRankingMilestones`. Championship milestone IDs (`first_champ`, `three_time_champ`) derived from `t5WinsBefore`. `JESSIE_MILESTONE_PRIORITY` array picks the single highest-priority beat when multiple milestones fire the same season. Eliminated players route through `JESSIE_CONSOLATION_DIALOGUE`; champion/runner-up with a milestone route through `JESSIE_MILESTONE_DIALOGUE`; all others skip to results. Old local `renderJessieDialogue` function removed (replaced by imported `showJessieDialogue`).

---

## Full 4-Level Skill Trees (v0.3)

**[v0.3 | 2026-05-08] 6 L3 nodes were incorrectly named/assigned vs the design doc; all corrected to match SRPS_skill_trees_v1_0.html.**
Corrected mappings: MIND.1.2.2 = The Cooler (was Mind Shield passive). MYSTIC.1.1.1 = Force Your Hand active (was Alter Reality passive). MYSTIC.1.2.1 = Brain Fart active (was Oblivious passive). MYSTIC.1.2.2 = Mind Shield passive (was The Cooler passive). FORTUNE.1.2.1 = Change My Luck active (was Force Your Hand active). FORTUNE.1.2.2 = Oblivious passive (was Change My Luck active). Constant names (ALTER_REALITY_CHANCE, MIND_SHIELD_CHANCE, etc.) retained unchanged — only node metadata and hasSkill() references updated.

**[v0.3 | 2026-05-08] All 24 L4 nodes defined in SKILL_TREE_L4 and made fully purchasable.**
Gate: requires parent L3 purchased. Cost NODE_COST.L4 (20 pts). Added to SKILL_NODE_INFO loop. skillTreePanel.js updated to render real L4 IDs (no more null placeholders), show labels, and use full-opacity connections. skillTree.js handleBuy now checks L4 parent same as L3.

**[v0.3 | 2026-05-08] Alter Reality (L4, MYSTIC.1.1.1.2) passive tie conversion — node ID corrected in match.js tie resolution.**
Was checking hasSkill('MYSTIC.1.1.1'); now correctly checks hasSkill('MYSTIC.1.1.1.2').

**[v0.3 | 2026-05-08] Force Your Hand moved to MYSTIC.1.1.1; Change My Luck moved to FORTUNE.1.2.1 with new effect.**
Force Your Hand: active, 5-round CD (3 with Twist Your Arm MYSTIC.1.1.1.1 — shared tracker). Arms `roundForceHandActive` flag; resolves in handleReady before passives. Change My Luck: active, 3-round CD; arms `roundChangeMyLuckActive`; if round is lost, generates 2 Basic+ drops in handleAdvanceFromReveal. No longer sets roundDizzySpell.

**[v0.3 | 2026-05-08] Brain Fart (MYSTIC.1.2.1) is a no-op active skill; button + 3-round cooldown tracking implemented.**
No gameplay effect until NPC active skills are implemented (v1.0). Same applies to Massive Brain Fart (MYSTIC.1.2.1.1), Lucky Charm (FORTUNE.1.2.2.1), Not Today! (MIND.1.2.2.1), Phantom Memory (MYSTIC.1.2.2.1).

**[v0.3 | 2026-05-08] L4 active skills with real effects wired up in match.js.**
Mental Mysticism (MIND.1.1.2.1, 3-round CD): precondition hasNPRFiredThisMatch; 90% tie→win. Twist Your Arm (MYSTIC.1.1.1.1): replaces Force Your Hand in panel, 3-round CD, shares forceYourHandCooldown. Refuse to Lose (MYSTIC.1.1.2.1, 3-round CD): 90% loss→immune tie (tieIsImmune prevents all alteration). IGaH (FORTUNE.1.1.2.1, 3-round CD): 50% chance of strategy read at 90% accuracy, NOT blocked by Mind Shield. Reversal of Fortune (FORTUNE.1.2.1.1, 3-round CD): arms flag; 2 Advanced+ drops if round lost. Look What I Found (FORTUNE.1.2.1.2, passive): 25% independent chance on loss (stacks with Consolation Prize). ATML (FORTUNE.1.1.1.1): replaces TML in panel, 3-round CD instead of 5. Fingers Crossed (FORTUNE.1.1.1.2, passive): bumps TML/ATML success to 95% (replaces Lucky Socks). Adv. NPR (MIND.1.1.1.2, passive): accumulation 10%→15%/round. Total Recall (MIND.1.2.1.1): replaces Memory Wipe in panel, shares memoryWipeUsed flag, once per match. Uncanny Mind (MIND.1.1.2.2, passive): +10% advanced / +5% legendary upgrade bonus, stacks with MYSTIC.1. Probability Storm (MYSTIC.1.1.2.2, passive): 50% chance non-Basic drop in generateDrops yields 2 copies.

**[v0.3 | 2026-05-08] renderSkillsPanel suppresses parent skills when their replacement L4 is purchased.**
MIND.1.1.1 hidden when MIND.1.1.1.1 owned; MYSTIC.1.1.1 hidden when MYSTIC.1.1.1.1 owned; FORTUNE.1.1 hidden when FORTUNE.1.1.1.1 owned; MIND.1.2.1 hidden when MIND.1.2.1.1 owned.

---

## Cross-Tree Synergy Nodes (v0.3)

**[v0.3 | 2026-05-08] Cross-tree synergy mechanics are fully implemented; task completed by confirming existing coverage and adding negative-synergy tests.**
All three X.1.1.2 synergy nodes (MIND.1.1.2, MYSTIC.1.1.2, FORTUNE.1.1.2) were already implemented: `getLoadoutKey()` routes to the correct synergy loadout key, `getMaxSlots()` grants the 6th slot for FORTUNE.1.1.2 + MIND root, and skill effects (Desperate Clarity, Third Time's the Charm, Due for a Win) were tested in `skills.test.js`. The missing coverage — negative-synergy cases — was added to `powerupEngine.test.js`: tests confirming that owning an L3 synergy node WITHOUT the partner tree's root does NOT activate the synergy bonus (falls back to single-tree loadout). Four tests added: MIND.1.1.2-alone → MIND_only, MYSTIC.1.1.2-alone → MYSTIC_only, FORTUNE.1.1.2-alone → FORTUNE_only + 3 slots, and a paired comparison verifying synergy activates only with the partner root.

---

## MIND Powerup Implementations (v0.3)

**[v0.3 | 2026-05-07] Espresso Shot resolves by comparing primary and backup throws; best outcome (win > tie > loss) counts. When backup is better, `currentThrow` is updated to the backup before reveal so the correct throw image is shown. Force-win and force-loss still override after Espresso Shot comparison.**
**[v0.3 | 2026-05-07] Espresso Shot backup throw is chosen by the player in gut_check (not generated randomly). `roundEspressoShotActive` flag is set on activation; READY is disabled until `roundEspressoShotBonus` is set. The picker shows all 3 throw buttons with `data-espresso` attributes.**

**[v0.3 | 2026-05-07] A Word From Your Coach is match-scoped. Each round at gut_check, the system picks a random throw that is NOT the NPC's throw and shows it as eliminated. Stored in `roundWordFromCoachElim` (per-round, resets in `resetRoundScopeState`). Always grants throw-change.**

**[v0.3 | 2026-05-07] Reading Glasses (15%, tournament), Smart Glasses (20%, season), Courtside with Jessie (40%, tournament) are passive per-round rolls added to `generateRoundRead` candidates. All grant throw-change. Higher-confidence active reads (Focus Group, Focused FG) take precedence via sort. Constants: `READING_GLASSES_CHANCE`, `SMART_GLASSES_CHANCE`, `COURTSIDE_CHANCE`.**

**[v0.3 | 2026-05-07] `resetMatch()` (Cosmic Insurance Policy) now explicitly resets all match-scope powerup flags including `matchWordFromCoach`, Focus Group, Hiccup Potion, etc. Previously only skill-scope state was reset — powerup flags were accidentally preserved across the reset.**

---

## L3 Skill Tree Nodes (v0.3)

**[v0.3 | 2026-05-05] All 12 L3 nodes defined across MIND / MYSTIC / FORTUNE and wired into match.js.**
Node list: MIND.1.1.1 (Neural Scan, active), MIND.1.1.2 (Desperate Clarity, passive), MIND.1.2.1 (Memory Wipe, active), MIND.1.2.2 (Mind Shield, passive no-op until NPC NPR), MYSTIC.1.1.1 (Alter Reality, passive — replaces Tweak Reality at 60%), MYSTIC.1.1.2 (Third Time's the Charm, passive), MYSTIC.1.2.1 (Oblivious, passive no-op until NPC skills), MYSTIC.1.2.2 (The Cooler, passive no-op until NPC TML), FORTUNE.1.1.1 (Lucky Socks, passive — bump TML to 85%; effect wired), FORTUNE.1.1.2 (Due for a Win, passive), FORTUNE.1.2.1 (Force Your Hand, active), FORTUNE.1.2.2 (Change My Luck, active).

**[v0.3 | 2026-05-05] L3 node locking: requires parent L2 to be purchased. Gate in both skillTreePanel.js (display) and skillTree.js (handleBuy).**

**[v0.3 | 2026-05-05] L3 synergy nodes now trigger synergy loadout keys in powerupEngine.js `getLoadoutKey()`.**
MIND.1.1.2 + MYSTIC root → `MIND_MYSTIC_synergy`. FORTUNE.1.1.2 + MIND root → `MIND_FORTUNE_synergy` (6th slot). MYSTIC.1.1.2 + FORTUNE root → `MYSTIC_FORTUNE_synergy`.

**[v0.3 | 2026-05-05] Neural Scan (MIND.1.1.1) uses `progress.crossMatchState.neuralScanMatchesSinceLastUse` for cross-match cooldown.** Counter saved to localStorage on use (reset to 0) and incremented in `finishMatch()` (capped at cooldown value). Loaded at match mount. Active cooldown = 5 matches (or 3 with MIND.1.1.1.1). One tracker serves both Neural Scan and Neural Scan 2.0 (L4).

**[v0.3 | 2026-05-05] Alter Reality (MYSTIC.1.1.1) replaces Tweak Reality when purchased — 60% not 30%, not additive.**

**[v0.3 | 2026-05-05] Third Time's the Charm (MYSTIC.1.1.2) tracks consecutive passive tie-conversion failures (`thirdTimesCharmFails`). Force Your Hand activation (active, different skill) does NOT count as a failure for this tracker — only Tweak/Alter Reality passive failures count.**

**[v0.3 | 2026-05-05] `tieIsImmune` flag added for future Refuse to Lose (L4). Always false currently. Clears in `resetRoundScopeState()` (every round). Blocks all tie-altering skills when true.**

**[v0.3 | 2026-05-05] Force Your Hand (FORTUNE.1.2.1) armed during picking/gut_check, resolves in `handleReady()` before passive Tweak/Alter Reality. Per Section 6.5: active runs before passive; if active triggered, passive does not roll.**

**[v0.3 | 2026-05-05] Lucky Socks (FORTUNE.1.1.1) bumps TML success chance from 75% → 85% immediately when purchased. Effect wired in `handleTrustMyLuck()`. Fingers Crossed (L4) will further bump to 95%.**

**[v0.3 | 2026-05-05] Due for a Win boost consumed on first TML activation after 2+ failures, regardless of outcome. Marked `dueForAWinUsed = true` so it cannot fire again that match.**

**[v0.3 | 2026-05-05] Desperate Clarity (MIND.1.1.2) adds `+20%` permanently to NPR floor (`desperateClarityBonus`). On NPR fire, accumulation resets to `desperateClarityBonus` (not 0). Triggers once per match after 2 consecutive round losses.**

---

## Off-Season Respec & Season 2 Tree Selection (v0.3)

**[v0.3 | 2026-05-05] `canRefund = !midSeason` (not `isSeason1 && !midSeason` as previously stated).**
Refunds are now allowed during any pre-season phase, not just Season 1. Rationale: off-season clears all nodes before pre-season begins, so the player is always building from a blank slate. Preventing refunds during Season 2+ pre-season would punish accidental mis-spends with no escape before Lock In. Mid-season remains add-only (no refunds between tournaments).

**[v0.3 | 2026-05-05] Refund cascade uses `id.startsWith(nodeId + '.')` to cover all descendants, not just L2 children of L1.**
Old code only cascaded when `level === 1`, which left L3 nodes orphaned if the player refunded their L2 parent during pre-season. New code cascades L1→L2→L3→L4 depth regardless of the refunded node's level.

**[v0.3 | 2026-05-05] `needsSecondaryPick` changed from a `const` to a `function` in `skillTree.js`.**
Bug: the const was evaluated once at mount when `secondaryTree` was still null. After the player committed a second tree root (which updates the `let secondaryTree` variable), the Lock In gate remained permanently disabled. Fix: `function needsSecondaryPick() { return !isSeason1 && !midSeason && secondaryTree === null; }` — evaluated fresh on every `render()` call.

**[v0.3 | 2026-05-05] `handleBuy()` initialises missing tree entries in treeState before writing.**
Bug: Season 2 players choosing a second tree would crash with "Cannot set properties of undefined" because only the primary tree's entry existed in treeState. Fix: `if (!progress.treeState[tree]) progress.treeState[tree] = getInitialTreeState(tree);` guards the write. Tree entry is created on first buy; the third (never-chosen) tree remains absent from treeState per architecture rules.

---

## L2 Skill Tree Nodes (v0.3-pre)

**[v0.3 | 2026-05-03] All 6 L2 nodes implemented across MIND / MYSTIC / FORTUNE.**
MIND.1.1 (NPR): passive accumulation of 10%/round, fires at 90% accuracy with 10% false-read chance, resets on fire/match start, sets `hasNPRFiredThisMatch` for future Mental Mysticism (v1.0). MIND.1.2 (Blank Slate): passes `maskedThrows: 2` to `getNpcThrow`, hiding the player's last 2 throws from history-reading strategies. MYSTIC.1.1 (Tweak Reality): natural ties get a 30% conversion roll to player win in `handleReady`. MYSTIC.1.2 (Reverse Card): catalogued and stored in `treeState` but no observable effect — depends on NPC active-skill activation, which doesn't exist yet. FORTUNE.1.1 (TML): active skill, 75% auto-win / 25% auto-loss with a 5-round cooldown, takes the round's single active-skill slot. FORTUNE.1.2 (Consolation Prize): 30% chance Basic drop awarded on a player loss.

**[v0.3 | 2026-05-03] `SKILL_TREE_L2` and `SKILL_NODE_INFO` exported from `constants.js`.**
`SKILL_TREE_L2` is the per-tree array of L2 node metadata (id, name, branch, kind, effect, optional cooldownRounds). `SKILL_NODE_INFO` is the unified L1+L2 lookup keyed by node id. Constants `TWEAK_REALITY_CHANCE` (0.30), `CONSOLATION_PRIZE_CHANCE` (0.30), `REVERSE_CARD_CHANCE` (0.25), `TML_SUCCESS_CHANCE` (0.75), `TML_COOLDOWN_ROUNDS` (5), `NPR_FIRE_BASE_ACCURACY` (0.90) capture the design doc tunables.

**[v0.3 | 2026-05-03] Skill tree screen now shows L1 root + 2 L2 children per tree column.**
L2 nodes are gated on the L1 root being purchased ("REQUIRES ROOT" label otherwise). Cost 10 pts each. Refund button only renders during Season 1 pre-Lock-In (Season 2+ purchases stick). Refunding an L1 root cascades a refund of all purchased L2 children of that tree.

**[v0.3 | 2026-05-03] Off-season now routes to `pre_season` for all subsequent seasons (was `active_season`).**
This lets players spend accumulated skill points on L2 nodes between seasons. Inventory is cleared in `offSeason.js` and the deterministic starting loadout is regenerated in `skillTree.js` Lock In handler — that way any tree-state changes made during pre-season actually affect what gets seeded.

**[v0.3 | 2026-05-03] Identity tracks `secondaryTree` for Season 2+ tree picks.**
Season 1 enforces "single tree only" (other roots locked once primary is purchased). Season 2+ allows the player to pick a second tree by purchasing its L1 root — that tree is then committed as `identity.secondaryTree`. Once both are picked, the third remains permanently locked.

**[v0.3 | 2026-05-05] Season 2+ pre-season Lock In is blocked until secondary tree is chosen.**
`needsSecondaryPick = !isSeason1 && !midSeason && secondaryTree === null`. When true: Lock In button disabled, header reads "SEASON N — CHOOSE YOUR SECOND TREE", footer reads "BUY A ROOT NODE IN A SECOND TREE TO UNLOCK LOCK IN." Buying any L1 root in a non-primary tree commits it as `identity.secondaryTree` (existing mechanism in `handleBuy`) and clears the gate.

**[v0.3 | 2026-05-03] One active skill per round enforced via `roundActiveSkillUsed` flag.**
Set on TML use; reset in `resetRoundScopeState`. Future L3+ active skills will share this flag.

**[v0.3 | 2026-05-03] TML cooldown decrements only on `advanceRound` (round transitions).**
Mystic Pizza replays do not decrement cooldown (the round didn't truly end). Cosmic Insurance Policy resets the entire match including TML cooldown — handled implicitly because `tmlCooldownRemaining` is in-memory and `resetRoundScopeState` is called from `resetMatch`.

**[v0.3 | 2026-05-03] NPR is a separate read channel from throw-reveals.**
Throw reveals (Focus Group, Dead Giveaway, etc.) populate `roundRead`. NPR populates `roundStrategyRead`. Both render side-by-side in the gut_check body when active.

---

## MIND & MYSTIC Powerup Effects + Activation Phase (v0.3-pre)

**[v0.3 | 2026-05-03] `activationPhase: 'either' | 'gut_check'` field added per powerup in `POWERUP_CATALOG`.**
Default is `'either'` — most powerups can be USEd during Throw Selection or Gut Check. Only `Changed My Mind` is `'gut_check'`-only because it changes a throw the player has already made. The match screen renders the powerup tray + popup in both phases and `isUsableNow` enforces the per-powerup phase rule.

**[v0.3 | 2026-05-03] Lock-throw powerups auto-advance from picking to gut_check.**
When Fortune Cookie / Pandora's Box / Project Hail Mary are activated during Throw Selection, the powerup sets the player's throw (and NPC's where applicable) and the screen automatically transitions to Gut Check. Player has nothing left to choose.

**[v0.3 | 2026-05-03] MIND effects implemented (6 of 12).**
- The Jessie Special: forced player win this round (mirror of Wish Upon a Star).
- Dead Giveaway: 100% accurate one-shot reveal of NPC throw + grants throw change.
- Focus Group / Focused Focus Group: match-scope per-round read at 65% / 80% accuracy + grants throw change. Highest-confidence active read wins.
- Jessie Did Her Homework: shows NPC's primary strategy (99% accurate) as a one-time activated indicator.
- Research Notes: catalog stub — full season throw-distribution display deferred (NPC throw history isn't tracked across matches yet).

**[v0.3 | 2026-05-03] MIND deferred (6 of 12): Espresso Shot, A Word From Your Coach, Reading Glasses, Courtside with Jessie, Smart Glasses, and full Research Notes display.**
The four passive % reveals (Reading Glasses 15% per round, Courtside 40%, Smart Glasses 20%) need a per-round-roll system that piggybacks on the same read mechanism — straightforward follow-up. A Word From Your Coach uses a Monty Hall variant (eliminate one wrong throw) — distinct UI affordance. Espresso Shot needs a "two-throws-best-outcome" subsystem.

**[v0.3 | 2026-05-03] MYSTIC effects implemented (10 of 12) — 6 functional + 4 no-op-marked.**
Functional: Fait Accompli (forced win), Dizzy Spell (NPC random this round), Hiccup Potion (NPC random every 3rd round), Tabula Rasa (NPC random all match), Mystic Pizza (replay round on loss — streak preserved), Cosmic Insurance Policy (full match reset including NPC strategy state).
No-op marked-implemented (consume on USE, no observable effect until later systems land): Clockwork Orange and Molasses (need v0.3 active skills), Padlock (needs NPC powerup activation), Cuckoo Clock (auto-fires Clockwork Orange).
`POWERUP_NO_OP` set distinguishes these from genuinely-effective implementations.

**[v0.3 | 2026-05-07] Clockwork Orange implemented: resets `tmlCooldownRemaining`, `forceYourHandCooldown`, `changeMyLuckCooldown` to 0 via `resetActiveCooldowns()`. Removed from `POWERUP_NO_OP`.**
**[v0.3 | 2026-05-07] Cuckoo Clock implemented: activates as tournament-scope effect. `advanceRound()` auto-calls `resetActiveCooldowns()` when `roundNumber === 3` and Cuckoo Clock is tournament-active. Fires once per match (only round 3). Removed from `POWERUP_NO_OP`.**
**[v0.3 | 2026-05-07] Molasses and Padlock remain in `POWERUP_NO_OP` — NPCs still have no active skills or powerup activation.**
**[v0.3 | 2026-05-07] Cooldown pip display added to skills panel. Round-based CDs show `Xr ■■■□□` format (cdPips helper). Neural Scan shows match-count pips. Memory Wipe shows USED/READY.**

**[v0.3 | 2026-05-03] MYSTIC deferred (2 of 12): Schrödinger's Amulet (complex throw-change interaction) and Jonesing to Help (requires cross-match start-of-match drop hook).**
**[v0.3 | 2026-05-07] Schrödinger's Amulet implemented. `activationPhase` changed to `'gut_check'` (requires throw to already be selected). On activation, captures `roundSchrodingerOriginalThrow = currentThrow` and enables throw-change. At resolution (after Espresso Shot, before force-win/loss): if player changed throw AND original would have beaten the NPC, result = player win and `currentThrow` updates to original so reveal shows the winning throw. If player never changes throw, amulet has no effect.**

**[v0.3 | 2026-05-03] NPC throw computed via `computeNpcThrow()` to honour Tabula Rasa / Hiccup Potion / Dizzy Spell.**
The function checks effects in priority order (round-scope first, then match-scope) and falls back to the standard strategy engine. Activation mid-round (after the throw was already chosen) overrides `pendingOpponentThrow` and re-runs the read generator if applicable.

**[v0.3 | 2026-05-03] `npcMatchState` is `let`-bound to allow Cosmic Insurance Policy reset.**
The "Opponent remembers nothing" semantic requires re-initialising NPC strategy state mid-match.

---

## FORTUNE Powerup Effects (v0.3-pre)

**[v0.3 | 2026-05-03] All 12 FORTUNE powerups have working gameplay effects, added to `POWERUP_IMPLEMENTED`.**
Round-scope: Fortune Cookie / Giant FC / Comically Large FC (random throw + 2 tier-matched bonus drops on win), Pandora's Box (random both, cooldown reset on win — no-op until v0.3 active skills), Project Hail Mary (random both, instant match win on round win, disables other USEs this round), Wish Upon a Star (forced player win). Match-scope: Hot Sauce (every 2-streak → +1 Basic), Three's Company (3-streak → +3 Advanced, once per match), Lucky Penny (per-round H/T call, correct → +1 Basic). Tournament-scope: Ghost Pepper (2-streak → +1 Basic, 3-streak → +1 Advanced, once per streak run), Carolina Reaper (2-streak → +1 Advanced, 3-streak → +1 Legendary). Season-scope: The Ballad of Jessie Jones (same as Carolina Reaper, season-long).

**[v0.3 | 2026-05-03] `_progress.activePowerupEffects = { tournament: [], season: [] }` field added.**
Stores names of currently-active tournament-scope and season-scope powerup effects. Tournament list cleared on tier advance and season end. Season list cleared at off-season Begin Season. Match-scope effects are kept in-memory in `match.js` (not persisted — known limitation: mid-match crash loses match-scope effect activation).

**[v0.3 | 2026-05-03] `generateBonusDrops(specs, treeState)` in `powerupEngine.js` produces fixed-tier drops without upgrade rolls.**
Used by Fortune Cookies and streak spawners. Falls back to lower tiers (Legendary → Advanced → Basic) when the requested tier has no candidates in the player's pool — protects against scenarios like a MIND-only player triggering Carolina Reaper without any FORTUNE Legendaries available. Each bonus draws from the player's standard tree-affinity pool.

**[v0.3 | 2026-05-03] `randomThrow()` and `randomCoinFlip()` exported from `powerupEngine.js`.**
Used by Fortune Cookie family, Pandora's Box, Project Hail Mary (random throws), and Lucky Penny (coin flip resolution). Both go through the central `roll()` RNG abstraction so they remain mockable in tests.

**[v0.3 | 2026-05-03] Match streak counter rebuilt on match start from `roundHistory`.**
`computeStreak()` walks the persisted history backwards. Per-effect "already-awarded-at-2 / awarded-at-3" flags reset on streak break (any non-win round). Hot Sauce uses `streak % 2 === 0` for recurring 2-streak awards; Three's Company uses one-time `streak === 3`.

---

## Powerup Catalog & Skill Trees (v0.3-pre)

**[v0.3 | 2026-05-03] All 37 powerups defined in `POWERUP_CATALOG` (1 universal + 12 MIND + 12 MYSTIC + 12 FORTUNE).**
Each entry has `{name, tier, scope, tree, jessieOnly, effect}`. Locked-name list — do not rename without designer approval. Source: design doc Section 8.9–8.12. The `POWERUP_BY_NAME` and `POWERUP_DESCRIPTIONS` lookup maps are derived from the catalog at module load.

**[v0.3 | 2026-05-03] `POWERUP_IMPLEMENTED` Set lists powerups with actual gameplay effects wired up. v0.3-pre: just `'Changed My Mind'`.**
Other powerups drop into inventory and show full descriptions in the popup, but the USE button is disabled with "Effect coming in a future update". Effects will be added incrementally as v0.3 progresses.

**[v0.3 | 2026-05-03] L1 root nodes for all 3 skill trees implemented end-to-end.**
- MIND.1 (Mind Power): 5 powerup slots, starting loadout 4 Basic + 1 Advanced
- MYSTIC.1 (Mystical Power): +15% one-tier-higher / +5% Legendary on round-win drops
- FORTUNE.1 (Fortunate Power): 2× drop rate per round
Constants `MYSTIC_UPGRADE_BONUS_TO_ADVANCED` (0.15), `MYSTIC_UPGRADE_BONUS_TO_LEGENDARY` (0.05), `FORTUNE_DROP_MULTIPLIER` (2). L2+ nodes deferred to follow-up v0.3 work.

**[v0.3 | 2026-05-03] Drop pool is tree-affinity-restricted.**
`getDropPool(treeState)` returns universal powerups + the catalog of any tree the player has at least one node in. Cross-tree players draw from the union. `getDropMultiplier(treeState)` and `getUpgradeBonus(treeState)` are derived from the same tree state and applied per drop.

**[v0.3 | 2026-05-03] Starting loadout is fully deterministic via curated `STARTER_PICKS` per tree.**
`generateStartingLoadout(treeState)` uses the tree's L1 effect (e.g. MIND_only → 4 Basic + 1 Advanced from the curated MIND starter list) with no RNG-driven content selection. Higher-tier preferences are picked first. Loadout regenerates each season at off-season Lock In (or pre-season Lock In for Season 1).

**[v0.3 | 2026-05-03] `phase = pre_season` after character creation; routes to `skillTree.js` for Season 1 tree selection.**
Player picks one tree, buys its L1 root (5 pts) — Season 1 rule enforces single tree. Refund button available before Lock In. Lock In gate disabled until ≥1 node purchased. On Lock In, deterministic starting loadout is generated and phase advances to `active_season`. Off-season for Season 2+ skips the skill tree screen and routes directly to `active_season` — Season 2 second-tree selection deferred.

---

## Trophy Case Display

**[v0.2 | 2026-05-02] Trophy case displays earned trophies grouped by season — no unearned/shadow entries.**
Each season that produced a trophy shows a row of full-color trophy images with labels. The same trophy can appear in multiple seasons (e.g., Local Champion in Season 1 and Season 2 are two separate entries). Replaces the old 2-column all-trophies-with-silhouettes layout.

**[v0.2 | 2026-05-02] `_trophies.trophies` changed from `string[]` to `{id: string, season: number}[]`.**
Legacy string entries (from before this change) are read as `{ id: entry, season: 1 }` for backwards compatibility. Deduplication guard removed — same trophy ID can appear multiple times across different seasons. `newTrophy` banner (Season Complete panel) still fires only on the first earn of each trophy type.

---

## Testing

**[v0.2 | 2026-04-30] Every game system addition or change must be accompanied by added or updated tests in `js/tests/`.**
Rationale: NPC strategy bugs caught in testing (momentum off-by-one, maskedThrows order) confirmed the value of the test harness. Test coverage is not optional for game systems — it is part of the definition of done. Test files follow the `<system>.test.js` naming convention and are run via `tests.html`.

---

## Architecture

**[v0.95 | 2026-04-26] Tech stack: Vanilla HTML5 + Canvas + JavaScript, no framework, no build step.**
Rationale: zero dependencies, runs in any browser, simplest possible Claude Code support.

**[v0.95 | 2026-04-26] All localStorage access goes through `storage.js` only. No other file calls localStorage directly.**
Rationale: single point of control for migration, debugging, and future backend swap.

**[v0.95 | 2026-04-26] All randomness goes through `rng.js`. No file calls Math.random() directly.**
Rationale: makes RNG mockable for testing.

**[v0.95 | 2026-04-26] All named constants live in `constants.js`. Magic numbers are never inlined.**
Rationale: playtesting tweaks must be single-line changes in one file.

**[v0.95 | 2026-04-26] localStorage schema uses 9 namespaced key buckets, not one blob per character.**
Rationale: targeted writes — a round-end stat update must not rewrite NPC world state (39 KB).

**[v0.95 | 2026-04-26] `phase` field in `_progress` is the single source of truth for game state on reload. Never infer state from other fields.**
Rationale: clean resume after page close/crash; unambiguous screen routing.

**[v0.95 | 2026-04-26] Third tree is absent from treeState entirely (not false, not null).**
Rationale: absence is the authoritative signal to hide it from UI — avoids conditional UI logic on a value that should never be checked.

**[v0.1 | 2026-04-22] Static file hosting (GitHub Pages / Netlify). No server required through v0.3.**

**[v1.0 stretch] Backend migration: Node.js + database for cross-device persistence. localStorage schema designed from day one to make this migration clean.**

---

## NPC System

**[v0.95 | 2026-04-26] NPC vs NPC match outcomes: ELO-probability only. No round simulation, no skill resolution, no powerup resolution.**
Rationale: season simulation must be fast and synchronous; outcome difference vs full simulation is marginal since player never sees those matches.

**[v0.95 | 2026-04-26] NPC skill point spending algorithm: random selection from all legal affordable nodes.**
Rationale: produces maximum build variety across seasons without authoring burden; occasional odd builds are interesting flavor.

**[v0.95 | 2026-04-26] NPC skill points are spent once at season end only, not mid-season.**
Rationale: keeps simulation clean — no need to track NPC point balances mid-simulation.

**[v0.95 | 2026-04-26] NPC starting skill budgets by tier: T1=5, T2=15, T3=35, T4=55, T5=75 pts.**
These are the constant `NPC_STARTING_BUDGET_BY_TIER`. Never inline. Tunable during playtesting (affects new playthroughs only).

**[v0.95 | 2026-04-26] NPC starting budgets are spent at playthrough initialisation using the same random-from-legal-nodes algorithm.**

**[v0.95 | 2026-04-26] NPCs with secondaryTree: null spend entirely in their primary tree. NPCs with both trees draw from the union of both trees' legal nodes.**

**[v0.95 | 2026-04-26] NPC treeState is append-only. NPCs never respec.**
Rationale: no off-season mechanic for NPCs; append-only keeps simulation state simple.

**[v0.95 | 2026-04-26] Remaining NPC skill points carry over to next season (not discarded).**

**[v0.9 | 2026-04-26] All 99 NPC portraitIds assigned in npc_roster_v0_9.json. No same-portrait conflicts within any tournament tier. 48 of 50 portraits used. Format: male_N / female_N.**

**[v0.7 | 2026-04-26] NPC behavioral equivalents for all MIND player-only skills: passive accuracy model (Option A). Section 10.7 of design doc is fully complete.**

---

## Powerup System

**[v0.95 | 2026-04-26] Powerup inventory is a FIFO array. Activation priority is array position. Never sort. Never deduplicate. Multiple identical powerups are allowed.**

**[v0.95 | 2026-04-26] Starting powerup loadout is fully deterministic — no RNG at season start.**
See docs/SRPS_section_8_3_1_starting_loadout_v0_95.md for the full table.

**[v0.95 | 2026-04-26] MYSTIC.1's upgrade chance bonus applies to in-season round-win drops only — never to starting loadout.**
Rationale: resolves conflict between MIND.1 and MYSTIC.1 at season start; starting loadout is deterministic, drop modifiers are runtime-only.

**[v0.95 | 2026-04-26] Synergy nodes (X.1.1.2) are the sole mechanism for modifying starting loadout beyond root node baseline.**

**[v0.95 | 2026-04-26] All starting powerups drawn from the combined pool of all trees with any root node purchased.**

**[v0.95 | 2026-04-26] Powerup instanceId is generated at drop time (pu_ + 8 random hex chars). Used to identify specific inventory entries.**

**[v0.95 | 2026-04-26] `scope` field stored on each powerup inventory entry at drop time (not derived from name at runtime).**
Rationale: UI needs to display duration without re-deriving from name.

---

## Skill System

**[v0.95 | 2026-04-26] Lock In button is disabled until at least one node is purchased. Applies to pre-season allocation and off-season respec.**
Gate: `Object.values(treeState).some(tree => Object.values(tree).some(v => v === true))`

**[v0.95 | 2026-04-26] Player must purchase at least one node before any season begins or off-season respec is locked in.**
Rationale: ensures starting powerup loadout is never undefined; root node (L1, 5 pts) is always affordable.

**[v0.9 | 2026-04-26] Season 1 starting points: 15 pts, one-time only. Not awarded again in subsequent seasons.**

**[v0.8 | 2026-04-26] Consolation bonus by tournament level: T1=25, T2=20, T3=15, T4=10, T5=5 pts.**

**[v0.7 | 2026-04-26] MIND.1.1.1.1 renamed to Neural Scan 2.0. Effect: replaces Neural Scan, 90% accuracy on-demand read, cooldown reduced from 5 to 3 matches.**
One shared cooldown tracker for both. Active cooldown value determined by treeState check.

**[v0.5 | 2026-04-25] puristRandom NPC re-rolls at match start, not season start.**

**[v0.4 | 2026-04-24] NPR false result chance is always flat 10% — never scales, never reaches 0%.**

**[v0.4 | 2026-04-24] Alter Reality (60%) replaces Tweak Reality (30%) — not additive.**
Full replacement pairs listed in design doc Section 16.9.

---

## Ranking & Milestones

**[v0.2 | 2026-05-02] Ranking milestone messages (Section 11.3) are detected in summary.js after season simulation and displayed on a "Season Complete" results panel before navigating away.**
One-shot threshold milestones (ranked, top50, top20, top10, top3, rank1) are stored in `_trophies.achievedMilestones` (array of IDs). Personal best fires any season the player improves their peak rank (repeatable, not stored). Championship milestones (first T5 win, third T5 win) are detected from `stats.career.t5Wins` before incrementing.

**[v0.2 | 2026-05-02] `peakWorldRank` stored in `_progress` (lowest rank number ever achieved). Updated by `runSeasonSimulation` via `Math.min`.**
Required for personal best detection: summary.js captures it before calling the simulation, then compares against the new rank.

**[v0.2 | 2026-05-02] `stats.career.t5Wins` tracks World Championship wins separately from `tournamentsWon`.**
Needed to detect "First Championship" (t5Wins === 0 before win) and "Three-Time World Champion" (t5Wins + 1 === 3).

**[v0.2 | 2026-05-02] Season-end summary uses a two-phase UI: initial results view → "END OF SEASON" triggers simulation → "Season Complete" panel with rank + milestones → "CONTINUE" navigates.**
The initial view shows last season's rank (from `progress.worldRank`). The season complete panel shows the newly computed rank and any triggered milestones.

---

## Career Summary

**[v0.2 | 2026-05-02] Career summary screen (`js/screens/careerSummary.js`) is accessible via a STATS button on each filled character slot in the character select screen.**
Shows: portrait, current ELO + world rank, career record (seasons, tournaments, wins, runner-up, best finish, best rank, peak ELO), and throw distribution table (R/P/S play% and win% from career stats). Trophy case and HOF plaque are deferred to the trophy system task. No game logic — pure presentation, no tests required.

---

## Season Simulation

**[v0.2 | 2026-05-02] NPC season simulation runs 5 separate brackets (one per tier), NPC-only, each using the standard TOURNAMENT_CONFIG bracket size.**
Eligible pool for tier N = all NPCs with tournamentLevel ≤ N. Random selection fills each bracket; selected NPCs are seeded by ELO descending. All bracket sizes are powers of 2 (4, 8, 16, 32, 64) and eligible pool is always ≥ bracket size, so no bye handling needed.

**[v0.2 | 2026-05-02] NPC unspentSkillPoints stored in _world bucket on each NPC entry.**
Carry-over from seasons where the budget cannot be fully spent (no legal affordable nodes remain). Field initialised to remaining pts after starting budget spend; added to each season's earnings before spending.

**[v0.2 | 2026-05-02] worldRank computed as: count of NPC ELOs strictly greater than player ELO, plus 1.**
Ties resolve in the player's favour (player gets the higher rank). Computed from the post-simulation eloMap, not from stale world bucket values.

---

## Season & Tournament Structure

**[v0.2 | 2026-04-30] Bracket display redesigned as a player-path layout (one column per round, linear sequence with ▶ arrows).**
Replaces the T1 fork-connector layout. Scales cleanly to T5 (6 rounds) with horizontal scroll. NPC vs NPC results appear in a "Meanwhile…" panel after each player match, before bracket advances.

**[v0.2 | 2026-04-30] NPC bracket composition rules for T2–T5: previous finalist NPC (guaranteed) + top 5 ELO from eligible pool (guaranteed) + random fill. All seeded by ELO descending.**
T1 remains 3 random T1 NPCs + player. Eligible pool for tier N = all NPCs with tournamentLevel ≤ N.

**[v0.2 | 2026-04-30] NPC concurrent matches are simulated (ELO-probability) after the player's match completes, then revealed before the bracket advances.**
Results simulate that all matches happen simultaneously. Player clicks "Continue to [Next Round]" to advance.

**[v0.2 | 2026-04-30] Finals match is Best of 7 (first to 4 rounds). All non-final matches remain Best of 5 (first to 3).**
`matchType: 'finals'` triggers `ROUNDS_TO_WIN_MATCH_FINALS = 4` in match.js. Score bar scales to match.

**[v0.2 | 2026-04-30] Round name badges display in the match screen header (`cm.roundName`) and bracket column headers.**
Values from `TOURNAMENT_CONFIG[tier].roundNames` array, stored on `currentMatch.roundName` at match start.

**[v0.2 | 2026-04-30] `currentTournamentTier` and `previousFinalists` stored in `_progress`.**
`currentTournamentTier` (1–5) drives which bracket is generated. `previousFinalists` is set after any tournament where the player reaches the final; reset to null on season end or early elimination.

**[v0.95 | 2026-04-26] Season-end write order is mandatory: NPC simulation → NPC ELO update → player worldRank recompute → write _world → write _progress → write _trophies → write _stats (zero season after career update).**

**[v0.95 | 2026-04-26] `seasonEloHistory` stored in `_trophies` (not recomputed from world state) because NPC ELOs drift and past world ranks cannot be reconstructed retroactively.**

**[v0.6 | 2026-04-25] Total players: 99 NPCs + 1 player = 100. Tournament distribution: T1=10, T2=15, T3=20, T4=25, T5=29.**

**[v0.5 | 2026-04-25] Mid-season respec: add-only during active season. Full respec during off-season only.**

---

## ELO System

**[v0.95 | 2026-04-26] ELO K-factor: TBD — defined as constant `ELO_K_FACTOR`, tuned during playtesting.**

**[v0.2 | 2026-04-23] Standard ELO formula: `P(A beats B) = 1 / (1 + 10^((EloB - EloA) / 400))`**

**[v0.12 | 2026-04-22] HOF eligibility: evaluated after Season 10 regardless of result. Inducted if player finished in top 3 cumulative ELO rankings across all 10 seasons.**

---

## Visual Style

**[v0.2 | 2026-04-23] Game is SNES/16-bit retro aesthetic throughout. Not a filter — defines every visual element.**

**[v0.2 | 2026-04-23] Portrait size: 48×48 or 64×64 base, scaled up 2–3x. SVG/Canvas for v0.1, final pixel art for v1.0.**

**[v0.1 | 2026-04-27] Real PNG portrait assets used from v0.1. No SVG placeholders needed.**
All 50 portraits (male_1–25, female_1–25) are in `assets/portraits/`. Filename matches `portraitId` field in npc_roster exactly (e.g. `male_3.png` for `portraitId: "male_3"`). 8 Jessie expression PNGs are in `assets/portraits/jessie/` — not used until v1.0.

**[v0.9 | 2026-04-26] Player can choose any of all 50 portraits at character creation regardless of gender. Scrollable gallery.**

**[v0.1.1 | 2026-04-29] Responsive layout: game uses full viewport width on all screen sizes — no fixed 480px cap.**
`.screen` has no max-width; horizontal padding is `clamp(16px, 4vw, 64px)`. Narrow-content screens (login, summary, intro) center content in `.content-card` (max-width 560px). Character select uses `.content-card--lg` (800px) with a 2-column slot grid at ≥640px. Match screen uses a 2-column CSS grid at ≥768px (scoreboard left, action right). Tournament bracket scales up at ≥768px (larger slots, bigger portraits, wider connector). Portrait gallery in character create uses `repeat(5→8→10, 1fr)` auto-fill at breakpoints.

**[v0.1.1 | 2026-04-29] Bracket visualization redesigned as a horizontal bracket with fork connector lines.**
Replaces stacked match cards. Two columns (SEMIFINAL / FINAL) connected by a CSS fork (`.bracket-conn-top` / `.bracket-conn-bot` with interlocking border-right + border-bottom/top). Each match slot shows: portrait (28px→44px on desktop), name, score. Winner slot gets green highlight; loser fades. Active next-match gets yellow border glow.

---

## App Flow & Session

**[v0.1 | 2026-04-29] Intro plays on every page load — no session auto-resume.**
Every app load goes: intro → title → login → character select → game. The session is never used to skip the login screen. Session is written only when the player picks a character slot.

**[v0.1 | 2026-04-29] Title screen added as a dedicated screen between intro and login (`js/screens/title.js`).**
Displays `assets/SRPS Title screen.png` full-screen on a black background. Any click, tap, or keypress advances to login. Image is centered with `max-width: min(100%, 560px)`.

**[v0.1 | 2026-04-29] Pixel-art hand images used for throw selection and reveal in the match screen.**
Assets: `assets/hands/rock.png`, `assets/hands/paper.png`, `assets/hands/scissors.png`. Throw selection: 3-column button grid with hand image above label. Reveal: player hand on left (normal orientation), NPC hand on right (mirrored with `scaleX(-1)`) so both hands face each other.

**[v0.1 | 2026-04-27] Character select screen added between login and game (`js/screens/characterSelect.js`).**
Shows exactly 3 slots (MAX_CHARACTERS_PER_ACCOUNT). Filled slots show portrait, name, season, phase, ELO with a PLAY button. Empty slots show a NEW button. Log Out button returns to login and clears session.

**[v0.1 | 2026-04-27] NPC roster JSON is accessed as `.npcs` array (the JSON root has `meta` and `npcs` keys).**
`main.js` caches `roster.npcs`, not the full root object. All `getNpcById` / `getNpcsByTier` calls operate on this array.

**[v0.2 | 2026-05-02] Intro text crawl speed: 40ms per character (~300 WPM).**

**[v0.2 | 2026-05-02] Intro text updated by designer to reflect the three skill trees more explicitly.**
New lines: "BIOTECH IMPLANTS UTILIZING QUANTUM MECHANICS COULD UNLOCK SUPERHUMAN ABILITIES", "MICROSCOPIC PERCEPTION AND REACTION TIMES." (MIND), "THE ABILITY TO INFLUENCE THOUGHTS AND ACTIONS." (MYSTIC), "EVEN THE ABILITY TO CREATE ORDER FROM WHAT WAS SEEMINGLY RANDOM CHAOS." (FORTUNE). Source of truth is `js/screens/intro.js` — do not revert to older wording.

**[v0.2 | 2026-05-02] Trophy PNG assets added to `assets/trophies/` — one 1st-place and one 2nd-place image per tournament tier.**
Naming convention: `trophy_{tier}_1st_place.png` and `trophy_{tier}_2nd_place.png`, where `{tier}` is `local`, `regional`, `national`, `continental`, or `world`. Exception: the local runner-up is named `trophy_local_2nd_medal.png` (not `2nd_place`). Use these exact filenames when displaying trophies in the trophy system (v0.2).

**[v0.2 | 2026-05-02] Jessie consolation dialogue shown at season-end for eliminated players (not runner-up, not champion) as a tap-to-advance SNES dialog box stub.**
Locked dialogue text lives in `JESSIE_CONSOLATION_DIALOGUE` in `constants.js` — 5 tiers × 2 messages (pep talk + award sentence). Portrait area shows a placeholder; actual Jessie expression sprites (`assets/portraits/jessie/`) are deferred to v1.0. Dialogue fires in `summary.js` between "END OF SEASON" click and the season-results panel.

---

## Powerup Drop System

**[v0.2 | 2026-05-02] Drop pool for v0.2: "Changed My Mind" only (universal, Basic, round scope).**
All players are eligible regardless of tree. Tree-specific powerups activate in v0.3 alongside the skill tree system. "Changed My Mind" grants the ability to change your throw selection during the Gut Check phase.

**[v0.2 | 2026-05-02] Drop rates follow the escalating schedule from Section 8.4: 10% / 20% / 40% / 80% / 160% / 320% by player's Nth win in the match.**
Values >100% encode guaranteed drops + fractional chance for one more (e.g. 160% = 1 guaranteed + 60% chance of a second). Constants in `POWERUP_DROP_CHANCE_BY_ROUND_WON`.

**[v0.2 | 2026-05-02] Baseline powerup slots = 3 (Section 8.3). MIND.1 raises to 5; FORTUNE.1.1.2 synergy adds a 6th.**
Constant `POWERUP_MAX_SLOTS_BASELINE = 3`. `getMaxSlots(treeState)` in `powerupEngine.js` is the single source of truth.

**[v0.2 | 2026-05-02] Overflow prompt is mandatory and blocking (Section 6.8). Player must choose replace or discard before the round can advance.**
Each overflow drop is handled individually. On replace: chosen slot is spliced out, new drop pushed to end (FIFO preserved). On discard: drop is discarded silently.

**[v0.2 | 2026-05-02] Match screen flow restructured: picking → gut_check → revealing → (drop_result / overflow_prompt) → next round.**
Removed `powerup_stub` and `skill_stub` states. Phase 2 (Gut Check) is the combined powerup + skill info phase. "Changed My Mind" is activated in Gut Check; consuming it reveals throw-change buttons. Skill phase stub note remains visible in Gut Check (`[SKILL PHASE V0.3]`).

---

## Trophy System

**[v0.2 | 2026-05-02] Trophy case displayed in `careerSummary.js` using all 10 `TROPHY_CONFIG` entries in a 2-column grid (1st place / 2nd place per tier).**
Earned trophies show full-color PNG at 64×64 (`image-rendering: pixelated`). Unearned trophies show the same asset with `filter: grayscale(1) brightness(0.25)` — silhouette effect, no separate asset needed. The earned set is `_trophies.trophies` (array of ID strings like `t1_1st`). No tests required — pure presentation, no game logic.

**[v0.2 | 2026-05-02] Trophies awarded in two paths: advance path (T1–T4 champion, written immediately) and season-end path (any tier champion or runner-up, written as part of season-end simulation flow).**
Both paths guard against duplicates with `Array.includes` before pushing. `newTrophy` flag (set only on first earn) drives the "NEW TROPHY" display in the Season Complete panel so re-earning the same trophy does not re-trigger the callout.

---

## Off-Season Screen

**[v0.3 | 2026-05-05] Full off-season respec implemented in `offSeason.js`.**
On mount, all purchased nodes are refunded: `computeRefund` sums costs of every true node, `clearTreeState` zeros treeState, refund is added to `unspentSkillPoints`, and progress is saved. Idempotent — if treeState is already all-false, refund = 0. UI shows refund amount and total available points. "RESPEC SKILL TREE FOR SEASON N" increments `currentSeason`, clears inventory + carry-over effects, sets `phase = 'pre_season'`, navigates to skillTree. Tree identity (primaryTree / secondaryTree) is locked — only node purchases change.

**[v0.2 | 2026-05-02] `routeByPhase` updated: `off_season` now routes to `offSeason` screen (was incorrectly pointing to `skillTree`).**

---

## Character Management

**[v0.2 | 2026-05-02] Character deletion uses a two-stage confirmation before any data is removed.**
Stage 1: "DELETE CHARACTER?" with YES/CANCEL. Stage 2: "ARE YOU SURE? PERMANENT DELETION" with YES DELETE PERMANENTLY/CANCEL. No data is touched until both confirmations pass. Deletion removes all 6 character localStorage keys (`identity`, `progress`, `stats`, `trophies`, `tournament`, `world`) via `deleteCharacterData(charId)` in `storage.js`, then removes the charId from `account.characterIds` and saves the account.

**[v0.2 | 2026-05-02] Character select screen re-renders in place after each confirmation step and after deletion — no navigation required.**
`deleteConfirm = { charId, stage }` is module-scoped state inside the mount function; resetting it to null and calling `render()` restores the normal slot view.

---

## Hosting

**[v0.1 | 2026-04-27] Project hosted on GitHub Pages.**
Repo: `https://github.com/jsandlerct/SuperhumanRockPaperScissors`
Live URL: `https://jsandlerct.github.io/SuperhumanRockPaperScissors`
Deploy: push to `master` branch — Pages auto-deploys from root.

---

## Schema Version History

**[v1.0 | 2026-04-27] localStorage schema bumped to v1.0. Reference file: `docs/SRPS_localStorage_schema_v1_0.md`.**
Changes from v0.95: added `jessieOneShots` and `jessieSeasonCheckInHistory` arrays to `_trophies` bucket. Design doc bumped to v1.0 (`docs/SRPS_Design_Doc_v1_0.docx`). Starting loadout reference (`docs/SRPS_section_8_3_1_starting_loadout_v0_95.md`) removed — content folded into v1.0 design doc.

**[v1.0 | 2026-04-27] `_trophies` bucket has an additional write trigger: immediately after any one-shot Jessie beat fires.**
Push beat ID to `jessieOneShots` (or update `jessieSeasonCheckInHistory` for M-12) and call `saveTrophies()` immediately — do not wait for end of match or season.

**[v1.0 | 2026-04-27] M-04 and M-06 Jessie beats are repeatable — never added to `jessieOneShots`.**
All other Jessie one-shot beats: check `jessieOneShots.includes(beatId)` before firing; push after firing.

**[v1.0 | 2026-04-27] `jessieSeasonCheckInHistory` tracks used M-12 line indices (0–7). Reset to [] after all 8 used.**
