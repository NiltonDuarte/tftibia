import {
  campaign,
  creatureById,
  creatures,
  nodeById,
  synergies,
  upgradeById,
  upgrades,
  vocationById,
  itemById,
  items,
  bossById,
} from "../content/content";
import type { Creature } from "../content/schemas";
import { EquipmentSlotSchema } from "../content/schemas";
import { simulateBattle } from "./combat";
import {
  BOARD_SLOTS,
  BOARD_SLOT_IDS,
  BOARD_CAPACITY,
  DEPLOYMENT_LIMIT_ITEM_COST,
  availableBoardSlots,
  preferredSlotsForRole,
} from "./board";
import { initialGameState, type GameState } from "./stateSchema";

export type GameAction =
  | { type: "choose-vocation"; vocationId: string }
  | { type: "choose-route"; nodeId: string }
  | { type: "buy"; creatureId: string }
  | { type: "sell-unit"; unitId: string }
  | { type: "reroll" }
  | { type: "buy-deployment-upgrade" }
  | { type: "equip-item"; unitId: string; itemId: string }
  | { type: "unequip-item"; unitId: string; slot: string }
  | { type: "select-unit"; unitId: string | null }
  | { type: "place-unit"; slot: number }
  | { type: "move-unit"; unitId: string; slot: number }
  | { type: "bench-unit" }
  | { type: "start-battle" }
  | { type: "claim-victory" }
  | { type: "retry" }
  | { type: "choose-creature-reward"; creatureId: string }
  | { type: "choose-upgrade-reward"; upgradeId: string }
  | { type: "choose-item-reward"; itemId: string }
  | { type: "new-run"; seed: number };

export function nextRandom(state: number): { value: number; state: number } {
  let next = state >>> 0;
  if (next === 0) next = 0x6d2b79f5;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { value: next / 0x100000000, state: next };
}

function drawOne<T>(items: readonly T[], rngState: number): { value: T | undefined; rngState: number } {
  if (items.length === 0) return { value: undefined, rngState };
  const random = nextRandom(rngState);
  return { value: items[Math.floor(random.value * items.length)], rngState: random.state };
}

function generateRouteEdges(initialState: number): { edges: Record<string, string[]>; rngState: number } {
  let rngState = initialState;
  const layers = Array.from({ length: 10 }, (_, index) => {
    const stage = index + 1;
    const candidates = campaign.nodes.filter((node) => node.stage === stage);
    if (stage === 10) return candidates.slice(0, 1);
    const targetCount = [3, 6, 9].includes(stage) ? candidates.length : Math.min(2, candidates.length);
    const pool = [...candidates];
    const selected: typeof candidates = [];
    while (selected.length < targetCount && pool.length > 0) {
      const draw = drawOne(pool, rngState);
      rngState = draw.rngState;
      if (!draw.value) break;
      selected.push(draw.value);
      pool.splice(pool.indexOf(draw.value), 1);
    }
    return selected;
  });
  const edges: Record<string, string[]> = {};
  const first = layers[0] ?? [];
  edges[campaign.startNodeId] = first.map((node) => node.id);
  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    const currentLayer = layers[layerIndex] ?? [];
    const nextLayer = layers[layerIndex + 1] ?? [];
    for (const target of nextLayer) {
      const parent = drawOne(currentLayer, rngState);
      rngState = parent.rngState;
      if (parent.value) (edges[parent.value.id] ??= []).push(target.id);
    }
    for (const source of currentLayer) {
      if ((edges[source.id]?.length ?? 0) === 0 && nextLayer.length > 0) {
        const target = drawOne(nextLayer, rngState);
        rngState = target.rngState;
        if (target.value) (edges[source.id] ??= []).push(target.value.id);
      }
      for (const target of nextLayer) {
        const random = nextRandom(rngState);
        rngState = random.state;
        if (random.value < 0.18) (edges[source.id] ??= []).push(target.id);
      }
    }
  }
  return { edges: Object.fromEntries(Object.entries(edges).map(([id, next]) => [id, [...new Set(next)]])), rngState };
}

