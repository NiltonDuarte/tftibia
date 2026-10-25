import {
  bossById,
  creatureById,
  itemById,
  items,
  nodeById,
  synergies,
  upgradeById,
  vocationById,
} from "../content/content";
import type { Creature, GameItem, Upgrade } from "../content/schemas";
import { BOARD_CAPACITY, BOARD_SLOTS, DEPLOYMENT_LIMIT_ITEM_COST, preferredSlotsForRole } from "./board";
import {
  createGame,
  gameReducer,
  nextRandom,
  type CampaignOutcome,
  type GameAction,
  type SeedRunResult,
} from "./engine";
import { getActiveSynergies } from "./combat";
import type { GameState } from "./stateSchema";

type RandomSource = () => number;

export type BalanceStrategy = {
  id: string;
  name: string;
  description: string;
  chooseRoute: (
    nodeIds: string[],
    state: GameState,
    random: RandomSource,
  ) => string;
  creatureScore: (
    creature: Creature,
    state: GameState,
    random: RandomSource,
  ) => number;
  upgradeScore: (
    upgrade: Upgrade,
    state: GameState,
    random: RandomSource,
  ) => number;
  reroll: (state: GameState, random: RandomSource) => boolean;
  formation: (
    state: GameState,
    random: RandomSource,
    pinnedUnitIds: ReadonlySet<string>,
  ) => Array<{ instanceId: string; slot: number }>;
};

function createRandom(seed: number, strategyId: string): RandomSource {
  let hash = 2166136261;
  for (const character of strategyId)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  let state = (seed ^ hash) >>> 0;
  return () => {
    const next = nextRandom(state);
    state = next.state;
    return next.value;
  };
}

function chooseByScore<T>(
  items: T[],
  score: (item: T) => number,
  random: RandomSource,
): T | undefined {
  return items
    .map((item) => ({ item, score: score(item), tieBreak: random() }))
    .sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak)[0]?.item;
}

function deployedCreatures(state: GameState): Creature[] {
  return state.roster
    .filter((unit) => unit.slot !== null)
    .map((unit) => creatureById[unit.creatureId])
    .filter((creature): creature is Creature => Boolean(creature));
}

function synergyValue(creature: Creature, state: GameState): number {
  const board = deployedCreatures(state);
  const existing = getActiveSynergies(board, synergies);
  let value = 0;
  for (const definition of synergies) {
    const matches =
      definition.category === "role"
        ? creature.role === definition.tag
        : definition.category === "family"
          ? creature.family === definition.tag
          : creature.bestiaryClass === definition.tag;
    if (!matches) continue;
    const currentCount = board.filter((unit) =>
      definition.category === "role"
        ? unit.role === definition.tag
        : definition.category === "family"
          ? unit.family === definition.tag
          : unit.bestiaryClass === definition.tag,
    ).length;
    const nextBreakpoint = definition.breakpoints.find(
      (breakpoint) => breakpoint.count > currentCount,
    );
    if (nextBreakpoint) {
      const breakpointValue =
        1.5 +
        Object.values(nextBreakpoint.effects).reduce(
          (sum, amount) =>
            sum + (typeof amount === "number" ? Math.abs(amount) : 0),
          0,
        ) *
          4;
      value +=
        breakpointValue / Math.max(1, nextBreakpoint.count - currentCount);
    } else if (existing.some((item) => item.id === definition.id)) {
      value += 0.25;
    }
  }
  return value;
}

function baseCreatureValue(creature: Creature): number {
  return (
    (creature.attack * 1.5 +
      creature.health * 0.25 +
      creature.armor * 2 +
      creature.range * 0.8) /
    creature.cost
  );
}

function itemValue(item: GameItem, creature: Creature): number {
  const stats = item.tibiaStats;
  const attack = (stats.attack ?? 0) + (stats.elementalAttack ?? 0) + (stats.averageAttack ?? 0);
  const defense = (stats.armor ?? 0) + (stats.defense ?? 0) + (stats.defenseBonus ?? 0) + (stats.skillBonuses.shielding ?? 0);
  const skill = Object.values(stats.skillBonuses).reduce((sum, value) => sum + value, 0);
  const magic = (stats.magicLevel ?? 0) + Object.values(stats.elementMagicLevel).reduce((sum, value) => sum + value, 0);
  const offense = attack * (["fighter", "shooter", "mage"].includes(creature.role) ? 1.5 : 0.8) + skill * (creature.role === "fighter" || creature.role === "tank" ? 1.2 : 0.5) + magic * (creature.role === "mage" || creature.role === "healer" ? 1.5 : 0.5);
  const protection = Object.values(stats.protectionPercent).reduce((sum, value) => sum + value, 0) * 0.08;
  return offense + defense * (creature.role === "tank" || creature.role === "healer" ? 1.3 : 0.7) + protection + (stats.lifeLeechChancePercent ?? 0) * (stats.lifeLeechAmountPercent ?? 0) / 100 + (stats.criticalChancePercent ?? 0) * 0.15 + (stats.range ?? 0) * 0.5;
}

