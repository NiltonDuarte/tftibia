import { z } from 'zod'

export const RunPhaseSchema = z.enum([
  'vocation',
  'map',
  'preparation',
  'battle',
  'reward',
  'complete',
  'defeat',
])

const UnitSchema = z.object({
  instanceId: z.string().min(1),
  creatureId: z.string().min(1),
  slot: z.number().int().min(0).max(8).nullable(),
  star: z.number().int().min(1).max(3).default(1),
})

const CombatUnitSchema = z.object({
  id: z.string(),
  creatureId: z.string(),
  side: z.enum(['player', 'enemy']),
  slot: z.number().int().min(0).max(8),
  star: z.number().int().min(1).max(3).default(1),
  health: z.number().nonnegative(),
  maxHealth: z.number().positive(),
})

const CombatEventSchema = z.object({
  round: z.number().int().positive(),
  type: z.enum(['attack', 'heal', 'move', 'defeat']),
  actorId: z.string(),
  actorSlot: z.number().int().min(0).max(8),
  targetId: z.string().nullable(),
  targetSlot: z.number().int().min(0).max(8).nullable(),
  targetHealth: z.number().nonnegative().nullable(),
  text: z.string(),
})

export const BattleResultSchema = z.object({
  won: z.boolean(),
  rounds: z.number().int().positive(),
  log: z.array(z.string()),
  units: z.array(CombatUnitSchema),
  events: z.array(CombatEventSchema),
  survivors: z.array(
    z.object({
      unitId: z.string(),
      health: z.number().nonnegative(),
      maxHealth: z.number().positive(),
    }),
  ),
})

export const GameStateSchema = z.object({
  saveVersion: z.literal(2),
  phase: RunPhaseSchema,
  commanderId: z.enum(['knight', 'paladin', 'sorcerer', 'druid']).nullable(),
  mapNodeId: z.string(),
  encounterNodeId: z.string().nullable(),
  gold: z.number().int().nonnegative(),
  roster: z.array(UnitSchema),
  shopCreatureIds: z.array(z.string()),
  selectedUnitId: z.string().nullable(),
  upgradeIds: z.array(z.string()),
  rewardCreatureIds: z.array(z.string()),
  rewardUpgradeIds: z.array(z.string()),
  selectedCreatureRewardId: z.string().nullable(),
  selectedUpgradeRewardId: z.string().nullable(),
  completedNodeIds: z.array(z.string()),
  lives: z.number().int().nonnegative(),
  battleResult: BattleResultSchema.nullable(),
})

export type GameState = z.infer<typeof GameStateSchema>
export type UnitInstance = z.infer<typeof UnitSchema>
export type BattleResult = z.infer<typeof BattleResultSchema>
export type RunPhase = z.infer<typeof RunPhaseSchema>
export type BattleSurvivor = BattleResult['survivors'][number]

export const initialGameState: GameState = {
  saveVersion: 2,
  phase: 'vocation',
  commanderId: null,
  mapNodeId: 'crossroads',
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
  battleResult: null,
}

export function loadSavedGame(): GameState {
  try {
    const raw = window.localStorage.getItem('tibia-tactics-save')
    if (!raw) return initialGameState
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && 'saveVersion' in value && value.saveVersion === 1) {
      const legacy = value as Record<string, unknown>
      const roster = Array.isArray(legacy.roster)
        ? legacy.roster.map((unit) => (typeof unit === 'object' && unit !== null ? { ...unit, star: 1 } : unit))
        : legacy.roster
      const previousBattle = legacy.battleResult
      const battleResult = typeof previousBattle === 'object' && previousBattle !== null
        ? { ...previousBattle, units: [], events: [] }
        : previousBattle
      const parsedLegacy = GameStateSchema.safeParse({ ...legacy, saveVersion: 2, roster, lives: 3, battleResult })
      return parsedLegacy.success ? parsedLegacy.data : initialGameState
    }
    const parsed = GameStateSchema.safeParse(value)
    return parsed.success ? parsed.data : initialGameState
  } catch {
    return initialGameState
  }
}

export function saveGame(state: GameState): void {
  try {
    if (state.phase === 'vocation') {
      window.localStorage.removeItem('tibia-tactics-save')
      return
    }
    window.localStorage.setItem('tibia-tactics-save', JSON.stringify(state))
  } catch {
    // A blocked or full browser storage area should not prevent a run from continuing.
  }
}

