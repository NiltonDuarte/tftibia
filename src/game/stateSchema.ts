import { z } from 'zod'
import { BOARD_SLOTS, INITIAL_DEPLOYMENT_LIMIT } from './board'
import { EquipmentSlotSchema } from '../content/schemas'

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
  slot: z.number().int().refine((slot) => BOARD_SLOTS.includes(slot)).nullable(),
  star: z.number().int().min(1).max(3).default(1),
  equippedItems: z.partialRecord(EquipmentSlotSchema, z.string()).default({}),
})

const CombatUnitSchema = z.object({
  id: z.string(),
  creatureId: z.string(),
  side: z.enum(['player', 'enemy']),
  x: z.number().int().min(0).max(6),
  y: z.number().int().min(0).max(6),
  star: z.number().int().min(1).max(3).default(1),
  health: z.number().nonnegative(),
  maxHealth: z.number().positive(),
})

const CombatEventSchema = z.object({
  round: z.number().int().positive(),
  type: z.enum(['attack', 'heal', 'move', 'defeat']),
  actorId: z.string(),
  actorX: z.number().int().min(0).max(6),
  actorY: z.number().int().min(0).max(6),
  targetId: z.string().nullable(),
  targetX: z.number().int().min(0).max(6).nullable(),
  targetY: z.number().int().min(0).max(6).nullable(),
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
  analytics: z.array(z.object({
    unitId: z.string(),
    side: z.enum(['player', 'enemy']),
    damageDone: z.number().nonnegative().default(0),
    damageTaken: z.number().nonnegative().default(0),
    damageReduced: z.number().nonnegative().default(0),
    healingDone: z.number().nonnegative().default(0),
    healingReceived: z.number().nonnegative().default(0),
    defeats: z.number().int().nonnegative().default(0),
  })).default([]),
})

export const GameStateSchema = z.object({
  saveVersion: z.literal(8),
  seed: z.number().int().min(0).max(0xffffffff),
  rngState: z.number().int().min(0).max(0xffffffff),
  nextUnitId: z.number().int().nonnegative(),
  deploymentLimit: z.number().int().min(1).max(BOARD_SLOTS.length),
  phase: RunPhaseSchema,
  commanderId: z.enum(['knight', 'paladin', 'sorcerer', 'druid']).nullable(),
  mapNodeId: z.string(),
  routeEdges: z.record(z.string(), z.array(z.string())),
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
  experience: z.number().int().nonnegative().max(99),
  level: z.number().int().positive(),
  pendingLevelUps: z.number().int().nonnegative(),
  battleResult: BattleResultSchema.nullable(),
  backpackItemIds: z.array(z.string()),
  rewardItemIds: z.array(z.string()),
  selectedItemRewardId: z.string().nullable(),
})

export type GameState = z.infer<typeof GameStateSchema>
export type UnitInstance = z.infer<typeof UnitSchema>
export type BattleResult = z.infer<typeof BattleResultSchema>
export type RunPhase = z.infer<typeof RunPhaseSchema>
export type BattleSurvivor = BattleResult['survivors'][number]

export const initialGameState: GameState = {
  saveVersion: 8,
  seed: 1,
  rngState: 1,
  nextUnitId: 0,
  deploymentLimit: INITIAL_DEPLOYMENT_LIMIT,
  phase: 'vocation',
  commanderId: null,
  mapNodeId: 'crossroads',
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
}