function equipBackpackItems(getState: () => GameState, apply: (action: GameAction) => void, trace?: string[]): void {
  for (const itemId of [...getState().backpackItemIds]) {
    const item = itemById[itemId];
    if (!item) continue;
    const candidate = getState().roster
      .map((unit) => ({ unit, creature: creatureById[unit.creatureId] }))
      .filter(({ creature }) => creature && (item.universal || item.allowedRoles.includes(creature.role)))
      .map(({ unit, creature }) => {
        if (!creature) return { unit, score: -Infinity };
        const oldId = unit.equippedItems[item.slot];
        const oldItem = oldId ? itemById[oldId] : undefined;
        return { unit, score: itemValue(item, creature) - (oldItem ? itemValue(oldItem, creature) : 0) };
      })
      .sort((a, b) => b.score - a.score)[0];
    if (!candidate || candidate.score <= 0) continue;
    apply({ type: "equip-item", unitId: candidate.unit.instanceId, itemId });
    trace?.push(`Equip: ${item.name} → ${creatureById[candidate.unit.creatureId]?.name ?? candidate.unit.creatureId}`);
  }
}

function routeValue(nodeId: string, state: GameState): number {
  const node = nodeById[nodeId];
  if (!node) return -Infinity;
  const vocation = state.commanderId
    ? vocationById[state.commanderId]
    : undefined;
  const goldNeed = Math.max(
    0,
    state.deploymentLimit - state.roster.filter((unit) => unit.slot !== null).length,
  );
  const rewardValue =
    node.routeReward === "gold"
      ? node.rewardGold * (state.gold < 6 ? 1.25 : 0.75)
      : node.routeReward === "experience"
        ? node.rewardExperience * (state.experience > 55 ? 0.04 : 0.025)
        : node.shopBonus * 1.4 + node.rewardGold;
  const enemyPressure = node.enemies.reduce((total, id) => {
    const enemy = creatureById[id];
    return (
      total + (enemy ? enemy.attack + enemy.health * 0.08 + enemy.armor : 0)
    );
  }, 0);
  const bossPressure = node.bossId
    ? (bossById[node.bossId]?.attack ?? 0) + (bossById[node.bossId]?.health ?? 0) * 0.08
    : 0;
  const currentPower = deployedCreatures(state).reduce(
    (total, creature) =>
      total + creature.attack + creature.health * 0.08 + creature.armor,
    0,
  );
  const routeRisk = (enemyPressure + bossPressure) / Math.max(1, currentPower);
  const bossLootPotential = node.bossId && node.bossId !== "ferumbras"
    ? Math.max(0, ...items.filter((item) => item.bossId === node.bossId).flatMap((item) =>
        state.roster.flatMap((unit) => {
          const creature = creatureById[unit.creatureId];
          return creature && (item.universal || item.allowedRoles.includes(creature.role))
            ? [itemValue(item, creature)]
            : [];
        }),
      ))
    : 0;
  const commanderAffinity =
    vocation?.id === "druid" && node.routeReward === "experience" ? 0.3 : 0;
  return (
    rewardValue +
    bossLootPotential * 0.2 +
    goldNeed * (node.routeReward === "gold" ? 0.4 : 0) -
    routeRisk +
    commanderAffinity
  );
}

function alignedRoleBonus(
  creature: Creature,
  vocationId: string | null,
): number {
  if (vocationId === "knight")
    return creature.role === "tank" || creature.role === "fighter" ? 1.5 : 0;
  if (vocationId === "paladin") return creature.role === "shooter" ? 1.7 : 0;
  if (vocationId === "sorcerer") return creature.role === "mage" ? 1.7 : 0;
  if (vocationId === "druid")
    return creature.role === "healer" || creature.role === "tank" ? 1.3 : 0;
  return 0;
}

