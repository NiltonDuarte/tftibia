import { z } from "zod";
import type { GameAction } from "./engine";
import { EquipmentSlotSchema } from "../content/schemas";
import { GameStateSchema, migrateSavedGame, type GameState } from "./stateSchema";

const ReplayActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choose-vocation"), vocationId: z.string() }),
  z.object({ type: z.literal("choose-route"), nodeId: z.string() }),
  z.object({ type: z.literal("buy"), creatureId: z.string() }),
  z.object({ type: z.literal("sell-unit"), unitId: z.string() }),
  z.object({ type: z.literal("reroll") }),
  z.object({ type: z.literal("buy-deployment-upgrade") }),
  z.object({ type: z.literal("equip-item"), unitId: z.string(), itemId: z.string() }),
  z.object({
    type: z.literal("unequip-item"),
    unitId: z.string(),
    slot: z.string().refine((slot) => EquipmentSlotSchema.safeParse(slot).success, {
      message: "Unknown equipment slot.",
    }),
  }),
  z.object({ type: z.literal("select-unit"), unitId: z.string().nullable() }),
  z.object({ type: z.literal("place-unit"), slot: z.number().int() }),
  z.object({ type: z.literal("move-unit"), unitId: z.string(), slot: z.number().int() }),
  z.object({ type: z.literal("bench-unit") }),
  z.object({ type: z.literal("start-battle") }),
  z.object({ type: z.literal("claim-victory") }),
  z.object({ type: z.literal("retry") }),
  z.object({
    type: z.literal("choose-creature-reward"),
    creatureId: z.string(),
  }),
  z.object({
    type: z.literal("choose-upgrade-reward"),
    upgradeId: z.string(),
  }),
  z.object({ type: z.literal("choose-item-reward"), itemId: z.string() }),
  z.object({ type: z.literal("new-run"), seed: z.number().int() }),
]);

export const GameReplaySchema = z.object({
  version: z.literal(1),
  source: z.enum(["player", "simulation"]),
  seed: z.number().int().min(0).max(0xffffffff),
  baseState: GameStateSchema,
  actions: z.array(ReplayActionSchema),
  vocationId: z.string().optional(),
  strategyId: z.string().optional(),
});

export type GameReplay = z.infer<typeof GameReplaySchema>;

const STORAGE_KEY = "tibia-tactics-replay-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrateLegacySlot(slot: number): number {
  return Math.floor(slot / 3) * 7 + 2 + slot % 3;
}

export function createPlayerReplay(baseState: GameState): GameReplay {
  return {
    version: 1,
    source: "player",
    seed: baseState.seed,
    baseState,
    actions: [],
  };
}

export function parseGameReplay(value: unknown): GameReplay {
  if (isRecord(value) && "baseState" in value) {
    const replay = value;
    const baseState = replay.baseState;
    if (isRecord(baseState) && typeof baseState.saveVersion === "number" && baseState.saveVersion < 8) {
      const actions = Array.isArray(replay.actions) ? replay.actions.map((action) => {
        if (!isRecord(action) || (action.type !== "place-unit" && action.type !== "move-unit") || typeof action.slot !== "number") return action;
        return { ...action, slot: migrateLegacySlot(action.slot) };
      }) : replay.actions;
      const migratedBaseState = migrateSavedGame(baseState);
      if (!migratedBaseState) {
        throw new Error("Replay contains an invalid legacy base state.");
      }
      return GameReplaySchema.parse({
        ...replay,
        actions,
        baseState: migratedBaseState,
      });
    }
  }
  return GameReplaySchema.parse(value);
}

export function loadPlayerReplay(baseState: GameState): GameReplay {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createPlayerReplay(baseState);
    const parsed = parseGameReplay(JSON.parse(raw));
    return parsed.source === "player"
      ? parsed
      : createPlayerReplay(baseState);
  } catch {
    return createPlayerReplay(baseState);
  }
}

export function savePlayerReplay(replay: GameReplay): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(replay));
  } catch {
    // Replay recording is best-effort if browser storage is blocked or full.
  }
}

export function addReplayAction(
  replay: GameReplay,
  action: GameAction,
  resetBaseState: GameState | null,
): GameReplay {
  if (resetBaseState) {
    return {
      version: 1,
      source: "player",
      seed: resetBaseState.seed,
      baseState: resetBaseState,
      actions: [],
    };
  }
  return { ...replay, actions: [...replay.actions, action] };
}

