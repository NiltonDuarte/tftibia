import { z } from "zod";
import type { GameAction } from "./engine";
import { GameStateSchema, type GameState } from "./stateSchema";

const ReplayActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choose-vocation"), vocationId: z.string() }),
  z.object({ type: z.literal("choose-route"), nodeId: z.string() }),
  z.object({ type: z.literal("buy"), creatureId: z.string() }),
  z.object({ type: z.literal("reroll") }),
  z.object({ type: z.literal("select-unit"), unitId: z.string().nullable() }),
  z.object({ type: z.literal("place-unit"), slot: z.number().int() }),
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
  return GameReplaySchema.parse(value);
}

export function loadPlayerReplay(baseState: GameState): GameReplay {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createPlayerReplay(baseState);
    const parsed = GameReplaySchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.source === "player"
      ? parsed.data
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