function deployableUnits(
  state: GameState,
  pinnedUnitIds: ReadonlySet<string>,
): GameState["roster"] {
  const byCreature = new Map<string, GameState["roster"][number]>();
  for (const unit of state.roster) {
    const previous = byCreature.get(unit.creatureId);
    const unitPinned = pinnedUnitIds.has(unit.instanceId) && unit.slot !== null;
    const previousPinned = previous
      ? pinnedUnitIds.has(previous.instanceId) && previous.slot !== null
      : false;
    if (
      !previous ||
      (unitPinned && !previousPinned) ||
      (unitPinned === previousPinned && unit.star > previous.star)
    )
      byCreature.set(unit.creatureId, unit);
  }
  return [...byCreature.values()];
}

export const BALANCE_STRATEGIES: BalanceStrategy[] = [
  {
    id: "random-baseline",
    name: "Random baseline",
    description:
      "Makes seeded random choices while buying affordable offers and completing useful merges.",
    chooseRoute: (nodeIds, _state, random) =>
      nodeIds[Math.floor(random() * nodeIds.length)] ?? nodeIds[0] ?? "",
    creatureScore: (creature, state, random) =>
      baseCreatureValue(creature) +
      synergyValue(creature, state) * 0.6 +
      random(),
    upgradeScore: (_upgrade, _state, random) => random(),
    reroll: (state, random) => state.gold >= 4 && random() < 0.35,
    formation: (state, _random, pinnedUnitIds) =>
      roleFormation(
        state,
        ["tank", "fighter", "healer", "shooter", "mage"],
        pinnedUnitIds,
      ),
  },
  {
    id: "synergy-builder",
    name: "Synergy builder",
    description:
      "Drafts units that reach family, role, and Bestiary breakpoints, and favors recruiting routes.",
    chooseRoute: (nodeIds, state, random) =>
      chooseByScore(nodeIds, (id) => routeValue(id, state), random) ??
      nodeIds[0] ??
      "",
    creatureScore: (creature, state) =>
      baseCreatureValue(creature) + synergyValue(creature, state) * 1.7,
    upgradeScore: (upgrade, state) => upgradeValue(upgrade, state),
    reroll: (state) =>
      state.gold >= 4 &&
      state.shopCreatureIds.every((id) => {
        const creature = creatureById[id];
        return (
          !creature ||
          baseCreatureValue(creature) + synergyValue(creature, state) * 1.7 <
            2.3
        );
      }),
    formation: (state, _random, pinnedUnitIds) =>
      roleFormation(
        state,
        ["tank", "fighter", "healer", "shooter", "mage"],
        pinnedUnitIds,
      ),
  },
  {
    id: "family-stack",
    name: "Family stack",
    description:
      "Builds around the most represented creature family on the board and favors family breakpoints.",
    chooseRoute: (nodeIds, state, random) =>
      chooseByScore(nodeIds, (id) => routeValue(id, state), random) ??
      nodeIds[0] ??
      "",
    creatureScore: (creature, state) => {
      const counts = new Map<string, number>();
      for (const unit of deployedCreatures(state))
        counts.set(unit.family, (counts.get(unit.family) ?? 0) + 1);
      const highest = Math.max(0, ...counts.values());
      const familyFocus =
        (counts.get(creature.family) ?? 0) === highest && highest > 0 ? 2.5 : 0;
      return (
        baseCreatureValue(creature) +
        familyFocus +
        synergyValue(creature, state)
      );
    },
    upgradeScore: (_upgrade, state) => upgradeValue(_upgrade, state),
    reroll: (state) =>
      state.gold >= 4 &&
      state.shopCreatureIds.every((id) => {
        const creature = creatureById[id];
        return !creature || synergyValue(creature, state) < 1.2;
      }),
    formation: (state, _random, pinnedUnitIds) =>
      roleFormation(
        state,
        ["tank", "fighter", "healer", "shooter", "mage"],
        pinnedUnitIds,
      ),
  },
  {
    id: "frontline-wall",
    name: "Frontline wall",
    description:
      "Prioritizes tanks, fighters, and healers, then puts durable units in the front rows.",
    chooseRoute: (nodeIds, state, random) =>
      chooseByScore(nodeIds, (id) => routeValue(id, state), random) ??
      nodeIds[0] ??
      "",
    creatureScore: (creature, state) =>
      baseCreatureValue(creature) +
      (creature.role === "tank"
        ? 2.5
        : creature.role === "fighter"
          ? 1.6
          : creature.role === "healer"
            ? 1.3
            : 0) +
      synergyValue(creature, state),
    upgradeScore: (upgrade) =>
      (upgrade.effects.teamArmor ?? 0) +
      (upgrade.effects.teamDamageReductionPct ?? 0) * 10 +
      (upgrade.effects.teamRoundStartHeal ?? 0),
    reroll: (state) =>
      state.gold >= 4 &&
      state.shopCreatureIds.every((id) => {
        const creature = creatureById[id];
        return (
          !creature || !["tank", "fighter", "healer"].includes(creature.role)
        );
      }),
    formation: (state, _random, pinnedUnitIds) =>
      roleFormation(
        state,
        ["tank", "fighter", "healer", "shooter", "mage"],
        pinnedUnitIds,
      ),
  },
  {
    id: "ranged-burst",
    name: "Ranged burst",
    description:
      "Drafts shooters and mages for high-range damage and vocation-aligned attack bonuses.",
    chooseRoute: (nodeIds, state, random) =>
      chooseByScore(nodeIds, (id) => routeValue(id, state), random) ??
      nodeIds[0] ??
      "",
    creatureScore: (creature, state) =>
      baseCreatureValue(creature) +
      alignedRoleBonus(creature, state.commanderId) +
      (["shooter", "mage"].includes(creature.role) ? 1.5 : 0) +
      synergyValue(creature, state),
    upgradeScore: (upgrade, state) =>
      upgradeValue(upgrade, state) +
      (state.commanderId === "paladin" && upgrade.effects.shooterAttackPct
        ? 1.5
        : 0) +
      (state.commanderId === "sorcerer" && upgrade.effects.mageAttackPct
        ? 1.5
        : 0),
    reroll: (state) =>
      state.gold >= 4 &&
      state.shopCreatureIds.every((id) => {
        const creature = creatureById[id];
        return !creature || !["shooter", "mage"].includes(creature.role);
      }),
    formation: (state, _random, pinnedUnitIds) =>
      roleFormation(
        state,
        ["shooter", "mage", "healer", "fighter", "tank"],
        pinnedUnitIds,
      ),
  },
  {
    id: "vocation-specialist",
    name: "Vocation specialist",
    description:
      "Drafts around the selected vocation passive and favors matching vocation perks.",
    chooseRoute: (nodeIds, state, random) =>
      chooseByScore(nodeIds, (id) => routeValue(id, state), random) ??
      nodeIds[0] ??
      "",
    creatureScore: (creature, state) =>
      baseCreatureValue(creature) +
      alignedRoleBonus(creature, state.commanderId) * 1.8 +
      synergyValue(creature, state) * 0.75,
    upgradeScore: (upgrade, state) =>
      upgradeValue(upgrade, state) +
      (upgrade.vocation === state.commanderId ? 3 : 0),
    reroll: (state) =>
      state.gold >= 4 &&
      state.shopCreatureIds.every((id) => {
        const creature = creatureById[id];
        return !creature || alignedRoleBonus(creature, state.commanderId) === 0;
      }),
    formation: (state, _random, pinnedUnitIds) =>
      roleFormation(
        state,
        state.commanderId === "knight"
          ? ["tank", "fighter", "healer", "shooter", "mage"]
          : state.commanderId === "druid"
            ? ["healer", "tank", "fighter", "shooter", "mage"]
            : ["shooter", "mage", "fighter", "tank", "healer"],
        pinnedUnitIds,
      ),
  },
];

