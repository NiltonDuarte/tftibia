# Gameplay Rules and Loop Review

Reviewed against the current reducer, combat simulator, YAML campaign and balance data, and the player-facing screens on 2026-10-24. This describes the implemented rules.

## Player loop

1. **Start a run.** A new run receives a deterministic seed and initializes at vocation selection. The player chooses Knight, Paladin, Sorcerer, or Druid. Vocation is fixed for the run and provides an automatic combat passive.
2. **Choose a route.** From the current map node, choose one of its three outgoing routes. Route cards disclose the region, encounter, enemy lineup, and route reward. Choosing the route generates a randomized shop. Hunt routes add two offers to the normal four. Route rewards are granted only after that encounter is won.
3. **Prepare.** Spend gold on creatures, reroll the shop for one gold, deploy and reposition units, bench units, and inspect synergies. A fight can start with at least one deployed unit. Preparation can be revisited after a loss while lives remain.
4. **Fight.** Combat is simulated immediately and displayed as an event playback. Units act automatically, move toward targets, attack when in range, and heal according to their role/effects. No player commands occur during combat.
5. **Resolve.** A loss removes one life and up to two gold. With lives left, return to preparation and retry the same encounter; at zero lives, the run ends. A victory can be claimed for three gold plus the node's gold reward, and 25 XP plus the node's XP reward.
6. **Choose victory rewards.** Choose one creature from the encounter's offer pool. Every 100 accumulated XP grants a level and one vocation-specific upgrade choice. When both the creature and all pending level-up choices are resolved, the run advances to the map. The last encounter leads to campaign completion.

The campaign has eight encounters along a three-way branching path. Its three recurring route reward types are gold, experience, and hunt/recruit (extra shop offers and a larger victory creature selection). On every victory, regardless of route type, the player also receives a victory reward creature selection.

## Run economy and roster

- The run begins with 5 gold and three starting creatures: Falcon Knight, Dawnfire Asura, and Druid's Apparition. Starting units are deployed in role-preferred slots.
- Shop stock is sampled from the full creature pool using the run's seeded random stream. Offers are not removed from the pool after purchase, so duplicates can appear. Buying costs the creature's listed cost. Rerolling costs one gold and draws the base shop size of four, including on a hunt route.
- Gold is not awarded for surviving or winning combat itself beyond the fixed 3-gold victory payout and the node's `rewardGold`. A loss subtracts two gold, floored at zero. Route rewards are paid only when claiming a victory.
- The formation has 21 spaces (three rows by seven columns). The deployment limit starts at five and can be increased by buying a Formation Permit for 5 gold during preparation, up to 21. The reserve has no explicit size cap. Only one copy of a creature identity can be deployed at once; other copies stay on the bench.
- Three copies of the same creature at the same star rank merge automatically into the next rank. Rank 1→2 and 2→3 use combat multipliers of 1.65× and 2.5× for health and attack. A merge preserves one occupied slot if any copy was deployed.
- Creature rewards are recruited for free. They deploy automatically if there is room and no copy of that identity is already deployed; otherwise they enter the bench.

## Formation and synergies

- The player formation is a three-row by seven-column board. Rows are labeled backline, midline, and frontline; tanks/fighters prefer the frontline, healers the middle, and ranged roles the backline. Placement changes combat coordinates and therefore proximity and target selection.
- The combat room is 7×7. Player units start in columns 0–6 and rows 4–6; enemies start in columns 1–5 and rows 0–2. Diagonal neighboring steps are allowed. A unit moves one tile and gives up that turn if its target is outside its range.
- The simulator computes synergies from deployed units only. A creature contributes to its role, family, and Bestiary class. Active breakpoints are cumulative: effects from every reached tier are applied. Family/role effects can be unit-specific, while effects named `team*` apply to every ally.
- Current role breakpoints: Tank 2/4; Shooter 2/4; Fighter 1/2; Mage 2/4; Healer 2/4. Family breakpoints: Asuri, Cobra, Falcon, and Apparition each 2/3. Bestiary class breakpoints: Demon, Human, and Undead each 3/5/7. Effects are defined in `src/data/synergies.yaml`.

## Combat rules

- Each encounter starts with all deployed units at full health; health does not persist between encounters. Enemy power is scaled by stage: `1 + max(0, stage - 1) × 0.12`; enemy tanks receive a further 1.08 multiplier.
- Player and enemy turns alternate by roster order within each side, player first. Living units are snapshotted at the start of the round for ordering; units defeated before their turn are skipped.
- Target selection chooses the nearest living opponent by Chebyshev distance, breaking ties by lower current health. If no target is within the attacker's range, the unit moves one unoccupied neighboring tile that most reduces distance, and does not attack that turn.
- Attacks deal at least 1 damage: rounded `(attack × bonuses − target armor) × (1 − damage reduction)`. Fighter adjacent attacks add a 35% bonus, plus any fighter synergy bonus. First-attack and role-specific attack modifiers are automatic.
- Player healers heal the living ally with the lowest health percentage instead of attacking whenever an ally is injured. Round-start healing applies before turns. Healing is capped at max health.
- Combat lasts at most 10 rounds. If one side is eliminated, the other wins. Otherwise, the player wins only if at least one ally remains and the sum of allied survivor health percentages exceeds the equivalent enemy sum; ties go to the enemy.
- A win rewards survivors for display only; the next encounter starts with a fresh battle simulation and full health.

## Progression and reward rules

- XP is awarded only after a victory is claimed: 25 base XP plus the chosen node's reward XP. XP rolls over modulo 100; each full 100 grants one level and one pending perk choice.
- At each level-up, three upgrades for the chosen vocation are drawn from the run's seeded stream. Each pending level-up gets a fresh set of three choices. Chosen upgrades stack, including duplicate choices, and apply automatically in future battles.
- The creature reward is offered separately from upgrade choices. Both are required to finish reward phase when a level-up is pending.
- Victory completes the current node and clears encounter-local shop/reward/battle state. Defeat does not complete the node. At zero lives the state changes to defeat and cannot be retried.

## Sources checked

- `GAME_DESIGN.md`, `README.md`, `ARCHITECTURE_DECISIONS.md`
- `src/game/engine.ts`, `src/game/combat.ts`, `src/game/board.ts`, `src/game/stateSchema.ts`, `src/game/balance.ts`
- `src/App.tsx`
- `src/data/campaign.yaml`, `src/data/creatures.yaml`, `src/data/vocations.yaml`, `src/data/upgrades.yaml`, `src/data/synergies.yaml`

This documents coded behavior, not a numerical balance simulation.
