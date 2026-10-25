import { describe, expect, it } from "vitest";
import { campaign } from "../content/content";
import { createGame, gameReducer } from "./engine";
import { initialGameState } from "./stateSchema";

function preparationState(seed: number) {
  const chosenVocation = gameReducer(createGame(seed), {
    type: "choose-vocation",
    vocationId: "knight",
  });
  const routeId = chosenVocation.routeEdges[chosenVocation.mapNodeId]?.[0];
  if (!routeId) throw new Error("The generated starting route is missing.");
  return gameReducer(chosenVocation, { type: "choose-route", nodeId: routeId });
}

describe("unequip-item action", () => {
  it("ignores inherited property names instead of adding them to the backpack", () => {
    const state = {
      ...initialGameState,
      phase: "preparation" as const,
      roster: [
        {
          instanceId: "unit-1",
          creatureId: "cobra-vizier",
          slot: null,
          star: 1,
          equippedItems: { amulet: "cobra-amulet" },
        },
      ],
    };

    const next = gameReducer(state, {
      type: "unequip-item",
      unitId: "unit-1",
      slot: "toString",
    });

    expect(next).toBe(state);
    expect(next.backpackItemIds).toEqual([]);
    expect(next.roster[0]?.equippedItems).toEqual({ amulet: "cobra-amulet" });
  });
});

describe("sell-unit action", () => {
  it("pays half the shop price rounded up and returns equipped loot", () => {
    const base = preparationState(5);
    const state = {
      ...base,
      selectedUnitId: "unit-sell",
      roster: [{
        instanceId: "unit-sell",
        creatureId: "cobra-assassin",
        slot: 14,
        star: 2,
        equippedItems: { amulet: "cobra-amulet" },
      }],
    };

    const next = gameReducer(state, { type: "sell-unit", unitId: "unit-sell" });

    expect(next.gold).toBe(state.gold + 2);
    expect(next.roster).toEqual([]);
    expect(next.backpackItemIds).toContain("cobra-amulet");
    expect(next.selectedUnitId).toBeNull();
  });

  it("does not allow selling during combat", () => {
    const state = {
      ...preparationState(6),
      phase: "battle" as const,
      roster: [{
        instanceId: "unit-sell",
        creatureId: "cobra-vizier",
        slot: 14,
        star: 1,
        equippedItems: {},
      }],
    };

    expect(gameReducer(state, { type: "sell-unit", unitId: "unit-sell" })).toBe(state);
  });
});

describe("shop creature offers", () => {
  it("starts with no creatures and enough gold for a five-creature roster", () => {
    const state = gameReducer(createGame(1), {
      type: "choose-vocation",
      vocationId: "knight",
    });

    expect(state.roster).toEqual([]);
    expect(state.gold).toBe(campaign.startingGold);
    expect(state.gold).toBeGreaterThanOrEqual(25);
  });

  it("can offer the same creature more than once in a shop draw", () => {
    const hasDuplicate = Array.from({ length: 40 }, (_, index) => preparationState(index + 1))
      .some((state) => state.shopCreatureIds.some((id, index, offers) => offers.indexOf(id) !== index));

    expect(hasDuplicate).toBe(true);
  });

  it("consumes only one matching offer when buying a duplicate", () => {
    const state = preparationState(1);
    const creatureId = state.shopCreatureIds[0];
    if (!creatureId) throw new Error("The starting shop is empty.");
    const duplicateOfferState = {
      ...state,
      gold: 20,
      shopCreatureIds: [creatureId, creatureId],
    };

    const next = gameReducer(duplicateOfferState, { type: "buy", creatureId });

    expect(next.shopCreatureIds).toEqual([creatureId]);
  });

  it("allows duplicate creatures to appear after a reroll", () => {
    const hasDuplicate = Array.from({ length: 40 }, (_, index) => preparationState(index + 1))
      .some((state) => {
        const rerolled = gameReducer(state, { type: "reroll" });
        return rerolled.shopCreatureIds.some((id, index, offers) => offers.indexOf(id) !== index);
      });

    expect(hasDuplicate).toBe(true);
  });
});