function upgradeValue(upgrade: Upgrade, state: GameState): number {
  const effects = upgrade.effects;
  const numeric = Object.values(effects).reduce(
    (total, value) => total + (typeof value === "number" ? Math.abs(value) : 0),
    0,
  );
  const commanderMatch = upgrade.vocation === state.commanderId ? 1 : 0;
  return numeric * 8 + commanderMatch;
}

function roleFormation(
  state: GameState,
  roleOrder: string[],
  pinnedUnitIds: ReadonlySet<string>,
): Array<{ instanceId: string; slot: number }> {
  const rolePosition = new Map(roleOrder.map((role, index) => [role, index]));
  const uniqueUnits = deployableUnits(state, pinnedUnitIds);
  const pinned = uniqueUnits.filter(
    (unit) => pinnedUnitIds.has(unit.instanceId) && unit.slot !== null,
  );
  const reservedSlots = new Set(
    pinned.flatMap((unit) => (unit.slot === null ? [] : [unit.slot])),
  );
  const availableSlots = BOARD_SLOTS.filter((slot) => !reservedSlots.has(slot));
  const byRole = uniqueUnits
    .filter((unit) => !pinned.includes(unit))
    .sort((a, b) => {
      const creatureA = creatureById[a.creatureId];
      const creatureB = creatureById[b.creatureId];
      const roleA = rolePosition.get(creatureA?.role ?? "") ?? roleOrder.length;
      const roleB = rolePosition.get(creatureB?.role ?? "") ?? roleOrder.length;
      return roleA - roleB || a.instanceId.localeCompare(b.instanceId);
    });
  const assignments = pinned.map((unit) => ({
    instanceId: unit.instanceId,
    slot: unit.slot!,
  }));
  for (const unit of byRole) {
    if (assignments.length >= state.deploymentLimit) break;
    const creature = creatureById[unit.creatureId];
    if (!creature) continue;
    const slot =
      preferredSlotsForRole(creature.role).find((candidate) =>
        availableSlots.includes(candidate),
      ) ?? availableSlots[0];
    if (slot === undefined) continue;
    assignments.push({ instanceId: unit.instanceId, slot });
    availableSlots.splice(availableSlots.indexOf(slot), 1);
  }
  return assignments;
}

