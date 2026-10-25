import { describe, expect, it } from "vitest";
import { BALANCE_STRATEGIES, runBalanceBatch, runCampaign } from "./balance";
import { BOARD_CAPACITY, BOARD_LAYOUT, BOARD_SLOTS } from "./board";

describe("seeded campaign balance runner", () => {
  it("runs every vocation and strategy to a recorded campaign ending", () => {
    const results = runBalanceBatch({ firstSeed: 125, seedCount: 1 });

    expect(results).toHaveLength(4 * BALANCE_STRATEGIES.length);
    expect(new Set(results.map((result) => result.vocationId))).toEqual(
      new Set(["knight", "paladin", "sorcerer", "druid"]),
    );
    expect(new Set(results.map((result) => result.strategyId))).toEqual(
      new Set(BALANCE_STRATEGIES.map((strategy) => strategy.id)),
    );
    for (const result of results) {
      expect(["win", "lose"]).toContain(result.outcome);
      expect(result.encountersPlayed).toBeGreaterThan(0);
      expect(result.encountersPlayed).toBeLessThanOrEqual(10);
      expect(result.encountersCleared).toBeLessThanOrEqual(10);
      expect(result.encountersCleared).toBeLessThanOrEqual(result.encountersPlayed);
    }
  });

  it("replays the same strategy, vocation, and seed identically", () => {
    const strategy = BALANCE_STRATEGIES.find(
      (candidate) => candidate.id === "random-baseline",
    );
    if (!strategy) throw new Error("The random baseline strategy is missing.");
    const first = runCampaign(0xabcdef01, "druid", strategy);
    const replay = runCampaign(0xabcdef01, "druid", strategy);

    expect(replay).toEqual(first);
  });

  it("records real shop activity for the random baseline", () => {
    const strategy = BALANCE_STRATEGIES.find(
      (candidate) => candidate.id === "random-baseline",
    );
    if (!strategy) throw new Error("The random baseline strategy is missing.");

    const result = runCampaign(1, "knight", strategy);

    expect(result.purchasesMade).toBeGreaterThan(0);
    expect(result.rerollsUsed).toBeGreaterThanOrEqual(0);
  });

  it("can replay a seed with route, shop, battle, and reward diagnostics", () => {
    const strategy = BALANCE_STRATEGIES.find(
      (candidate) => candidate.id === "random-baseline",
    );
    if (!strategy) throw new Error("The random baseline strategy is missing.");
    const trace: string[] = [];

    runCampaign(1, "knight", strategy, { trace });

    expect(trace.some((entry) => entry.startsWith("Route:"))).toBe(true);
    expect(trace.some((entry) => entry.startsWith("Buy:"))).toBe(true);
    expect(trace.some((entry) => entry.startsWith("Battle "))).toBe(true);
    expect(trace.some((entry) => entry.startsWith("Creature reward:"))).toBe(
      true,
    );
    expect(trace.some((entry) => entry.startsWith("Formation capacity:"))).toBe(
      true,
    );
    expect(trace.at(-1)).toMatch(/^END: (WIN|LOSE)/);
  });

  it("fills each formation up to its starting deployment limit", () => {
    const strategy = BALANCE_STRATEGIES.find(
      (candidate) => candidate.id === "random-baseline",
    );
    if (!strategy) throw new Error("The random baseline strategy is missing.");
    const formations: NonNullable<
      Parameters<typeof runCampaign>[3]
    >["formations"] = [];

    runCampaign(19, "knight", strategy, { formations });

    expect(formations.length).toBeGreaterThan(0);
    for (const formation of formations) {
      expect(formation.boardCapacity).toBe(BOARD_CAPACITY);
      const deployableCapacity = Math.min(
        formation.deploymentLimit,
        formation.boardCapacity,
      );
      expect(formation.deployedCount).toBe(
        Math.min(formation.eligibleUnitCount, deployableCapacity),
      );
      expect(new Set(formation.assignments.map(({ slot }) => slot)).size).toBe(
        formation.assignments.length,
      );
      expect(formation.unassignedUnitIds).toHaveLength(
        Math.max(0, formation.eligibleUnitCount - deployableCapacity),
      );
      expect(
        formation.assignments.every((assignment) =>
          ["kept", "moved", "deployed"].includes(assignment.decision),
        ),
      ).toBe(true);
    }
  });

  it("keeps healers out of the frontline while preferred rows are available", () => {
    const strategy = BALANCE_STRATEGIES.find(
      (candidate) => candidate.id === "random-baseline",
    );
    if (!strategy) throw new Error("The random baseline strategy is missing.");
    const formations: NonNullable<
      Parameters<typeof runCampaign>[3]
    >["formations"] = [];

    runCampaign(19, "druid", strategy, { formations });

    const frontlineIndex = BOARD_LAYOUT.rows.findIndex(
      (row) => row.id === "frontline",
    );
    const frontlineSlots = new Set(
      BOARD_SLOTS.filter(
        (slot) => Math.floor(slot / BOARD_LAYOUT.columns) === frontlineIndex,
      ),
    );
    expect(
      formations
        .flatMap((formation) => formation.assignments)
        .filter((assignment) => assignment.role === "healer")
        .some((assignment) => frontlineSlots.has(assignment.slot)),
    ).toBe(false);
  });

  it("creates the complete vocation, strategy, and seed cross product", () => {
    const strategies = BALANCE_STRATEGIES.filter((strategy) =>
      ["random-baseline", "synergy-builder"].includes(strategy.id),
    );
    const config = { firstSeed: 7, seedCount: 3, strategies };
    const first = runBalanceBatch(config);
    const replay = runBalanceBatch(config);

    expect(first).toHaveLength(4 * 2 * 3);
    expect(replay).toEqual(first);
    expect(new Set(first.map((result) => result.seed))).toEqual(
      new Set([7, 8, 9]),
    );
  });
});