function shuffle<T>(
  items: readonly T[],
  initialState: number,
): { items: T[]; rngState: number } {
  const result = [...items];
  let rngState = initialState;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = nextRandom(rngState);
    rngState = random.state;
    const swapIndex = Math.floor(random.value * (index + 1));
    const current = result[index];
    const target = result[swapIndex];
    if (current === undefined || target === undefined) continue;
    result[index] = target;
    result[swapIndex] = current;
  }
  return { items: result, rngState };
}

function drawCreatureOffers(
  count: number,
  rngState: number,
  disfavoredFamilies: ReadonlySet<string> = new Set(),
): { offers: string[]; rngState: number } {
  const pool = creatures;
  const offers: string[] = [];
  while (offers.length < count && pool.length > 0) {
    const weights = pool.map((creature) => disfavoredFamilies.has(creature.family) ? 0.35 : 1);
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    const draw = nextRandom(rngState);
    rngState = draw.state;
    let threshold = draw.value * totalWeight;
    let selectedIndex = pool.length - 1;
    for (let index = 0; index < weights.length; index += 1) {
      threshold -= weights[index] ?? 0;
      if (threshold < 0) {
        selectedIndex = index;
        break;
      }
    }
    const selected = pool[selectedIndex];
    if (selected) offers.push(selected.id);
  }
  return { offers, rngState };
}

function currentShopSize(state: GameState): number {
  const node = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined;
  return campaign.shopSize + (node?.shopBonus ?? 0);
}

function phaseFamilies(node: typeof campaign.nodes[number]): Set<string> {
  if (node.bossId) {
    const boss = bossById[node.bossId];
    return boss ? new Set([boss.family]) : new Set();
  }
  const familyCounts = new Map<string, number>();
  for (const creatureId of node.enemies) {
    const creature = creatureById[creatureId];
    if (creature) familyCounts.set(creature.family, (familyCounts.get(creature.family) ?? 0) + 1);
  }
  const mainFamily = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return mainFamily ? new Set([mainFamily]) : new Set();
}

function drawUpgradeOffers(
  vocationId: string | null,
  rngState: number,
): { offers: string[]; rngState: number } {
  const shuffled = shuffle(
    upgrades.filter((upgrade) => upgrade.vocation === vocationId),
    rngState,
  );
  return {
    offers: shuffled.items.slice(0, 3).map((upgrade) => upgrade.id),
    rngState: shuffled.rngState,
  };
}

export function createGame(seed: number): GameState {
  const normalizedSeed = Math.trunc(seed) >>> 0;
  return {
    ...initialGameState,
    seed: normalizedSeed,
    rngState: normalizedSeed || 0x6d2b79f5,
  };
}

function mergeCopies(roster: GameState["roster"]): GameState["roster"] {
  let result = [...roster];
  let merged = true;
  while (merged) {
    merged = false;
    const creatureIds = [...new Set(result.map((unit) => unit.creatureId))];
    for (const creatureId of creatureIds) {
      for (const star of [1, 2]) {
        const copies = result.filter(
          (unit) => unit.creatureId === creatureId && unit.star === star,
        );
        if (copies.length < 3) continue;
        const triple = copies.slice(0, 3);
        const leader = triple.find((unit) => unit.slot !== null) ?? triple[0];
        if (!leader) continue;
        const occupiedSlot =
          triple.find((unit) => unit.slot !== null)?.slot ?? null;
        const removed = new Set(triple.map((unit) => unit.instanceId));
        result = result.filter((unit) => !removed.has(unit.instanceId));
        result.push({ ...leader, slot: occupiedSlot, star: star + 1 });
        merged = true;
        break;
      }
      if (merged) break;
    }
  }
  return result;
}

function firstEmptySlot(roster: GameState["roster"]): number | null {
  return availableBoardSlots(roster)[0] ?? null;
}