function applyFormation(
  state: GameState,
  formation: Array<{ instanceId: string; slot: number }>,
  pinnedUnitIds: ReadonlySet<string>,
  recordAction?: (action: GameAction) => void,
): GameState {
  let next = state;
  const apply = (action: GameAction) => {
    recordAction?.(action);
    next = gameReducer(next, action);
  };
  const desiredSlots = new Map(
    formation.map((assignment) => [assignment.instanceId, assignment.slot]),
  );
  const deployed = next.roster.filter((unit) => {
    const desiredSlot = desiredSlots.get(unit.instanceId);
    return (
      unit.slot !== null &&
      !pinnedUnitIds.has(unit.instanceId) &&
      desiredSlot !== undefined &&
      unit.slot !== desiredSlot
    );
  });
  for (const unit of deployed) {
    apply({ type: "select-unit", unitId: unit.instanceId });
    apply({ type: "bench-unit" });
  }
  for (const assignment of formation) {
    const unit = next.roster.find(
      (item) => item.instanceId === assignment.instanceId,
    );
    if (
      !unit ||
      unit.slot === assignment.slot ||
      pinnedUnitIds.has(unit.instanceId)
    )
      continue;
    if (unit.slot !== null) continue;
    apply({ type: "select-unit", unitId: unit.instanceId });
    apply({ type: "place-unit", slot: assignment.slot });
  }
  return next;
}

function chooseShopPurchases(
  state: GameState,
  strategy: BalanceStrategy,
  random: RandomSource,
): string[] {
  const offers = state.shopCreatureIds
    .map((id) => creatureById[id])
    .filter(
      (creature): creature is Creature =>
        Boolean(creature) &&
        creature.cost <= state.gold &&
        !state.roster.some(
          (unit) => unit.creatureId === creature.id && unit.star >= 3,
        ),
    );
  const ranked = offers
    .map((creature) => ({
      creature,
      score:
        strategy.creatureScore(creature, state, random) +
        (state.roster.some((unit) => unit.creatureId === creature.id)
          ? 1.5
          : 0),
      tieBreak: random(),
    }))
    .filter((item) => item.score >= 2.1)
    .sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak);
  if (strategy.id === "random-baseline") {
    const pool = ranked.slice(0, Math.min(3, ranked.length));
    return pool.length
      ? [pool[Math.floor(random() * pool.length)]!.creature.id]
      : [];
  }
  return ranked[0] ? [ranked[0].creature.id] : [];
}

export type BalanceRunConfig = {
  firstSeed: number;
  seedCount: number;
  vocationIds?: string[];
  strategies?: BalanceStrategy[];
  strategyIds?: string[];
};

export type CampaignCapture = {
  trace?: string[];
  actions?: GameAction[];
  formations?: FormationDiagnostic[];
};

