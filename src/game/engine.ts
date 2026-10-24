import {
  campaign,
  creatureById,
  creatures,
  nodeById,
  synergies,
  upgradeById,
  upgrades,
  vocationById,
} from "../content/content";
import type { Creature } from "../content/schemas";
import { simulateBattle } from "./combat";
import {
  BOARD_SLOTS,
  BOARD_SLOT_IDS,
  availableBoardSlots,
  preferredSlotsForRole,
} from "./board";
import { initialGameState, type GameState } from "./stateSchema";

export type GameAction =
  | { type: "choose-vocation"; vocationId: string }
  | { type: "choose-route"; nodeId: string }
  | { type: "buy"; creatureId: string }
  | { type: "reroll" }
  | { type: "select-unit"; unitId: string | null }
  | { type: "place-unit"; slot: number }
  | { type: "bench-unit" }
  | { type: "start-battle" }
  | { type: "claim-victory" }
  | { type: "retry" }
  | { type: "choose-creature-reward"; creatureId: string }
  | { type: "choose-upgrade-reward"; upgradeId: string }
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
): { offers: string[]; rngState: number } {
  const shuffled = shuffle(creatures, rngState);
  return {
    offers: shuffled.items.slice(0, count).map((creature) => creature.id),
    rngState: shuffled.rngState,
  };
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
    !state.encounterNodeId
  )
    return state;
  const node = nodeById[state.encounterNodeId];
  if (!node) return state;
  const completedNodeIds = [...new Set([...state.completedNodeIds, node.id])];
  return {
    ...state,
    phase: node.nextNodeIds.length === 0 ? "complete" : "map",
    mapNodeId: node.id,
    encounterNodeId: null,
    selectedUnitId: null,
    shopCreatureIds: [],
    rewardCreatureIds: [],
    rewardUpgradeIds: [],
    selectedCreatureRewardId: null,
    selectedUpgradeRewardId: null,
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
        };
      });
      return {
        ...state,
        phase: "map",
        commanderId: selected.id,
        mapNodeId: campaign.startNodeId,
        gold: campaign.startingGold,
        lives: 3,
        roster,
        nextUnitId: roster.length,
      };
    }
    case "choose-route": {
      if (state.phase !== "map") return state;
      const origin = nodeById[state.mapNodeId];
      const node = nodeById[action.nodeId];
      if (!origin?.nextNodeIds.includes(action.nodeId) || !node) return state;
      const draw = drawCreatureOffers(
        campaign.shopSize + node.shopBonus,
        state.rngState,
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
      const creature = creatureById[action.creatureId];
      if (!creature || state.gold < creature.cost) return state;
      const duplicateAlreadyDeployed = state.roster.some(
        (unit) => unit.creatureId === creature.id && unit.slot !== null,
      );
      const hasOpenBoardPosition = availableBoardSlots(state.roster).length > 0;
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
        },
      ]);
      return {
        ...state,
        gold: state.gold - creature.cost,
        roster,
        nextUnitId: state.nextUnitId + 1,
        selectedUnitId:
          state.selectedUnitId &&
          roster.some((unit) => unit.instanceId === state.selectedUnitId)
            ? state.selectedUnitId
            : null,
      };
    }
    case "reroll": {
      if (state.phase !== "preparation" || state.gold < 1) return state;
      const draw = drawCreatureOffers(campaign.shopSize, state.rngState);
      return {
        ...state,
        gold: state.gold - 1,
        shopCreatureIds: draw.offers,
        rngState: draw.rngState,
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
      return {
        ...state,
        roster: state.roster.map((unit) =>
          unit.instanceId === state.selectedUnitId
            ? { ...unit, slot: action.slot }
            : unit,
        ),
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
      const enemies = node.enemies
        .map((id) => creatureById[id])
        .filter((creature): creature is Creature => Boolean(creature));
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
        enemyPower: 1 + Math.max(0, node.stage - 1) * 0.12,
      });
      let rngState = state.rngState;
      const creatureRewards = result.won
        ? drawCreatureOffers(node.creatureOfferCount, rngState)
        : { offers: [], rngState };
      rngState = creatureRewards.rngState;
      const upgradeRewards = result.won
        ? drawUpgradeOffers(state.commanderId, rngState)
        : { offers: [], rngState };
      rngState = upgradeRewards.rngState;
      const lives = result.won ? state.lives : Math.max(0, state.lives - 1);
      return {
        ...state,
        phase: !result.won && lives === 0 ? "defeat" : "battle",
        lives,
        gold: result.won ? state.gold : Math.max(0, state.gold - 2),
        battleResult: result,
        rewardCreatureIds: creatureRewards.offers,
        rewardUpgradeIds: upgradeRewards.offers,
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
      const totalExperience = state.experience + 25 + node.rewardExperience;
      const levelsGained = Math.floor(totalExperience / 100);
      return {
        ...state,
        phase: "reward",
        gold: state.gold + 3 + node.rewardGold,
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
      const hasOpenBoardPosition = availableBoardSlots(state.roster).length > 0;
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