function finishRewards(state: GameState): GameState {
  if (
    !state.selectedCreatureRewardId ||
    state.pendingLevelUps > 0 ||
    (state.rewardItemIds.length > 0 && !state.selectedItemRewardId) ||
    !state.encounterNodeId
  )
    return state;
  const node = nodeById[state.encounterNodeId];
  if (!node) return state;
  const completedNodeIds = [...new Set([...state.completedNodeIds, node.id])];
  return {
    ...state,
    phase: (state.routeEdges[node.id] ?? node.nextNodeIds).length === 0 ? "complete" : "map",
    mapNodeId: node.id,
    encounterNodeId: null,
    selectedUnitId: null,
    shopCreatureIds: [],
    rewardCreatureIds: [],
    rewardUpgradeIds: [],
    rewardItemIds: [],
    selectedCreatureRewardId: null,
    selectedUpgradeRewardId: null,
    selectedItemRewardId: null,
    battleResult: null,
    completedNodeIds,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "choose-vocation": {
      const selected = vocationById[action.vocationId];
      if (!selected || state.phase !== "vocation") return state;
      const occupiedSlots = new Set<number>();
      const roster = campaign.startingCreatures.map((creatureId, index) => {
        const creature = creatureById[creatureId];
        const preferredSlots = creature
          ? preferredSlotsForRole(creature.role)
          : BOARD_SLOTS;
        const slot = [...preferredSlots, ...BOARD_SLOTS].find(
          (candidate) => !occupiedSlots.has(candidate),
        ) ?? null;
        if (slot !== null) occupiedSlots.add(slot);
        return {
          instanceId: `unit-${index}`,
          creatureId,
          slot,
          star: 1,
          equippedItems: {},
        };
      });
      const routes = generateRouteEdges(state.rngState);
      return {
        ...state,
        phase: "map",
        commanderId: selected.id,
        mapNodeId: campaign.startNodeId,
        gold: campaign.startingGold,
        lives: 3,
        roster,
        nextUnitId: roster.length,
        routeEdges: routes.edges,
        rngState: routes.rngState,
      };
    }
    case "choose-route": {
      if (state.phase !== "map") return state;
      const origin = nodeById[state.mapNodeId];
      const node = nodeById[action.nodeId];
      const outgoing = state.routeEdges[state.mapNodeId] ?? origin?.nextNodeIds ?? [];
      if (!outgoing.includes(action.nodeId) || !node) return state;
      const draw = drawCreatureOffers(
        campaign.shopSize + node.shopBonus,
        state.rngState,
        phaseFamilies(node),
      );
      return {
        ...state,
        phase: "preparation",
        encounterNodeId: action.nodeId,
        shopCreatureIds: draw.offers,
        rngState: draw.rngState,
        selectedUnitId: null,
        battleResult: null,
      };
    }
    case "buy": {
      if (state.phase !== "preparation") return state;
      if (!state.shopCreatureIds.includes(action.creatureId)) return state;
      const creature = creatureById[action.creatureId];
      if (!creature || state.gold < creature.cost) return state;
      const duplicateAlreadyDeployed = state.roster.some(
        (unit) => unit.creatureId === creature.id && unit.slot !== null,
      );
      const deployedCount = state.roster.filter((unit) => unit.slot !== null).length;
      const hasOpenBoardPosition = deployedCount < state.deploymentLimit && availableBoardSlots(state.roster).length > 0;
      const slot =
        !duplicateAlreadyDeployed && hasOpenBoardPosition
          ? firstEmptySlot(state.roster)
          : null;
      const roster = mergeCopies([
        ...state.roster,
        {
          instanceId: `unit-${state.nextUnitId}`,
          creatureId: creature.id,
          slot,
          star: 1,
          equippedItems: {},
        },
      ]);
      const encounterNode = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined;
      const remainingOffers = [...state.shopCreatureIds];
      remainingOffers.splice(remainingOffers.indexOf(creature.id), 1);
      const refreshedOffers = remainingOffers.length > 0
        ? { offers: remainingOffers, rngState: state.rngState }
        : drawCreatureOffers(currentShopSize(state), state.rngState, encounterNode ? phaseFamilies(encounterNode) : new Set());
      return {
        ...state,
        gold: state.gold - creature.cost,
        roster,
        nextUnitId: state.nextUnitId + 1,
        shopCreatureIds: refreshedOffers.offers,
        rngState: refreshedOffers.rngState,
        selectedUnitId:
          state.selectedUnitId &&
          roster.some((unit) => unit.instanceId === state.selectedUnitId)
            ? state.selectedUnitId
            : null,
      };
    }
    case "sell-unit": {
      if (state.phase !== "preparation") return state;
      const unit = state.roster.find((entry) => entry.instanceId === action.unitId);
      const creature = unit ? creatureById[unit.creatureId] : undefined;
      if (!unit || !creature) return state;
      return {
        ...state,
        gold: state.gold + Math.ceil(creature.cost / 2),
        roster: state.roster.filter((entry) => entry.instanceId !== unit.instanceId),
        backpackItemIds: [...state.backpackItemIds, ...Object.values(unit.equippedItems)],
        selectedUnitId: state.selectedUnitId === unit.instanceId ? null : state.selectedUnitId,
      };
    }
    case "reroll": {
      if (state.phase !== "preparation" || state.gold < 1) return state;
      const node = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined;
      const shopSize = currentShopSize(state);
      const phase = node ? phaseFamilies(node) : new Set<string>();
      const draw = drawCreatureOffers(shopSize, state.rngState, phase);
      return {
        ...state,
        gold: state.gold - 1,
        shopCreatureIds: draw.offers,
        rngState: draw.rngState,
      };
    }
    case "buy-deployment-upgrade": {
      if (
        state.phase !== "preparation" ||
        state.gold < DEPLOYMENT_LIMIT_ITEM_COST ||
        state.deploymentLimit >= BOARD_CAPACITY
      ) return state;
      return {
        ...state,
        gold: state.gold - DEPLOYMENT_LIMIT_ITEM_COST,
        deploymentLimit: state.deploymentLimit + 1,
      };
    }
    case "equip-item": {
      if (state.phase === "battle" || state.phase === "defeat" || state.phase === "complete") return state;
      const unit = state.roster.find((entry) => entry.instanceId === action.unitId);
      const item = itemById[action.itemId];
      const creature = creatureById[unit?.creatureId ?? ""];
      if (!unit || !item || !creature || (!item.universal && !item.allowedRoles.includes(creature.role))) return state;
      const inventoryIndex = state.backpackItemIds.indexOf(item.id);
      if (inventoryIndex < 0) return state;
      const replacedId = unit.equippedItems[item.slot];
      const backpackItemIds = [...state.backpackItemIds];
      backpackItemIds.splice(inventoryIndex, 1);
      if (replacedId) backpackItemIds.push(replacedId);
      return {
        ...state,
        backpackItemIds,
        roster: state.roster.map((entry) => entry.instanceId === unit.instanceId
          ? { ...entry, equippedItems: { ...entry.equippedItems, [item.slot]: item.id } }
          : entry),
      };
    }
    case "unequip-item": {
      if (state.phase === "battle" || state.phase === "defeat" || state.phase === "complete") return state;
      const unit = state.roster.find((entry) => entry.instanceId === action.unitId);
      const slot = EquipmentSlotSchema.safeParse(action.slot);
      if (!unit || !slot.success || !Object.hasOwn(unit.equippedItems, slot.data)) return state;
      const itemId = unit.equippedItems[slot.data];
      if (!itemId) return state;
      const equippedItems = { ...unit.equippedItems };
      delete equippedItems[slot.data];
      return {
        ...state,
        backpackItemIds: [...state.backpackItemIds, itemId],
        roster: state.roster.map((entry) => entry.instanceId === unit.instanceId ? { ...entry, equippedItems } : entry),
      };
    }
    case "select-unit":
      if (state.phase !== "preparation") return state;
      return { ...state, selectedUnitId: action.unitId };
    case "place-unit": {
      if (
        state.phase !== "preparation" ||
        !state.selectedUnitId ||
        !BOARD_SLOT_IDS.has(action.slot)
      )
        return state;
      const selected = state.roster.find(
        (unit) => unit.instanceId === state.selectedUnitId,
      );
      if (!selected) return state;
      const duplicateOnBoard = state.roster.some(
        (unit) =>
          unit.instanceId !== selected.instanceId &&
          unit.slot !== null &&
          unit.creatureId === selected.creatureId,
      );
      if (duplicateOnBoard) return state;
      const occupant = state.roster.find((unit) => unit.slot === action.slot);
      if (occupant && occupant.instanceId !== state.selectedUnitId)
        return { ...state, selectedUnitId: occupant.instanceId };
      const deployedCount = state.roster.filter((unit) => unit.slot !== null).length;
      if (selected.slot === null && deployedCount >= state.deploymentLimit) return state;
      return {
        ...state,
        roster: state.roster.map((unit) =>
          unit.instanceId === state.selectedUnitId
            ? { ...unit, slot: action.slot }
            : unit,
        ),
      };
    }
    case "move-unit": {
      if (state.phase !== "preparation" || !BOARD_SLOT_IDS.has(action.slot)) return state;
      const moving = state.roster.find((unit) => unit.instanceId === action.unitId);
      if (!moving) return state;
      const occupant = state.roster.find((unit) => unit.slot === action.slot);
      if (occupant?.instanceId === moving.instanceId) return state;
      const deployedCount = state.roster.filter((unit) => unit.slot !== null).length;
      if (moving.slot === null && !occupant && deployedCount >= state.deploymentLimit) return state;
      const nextMovingSlot = action.slot;
      const nextOccupantSlot = occupant ? moving.slot : null;
      if (nextOccupantSlot !== null && state.roster.some((unit) =>
        unit.instanceId !== moving.instanceId && unit.instanceId !== occupant?.instanceId &&
        unit.slot !== null && unit.creatureId === moving.creatureId,
      )) return state;
      if (occupant && nextOccupantSlot !== null && state.roster.some((unit) =>
        unit.instanceId !== moving.instanceId && unit.instanceId !== occupant.instanceId &&
        unit.slot !== null && unit.creatureId === occupant.creatureId,
      )) return state;
      return {
        ...state,
        roster: state.roster.map((unit) => unit.instanceId === moving.instanceId
          ? { ...unit, slot: nextMovingSlot }
          : occupant && unit.instanceId === occupant.instanceId
            ? { ...unit, slot: nextOccupantSlot }
            : unit),
        selectedUnitId: null,
      };
    }
    case "bench-unit":
      if (state.phase !== "preparation" || !state.selectedUnitId) return state;
      return {
        ...state,
        roster: state.roster.map((unit) =>
          unit.instanceId === state.selectedUnitId
            ? { ...unit, slot: null }
            : unit,
        ),
        selectedUnitId: null,
      };
    case "start-battle": {
      if (state.phase !== "preparation" || !state.encounterNodeId) return state;
      const node = nodeById[state.encounterNodeId];
      if (!node) return state;
      const boss = node.bossId ? bossById[node.bossId] : undefined;
      const encounterCreatures = node.enemies
        .map((id) => creatureById[id])
        .filter((creature): creature is Creature => Boolean(creature));
      const enemies = boss ? [...encounterCreatures, boss] : encounterCreatures;
      const vocation = state.commanderId
        ? vocationById[state.commanderId]
        : undefined;
      const selectedUpgrades = state.upgradeIds
        .map((id) => upgradeById[id])
        .filter((upgrade) => Boolean(upgrade));
      const result = simulateBattle({
        roster: state.roster,
        enemies,
        creatures: creatureById,
        synergies,
        vocation,
        upgrades: selectedUpgrades,
        items: itemById,
        bossIds: new Set(boss ? [boss.id] : []),
        enemyPower: 1 + Math.max(0, node.stage - 1) * 0.12,
      });
      const rewardEligibleVictory = result.won && node.bossId !== "ferumbras";
      let rngState = state.rngState;
      const creatureRewards = rewardEligibleVictory
        ? drawCreatureOffers(node.creatureOfferCount, rngState, phaseFamilies(node))
        : { offers: [], rngState };
      rngState = creatureRewards.rngState;
      const upgradeRewards = rewardEligibleVictory
        ? drawUpgradeOffers(state.commanderId, rngState)
        : { offers: [], rngState };
      rngState = upgradeRewards.rngState;
      const itemPool = rewardEligibleVictory && node.bossId
        ? items.filter((item) => item.bossId === node.bossId)
        : [];
      const itemDrop = drawOne(itemPool, rngState);
      rngState = itemDrop.rngState;
      const itemRewards = itemDrop.value ? [itemDrop.value.id] : [];
      return {
        ...state,
        phase: "battle",
        battleResult: result,
        rewardCreatureIds: creatureRewards.offers,
        rewardUpgradeIds: upgradeRewards.offers,
        rewardItemIds: itemRewards,
        rngState,
      };
    }
    case "claim-victory": {
      if (
        state.phase !== "battle" ||
        !state.battleResult?.won ||
        !state.encounterNodeId
      )
        return state;
      const node = nodeById[state.encounterNodeId];
      if (!node) return state;
      if (node.bossId === "ferumbras") {
        return {
          ...state,
          phase: "complete",
          mapNodeId: node.id,
          encounterNodeId: null,
          completedNodeIds: [...new Set([...state.completedNodeIds, node.id])],
          rewardCreatureIds: [],
          rewardUpgradeIds: [],
          rewardItemIds: [],
          selectedCreatureRewardId: null,
          selectedUpgradeRewardId: null,
          selectedItemRewardId: null,
          selectedUnitId: null,
        };
      }
      const totalExperience = state.experience + 25 + node.rewardExperience;
      const droppedItemId = state.rewardItemIds[0];
      const levelsGained = Math.floor(totalExperience / 100);
      return {
        ...state,
        phase: "reward",
        gold: state.gold + 3 + node.rewardGold,
        backpackItemIds: droppedItemId
          ? [...state.backpackItemIds, droppedItemId]
          : state.backpackItemIds,
        selectedItemRewardId: droppedItemId ?? null,
        experience: totalExperience % 100,
        level: state.level + levelsGained,
        pendingLevelUps: levelsGained,
      };
    }
    case "retry":
      if (
        state.phase !== "battle" ||
        state.battleResult?.won ||
        state.lives <= 0
      )
        return state;
      return { ...state, phase: "preparation", battleResult: null };
    case "choose-creature-reward": {
      if (
        state.phase !== "reward" ||
        state.selectedCreatureRewardId ||
        !state.rewardCreatureIds.includes(action.creatureId)
      )
        return state;
      const creature = creatureById[action.creatureId];
      if (!creature) return state;
      const alreadyDeployed = state.roster.some(
        (unit) => unit.creatureId === creature.id && unit.slot !== null,
      );
      const deployedCount = state.roster.filter((unit) => unit.slot !== null).length;
      const hasOpenBoardPosition = deployedCount < state.deploymentLimit && availableBoardSlots(state.roster).length > 0;
      const roster = mergeCopies([
        ...state.roster,
        {
          instanceId: `unit-${state.nextUnitId}`,
          creatureId: creature.id,
          slot:
            !alreadyDeployed && hasOpenBoardPosition
              ? firstEmptySlot(state.roster)
              : null,
          star: 1,
          equippedItems: {},
        },
      ]);
      const selectedUnitId =
        state.selectedUnitId &&
        roster.some((unit) => unit.instanceId === state.selectedUnitId)
          ? state.selectedUnitId
          : null;
      return finishRewards({
        ...state,
        roster,
        nextUnitId: state.nextUnitId + 1,
        selectedUnitId,
        selectedCreatureRewardId: action.creatureId,
      });
    }
    case "choose-upgrade-reward": {
      if (
        state.phase !== "reward" ||
        state.pendingLevelUps <= 0 ||
        !state.rewardUpgradeIds.includes(action.upgradeId)
      )
        return state;
      return finishRewards({
        ...state,
        upgradeIds: [...state.upgradeIds, action.upgradeId],
        selectedUpgradeRewardId: action.upgradeId,
        pendingLevelUps: state.pendingLevelUps - 1,
        ...(state.pendingLevelUps > 1 ? (() => {
          const draw = drawUpgradeOffers(state.commanderId, state.rngState);
          return { rewardUpgradeIds: draw.offers, rngState: draw.rngState };
        })() : {}),
      });
    }
    case "choose-item-reward": {
      if (state.phase !== "reward" || state.selectedItemRewardId || !state.rewardItemIds.includes(action.itemId)) return state;
      return finishRewards({
        ...state,
        backpackItemIds: [...state.backpackItemIds, action.itemId],
        selectedItemRewardId: action.itemId,
      });
    }
    case "new-run":
      return createGame(action.seed);
  }
}

export type CampaignOutcome = "win" | "lose";

export type SeedRunResult = {
  seed: number;
  vocationId: string;
  strategyId: string;
  outcome: CampaignOutcome;
  encountersPlayed: number;
  encountersCleared: number;
  finalLives: number;
  finalGold: number;
  finalRosterSize: number;
  purchasesMade: number;
  rerollsUsed: number;
};