export type FormationDiagnostic = {
  deployedCount: number;
  eligibleUnitCount: number;
  boardCapacity: number;
  deploymentLimit: number;
  unassignedUnitIds: string[];
  assignments: Array<{
    instanceId: string;
    creatureId: string;
    role: Creature["role"];
    slot: number;
    decision: "kept" | "moved" | "deployed";
  }>;
};

function selectedStrategies(config: BalanceRunConfig): BalanceStrategy[] {
  if (config.strategies) return [...config.strategies];
  const strategyIds = config.strategyIds;
  const ids = strategyIds ? new Set(strategyIds) : null;
  return BALANCE_STRATEGIES.filter((strategy) => !ids || ids.has(strategy.id));
}

function selectedVocations(vocationIds?: string[]): string[] {
  return (vocationIds ?? ["knight", "paladin", "sorcerer", "druid"]).filter(
    (id) => Boolean(vocationById[id]),
  );
}

function normalizedSeedCount(seedCount: number): number {
  return Number.isFinite(seedCount)
    ? Math.max(1, Math.min(10000, Math.trunc(seedCount)))
    : 1;
}

function* balanceJobs(
  config: BalanceRunConfig,
): Generator<
  { seed: number; vocationId: string; strategy: BalanceStrategy },
  void,
  unknown
> {
  const firstSeed = Math.trunc(config.firstSeed) >>> 0;
  for (const vocationId of selectedVocations(config.vocationIds)) {
    for (const strategy of selectedStrategies(config)) {
      for (
        let index = 0;
        index < normalizedSeedCount(config.seedCount);
        index += 1
      ) {
        yield { seed: (firstSeed + index) >>> 0, vocationId, strategy };
      }
    }
  }
}

