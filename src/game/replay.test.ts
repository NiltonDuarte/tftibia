import { describe, expect, it } from "vitest";
import { parseGameReplay } from "./replay";
import { initialGameState } from "./stateSchema";

describe("game replay parsing", () => {
  it("rejects legacy replay base states that cannot be migrated", () => {
    expect(() =>
      parseGameReplay({
        version: 1,
        source: "player",
        seed: 1,
        baseState: { saveVersion: 1, phase: "not-a-phase" },
        actions: [],
      }),
    ).toThrow("Replay contains an invalid legacy base state.");
  });

  it("rejects unequip actions with unknown equipment slots", () => {
    expect(() =>
      parseGameReplay({
        version: 1,
        source: "player",
        seed: 1,
        baseState: {
          saveVersion: 8,
          seed: 1,
          rngState: 1,
          nextUnitId: 0,
          deploymentLimit: 5,
          phase: "vocation",
          commanderId: null,
          mapNodeId: "crossroads",
          routeEdges: {},
          encounterNodeId: null,
          gold: 0,
          roster: [],
          shopCreatureIds: [],
          selectedUnitId: null,
          upgradeIds: [],
          rewardCreatureIds: [],
          rewardUpgradeIds: [],
          selectedCreatureRewardId: null,
          selectedUpgradeRewardId: null,
          completedNodeIds: [],
          lives: 3,
          experience: 0,
          level: 1,
          pendingLevelUps: 0,
          battleResult: null,
          backpackItemIds: [],
          rewardItemIds: [],
          selectedItemRewardId: null,
        },
        actions: [{ type: "unequip-item", unitId: "unit-1", slot: "toString" }],
      }),
    ).toThrow();
  });

  it("accepts creature sales as replay actions", () => {
    const replay = parseGameReplay({
      version: 1,
      source: "player",
      seed: 1,
      baseState: initialGameState,
      actions: [{ type: "sell-unit", unitId: "unit-1" }],
    });

    expect(replay.actions).toEqual([{ type: "sell-unit", unitId: "unit-1" }]);
  });
});