export function migrateSavedGame(value: unknown): GameState | null {
  try {
    if (typeof value === 'object' && value !== null && 'saveVersion' in value && (value.saveVersion === 1 || value.saveVersion === 2 || value.saveVersion === 3 || value.saveVersion === 4 || value.saveVersion === 5 || value.saveVersion === 6 || value.saveVersion === 7)) {
      const legacy = value as Record<string, unknown>
      const oldVersion = legacy.saveVersion
      const roster = Array.isArray(legacy.roster) ? legacy.roster.map((unit) => {
        if (typeof unit !== 'object' || unit === null) return unit
        const migratedSlot = 'slot' in unit && typeof unit.slot === 'number'
          ? Math.floor(unit.slot / 3) * 7 + 2 + unit.slot % 3
          : 'slot' in unit ? unit.slot : undefined
        return { ...unit, ...(migratedSlot !== undefined ? { slot: migratedSlot } : {}), star: 'star' in unit ? unit.star : 1, equippedItems: 'equippedItems' in unit ? unit.equippedItems : {} }
      }) : legacy.roster
      const previousBattle = legacy.battleResult
      let battleResult = previousBattle
      if (typeof previousBattle === 'object' && previousBattle !== null && oldVersion === 1) {
        battleResult = { ...previousBattle, units: [], events: [] }
      } else if (typeof previousBattle === 'object' && previousBattle !== null && (oldVersion === 2 || oldVersion === 3)) {
        const asPoint = (side: 'player' | 'enemy', slot: number) => ({ x: 2 + slot % 3, y: side === 'player' ? 4 - Math.floor(slot / 3) : 2 - Math.floor(slot / 3) })
        const toRoomPoint = (x: number, y: number) => ({ x: Math.min(6, Math.max(0, x + 2)), y: Math.round(Math.min(6, Math.max(0, y + (oldVersion === 2 ? 1 : 0))) * 4 / 6) })
        const previous = previousBattle as Record<string, unknown>
        const units = Array.isArray(previous.units) ? previous.units.map((unit) => {
          if (typeof unit !== 'object' || unit === null) return unit
          if (oldVersion === 2 && 'slot' in unit && 'side' in unit) return { ...unit, ...asPoint(unit.side as 'player' | 'enemy', unit.slot as number), star: 'star' in unit ? unit.star : 1 }
          if (oldVersion === 3 && 'x' in unit && 'y' in unit) return { ...unit, ...toRoomPoint(unit.x as number, unit.y as number), star: 'star' in unit ? unit.star : 1 }
          return unit
        }) : []
        const events = Array.isArray(previous.events) ? previous.events.map((event) => {
          if (typeof event !== 'object' || event === null) return event
          if (oldVersion === 3 && 'actorX' in event && 'actorY' in event) {
            const actor = toRoomPoint(event.actorX as number, event.actorY as number)
            const target = event.targetX === null ? { x: null, y: null } : toRoomPoint(event.targetX as number, event.targetY as number)
            return { ...event, actorX: actor.x, actorY: actor.y, targetX: target.x, targetY: target.y }
          }
          if (!('actorSlot' in event)) return event
          const actorSide = typeof event.actorId === 'string' && event.actorId.startsWith('enemy-') ? 'enemy' : 'player'
          const targetSide = typeof event.targetId === 'string' && event.targetId.startsWith('enemy-') ? 'enemy' : 'player'
          const actorPoint = asPoint(actorSide, event.actorSlot as number)
          const targetPoint = event.targetSlot === null ? { x: null, y: null } : asPoint(targetSide, event.targetSlot as number)
          return { ...event, actorX: actorPoint.x, actorY: actorPoint.y, targetX: targetPoint.x, targetY: targetPoint.y }
        }) : []
        battleResult = { ...previous, units, events }
      } else if (typeof previousBattle === 'object' && previousBattle !== null && oldVersion === 4) {
        const previous = previousBattle as Record<string, unknown>
        const toFiveRows = (point: unknown) => {
          if (typeof point !== 'object' || point === null || !('y' in point) || typeof point.y !== 'number') return point
          return { ...point, y: Math.round(Math.min(6, Math.max(0, point.y)) * 4 / 6) }
        }
        const units = Array.isArray(previous.units) ? previous.units.map(toFiveRows) : []
        const events = Array.isArray(previous.events) ? previous.events.map((event) => {
          if (typeof event !== 'object' || event === null) return event
          const mapped = { ...event }
          if ('actorY' in mapped) mapped.actorY = Math.round(Math.min(6, Math.max(0, mapped.actorY as number)) * 4 / 6)
          if (typeof mapped.targetY === 'number') mapped.targetY = Math.round(Math.min(6, Math.max(0, mapped.targetY)) * 4 / 6)
          return mapped
        }) : []
        battleResult = { ...previous, units, events }
      }
      const migratedPhase = oldVersion === 1 && legacy.phase === 'battle' &&
        typeof previousBattle === 'object' && previousBattle !== null ? 'preparation' : legacy.phase
      const parsedLegacy = GameStateSchema.safeParse({ ...legacy, saveVersion: 8,
        seed: oldVersion === 6 || oldVersion === 7 ? legacy.seed : 1, rngState: oldVersion === 6 || oldVersion === 7 ? legacy.rngState : 1,
        nextUnitId: oldVersion === 6 || oldVersion === 7 ? legacy.nextUnitId ?? (Array.isArray(roster) ? roster.length : 0) : Array.isArray(roster) ? roster.length : 0,
        phase: migratedPhase, roster, lives: legacy.lives ?? 3,
        deploymentLimit: Math.max(INITIAL_DEPLOYMENT_LIMIT, Array.isArray(roster) ? roster.filter((unit) => typeof unit === 'object' && unit !== null && 'slot' in unit && unit.slot !== null).length : 0),
        experience: oldVersion === 3 || oldVersion === 4 || oldVersion === 5 || oldVersion === 6 || oldVersion === 7 ? legacy.experience ?? 0 : 0,
        level: oldVersion === 3 || oldVersion === 4 || oldVersion === 5 || oldVersion === 6 || oldVersion === 7 ? legacy.level ?? 1 : 1,
        pendingLevelUps: oldVersion === 3 || oldVersion === 4 || oldVersion === 5 || oldVersion === 6 || oldVersion === 7 ? legacy.pendingLevelUps ?? 0 : 0,
        battleResult, backpackItemIds: legacy.backpackItemIds ?? [], rewardItemIds: legacy.rewardItemIds ?? [], selectedItemRewardId: legacy.selectedItemRewardId ?? null,
        routeEdges: legacy.routeEdges ?? {} })
      return parsedLegacy.success ? parsedLegacy.data : null
    }
    const parsed = GameStateSchema.safeParse(value)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function parseSavedGame(value: unknown): GameState {
  return migrateSavedGame(value) ?? initialGameState
}

export function loadSavedGame(): GameState {
  try {
    const raw = window.localStorage.getItem('tibia-tactics-save')
    return raw ? parseSavedGame(JSON.parse(raw)) : initialGameState
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