export function runCampaign(
  seed: number,
  vocationId: string,
  strategy: BalanceStrategy,
  capture?: CampaignCapture,
): SeedRunResult {
  const random = createRandom(seed, strategy.id);
  let state = createGame(seed);
  let encountersPlayed = 0;
  let purchasesMade = 0;
  let rerollsUsed = 0;
  let retriesAtEncounter = 0;
  let simulationDefeat = false;
  const encounteredNodeIds = new Set<string>();
  const apply = (action: GameAction) => {
    capture?.actions?.push(action);
    state = gameReducer(state, action);
  };
  const trace = capture?.trace;
  apply({ type: "choose-vocation", vocationId });
  const stableFormationUnitIds = new Set(
    state.roster
      .filter((unit) => unit.slot !== null)
      .map((unit) => unit.instanceId),
  );
  for (
    let guard = 0;
    guard < 1000 && state.phase !== "complete" && state.phase !== "defeat";
    guard += 1
  ) {
    if (state.phase === "map") {
      const origin = nodeById[state.mapNodeId];
      const outgoing = state.routeEdges[state.mapNodeId] ?? origin?.nextNodeIds ?? [];
      if (!origin || outgoing.length === 0) break;
      const routeId = strategy.chooseRoute(outgoing, state, random);
      trace?.push(`Route: ${nodeById[routeId]?.name ?? routeId}`);
      apply({ type: "choose-route", nodeId: routeId });
      continue;
    }
    if (state.phase === "preparation") {
      equipBackpackItems(() => state, apply, trace);
      const pinnedUnitIds = new Set(
        state.roster
          .filter(
            (unit) =>
              unit.slot !== null && stableFormationUnitIds.has(unit.instanceId),
          )
          .map((unit) => unit.instanceId),
      );
      let rerollsThisVisit = 0;
      while (true) {
        const creatureId = chooseShopPurchases(state, strategy, random)[0];
        if (creatureId) {
          const goldBefore = state.gold;
          const before = state;
          apply({ type: "buy", creatureId });
          if (before === state) break;
          purchasesMade += 1;
          trace?.push(
            `Buy: ${creatureById[creatureId]?.name ?? creatureId} (${goldBefore} → ${state.gold} gold)`,
          );
          continue;
        }
        const uniqueRosterCount = deployableUnits(state, new Set()).length;
        if (
          state.deploymentLimit < BOARD_CAPACITY &&
          uniqueRosterCount > state.deploymentLimit &&
          state.gold >= DEPLOYMENT_LIMIT_ITEM_COST
        ) {
          const before = state;
          apply({ type: "buy-deployment-upgrade" });
          if (before !== state) {
            trace?.push(`Formation Permit: capacity ${state.deploymentLimit} (${state.gold} gold left)`);
            continue;
          }
        }
        if (
          rerollsThisVisit >= 3 ||
          state.gold < 4 ||
          !strategy.reroll(state, random)
        )
          break;
        const oldOffers = state.shopCreatureIds
          .map((id) => creatureById[id]?.name ?? id)
          .join(", ");
        const before = state;
        apply({ type: "reroll" });
        if (before === state) break;
        rerollsUsed += 1;
        rerollsThisVisit += 1;
        trace?.push(
          `Reroll: ${oldOffers} → ${state.shopCreatureIds.map((id) => creatureById[id]?.name ?? id).join(", ")} (${state.gold} gold left)`,
        );
      }
      const plannedFormation = strategy.formation(state, random, pinnedUnitIds);
      const preFormationState = state;
      state = applyFormation(state, plannedFormation, pinnedUnitIds, (action) =>
        capture?.actions?.push(action),
      );
      stableFormationUnitIds.clear();
      for (const unit of state.roster) {
        if (unit.slot !== null) stableFormationUnitIds.add(unit.instanceId);
      }
      trace?.push(
        `Formation: ${state.roster
          .filter((unit) => unit.slot !== null)
          .map(
            (unit) =>
              `${creatureById[unit.creatureId]?.name ?? unit.creatureId} ★${unit.star} at ${unit.slot}`,
          )
          .join("; ")}`,
      );
      const eligibleUnitCount = deployableUnits(state, new Set()).length;
      const eligibleUnitIds = new Set(
        deployableUnits(state, new Set()).map((unit) => unit.instanceId),
      );
      const deployedCount = state.roster.filter(
        (unit) => unit.slot !== null,
      ).length;
      const assignments = plannedFormation.flatMap((assignment) => {
        const unit = state.roster.find(
          (candidate) => candidate.instanceId === assignment.instanceId,
        );
        const creature = unit ? creatureById[unit.creatureId] : undefined;
        if (!unit || !creature) return [];
        const previousSlot = preFormationState.roster.find(
          (candidate) => candidate.instanceId === unit.instanceId,
        )?.slot;
        const decision: FormationDiagnostic["assignments"][number]["decision"] =
          previousSlot === assignment.slot
            ? "kept"
            : previousSlot === null || previousSlot === undefined
              ? "deployed"
              : "moved";
        return [
          {
            instanceId: unit.instanceId,
            creatureId: creature.id,
            role: creature.role,
            slot: assignment.slot,
            decision,
          },
        ];
      });
      const assignedUnitIds = new Set(
        assignments.map((assignment) => assignment.instanceId),
      );
      const unassignedUnitIds = [...eligibleUnitIds].filter(
        (instanceId) => !assignedUnitIds.has(instanceId),
      );
      capture?.formations?.push({
        deployedCount,
        eligibleUnitCount,
        boardCapacity: BOARD_CAPACITY,
        deploymentLimit: state.deploymentLimit,
        unassignedUnitIds,
        assignments,
      });
      trace?.push(
        `Formation decisions: ${assignments.map((assignment) => `${assignment.decision} ${creatureById[assignment.creatureId]?.name ?? assignment.creatureId} at ${assignment.slot}`).join("; ") || "none"}${unassignedUnitIds.length ? `; unassigned ${unassignedUnitIds.join(", ")}` : ""}`,
      );
      trace?.push(
        `Formation capacity: ${deployedCount}/${Math.min(eligibleUnitCount, state.deploymentLimit)} eligible units deployed`,
      );
      apply({ type: "start-battle" });
      if (state.phase === "battle" || state.phase === "defeat") {
        const nodeId = state.encounterNodeId;
        if (nodeId && !encounteredNodeIds.has(nodeId)) {
          encounteredNodeIds.add(nodeId);
          encountersPlayed += 1;
        }
        const node = state.encounterNodeId
          ? nodeById[state.encounterNodeId]
          : undefined;
        trace?.push(
          `Battle ${node?.name ?? state.encounterNodeId}: ${state.battleResult?.won ? "WIN" : "LOSS"}, ${state.battleResult?.rounds ?? 0} ticks; ${state.lives} lives, ${state.gold} gold`,
        );
        const droppedItemId = state.battleResult?.won ? state.rewardItemIds[0] : undefined;
        if (droppedItemId) trace?.push(`Boss item drop: ${itemById[droppedItemId]?.name ?? droppedItemId}`);
      }
      continue;
    }
    if (state.phase === "battle") {
      if (state.battleResult?.won) {
        retriesAtEncounter = 0;
        apply({ type: "claim-victory" });
      } else {
        if (retriesAtEncounter >= 3) {
          simulationDefeat = true;
          trace?.push(
            "Simulation records a loss after three retries; players may continue retrying this encounter.",
          );
          break;
        }
        retriesAtEncounter += 1;
        trace?.push("Retry: return to preparation and adjust the team");
        apply({ type: "retry" });
      }
      continue;
    }
    if (state.phase === "reward") {
      if (!state.selectedCreatureRewardId) {
        const rewardId =
          chooseByScore(
            state.rewardCreatureIds,
            (id) => {
              const creature = creatureById[id];
              return creature
                ? strategy.creatureScore(creature, state, random)
                : -Infinity;
            },
            random,
          ) ?? state.rewardCreatureIds[0];
        if (rewardId)
          apply({
            type: "choose-creature-reward",
            creatureId: rewardId,
          });
        if (rewardId)
          trace?.push(
            `Creature reward: ${creatureById[rewardId]?.name ?? rewardId}`,
          );
        continue;
      }
      if (state.pendingLevelUps > 0) {
        const upgradeId =
          chooseByScore(
            state.rewardUpgradeIds,
            (id) => {
              const upgrade = upgradeById[id];
              return upgrade
                ? strategy.upgradeScore(upgrade, state, random)
                : -Infinity;
            },
            random,
          ) ?? state.rewardUpgradeIds[0];
        if (upgradeId)
          apply({
            type: "choose-upgrade-reward",
            upgradeId,
          });
        if (upgradeId)
          trace?.push(`Upgrade: ${upgradeById[upgradeId]?.name ?? upgradeId}`);
        continue;
      }
      break;
    }
    break;
  }
  if (state.phase !== "complete" && state.phase !== "defeat" && !simulationDefeat) {
    throw new Error(
      `Campaign did not reach an ending for seed ${seed}, vocation ${vocationId}, strategy ${strategy.id} (phase ${state.phase}, encounter ${state.encounterNodeId ?? "none"}, cleared ${state.completedNodeIds.length}, gold ${state.gold}, rewards ${state.rewardCreatureIds.length}/${state.rewardUpgradeIds.length}).`,
    );
  }
  const outcome: CampaignOutcome = state.phase === "complete" && !simulationDefeat ? "win" : "lose";
  trace?.push(
    `END: ${outcome.toUpperCase()} after ${state.completedNodeIds.length} cleared encounters; ${state.lives} lives, ${state.gold} gold, ${purchasesMade} purchases, ${rerollsUsed} rerolls`,
  );
  return {
    seed: Math.trunc(seed) >>> 0,
    vocationId,
    strategyId: strategy.id,
    outcome,
    encountersPlayed,
    encountersCleared: state.completedNodeIds.length,
    finalLives: state.lives,
    finalGold: state.gold,
    finalRosterSize: state.roster.length,
    purchasesMade,
    rerollsUsed,
  };
}

export function runBalanceBatch(
  config: BalanceRunConfig,
  onProgress?: (completed: number, total: number) => void,
): SeedRunResult[] {
  const total =
    normalizedSeedCount(config.seedCount) *
    selectedStrategies(config).length *
    selectedVocations(config.vocationIds).length;
  const results: SeedRunResult[] = [];
  let completed = 0;
  for (const job of balanceJobs(config)) {
    results.push(runCampaign(job.seed, job.vocationId, job.strategy));
    completed += 1;
    if (completed % 100 === 0 || completed === total)
      onProgress?.(completed, total);
  }
  return results;
}

export async function runBalanceBatchAsync(
  config: BalanceRunConfig,
  onProgress?: (completed: number, total: number) => void,
): Promise<SeedRunResult[]> {
  const total =
    normalizedSeedCount(config.seedCount) *
    selectedStrategies(config).length *
    selectedVocations(config.vocationIds).length;
  const results: SeedRunResult[] = [];
  let completed = 0;
  for (const job of balanceJobs(config)) {
    results.push(runCampaign(job.seed, job.vocationId, job.strategy));
    completed += 1;
    if (completed % 25 === 0 || completed === total) {
      onProgress?.(completed, total);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return results;
}
