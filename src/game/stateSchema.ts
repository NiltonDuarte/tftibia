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
  x: z.number().int().min(0).max(6),
  y: z.number().int().min(0).max(4),
  star: z.number().int().min(1).max(3).default(1),
  health: z.number().nonnegative(),
  maxHealth: z.number().positive(),
})

const CombatEventSchema = z.object({
  round: z.number().int().positive(),
  type: z.enum(['attack', 'heal', 'move', 'defeat']),
  actorId: z.string(),
  actorX: z.number().int().min(0).max(6),
  actorY: z.number().int().min(0).max(4),
  targetId: z.string().nullable(),
  targetX: z.number().int().min(0).max(6).nullable(),
  targetY: z.number().int().min(0).max(4).nullable(),
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
  saveVersion: z.literal(6),
  seed: z.number().int().min(0).max(0xffffffff),
  rngState: z.number().int().min(0).max(0xffffffff),
  nextUnitId: z.number().int().nonnegative(),
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
  experience: z.number().int().nonnegative().max(99),
  level: z.number().int().positive(),
  pendingLevelUps: z.number().int().nonnegative(),
  battleResult: BattleResultSchema.nullable(),
})

export type GameState = z.infer<typeof GameStateSchema>
export type UnitInstance = z.infer<typeof UnitSchema>
export type BattleResult = z.infer<typeof BattleResultSchema>
export type RunPhase = z.infer<typeof RunPhaseSchema>
export type BattleSurvivor = BattleResult['survivors'][number]

export const initialGameState: GameState = {
  saveVersion: 6,
  seed: 1,
  rngState: 1,
  nextUnitId: 0,
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
  experience: 0,
  level: 1,
  pendingLevelUps: 0,
  battleResult: null,
}

export function loadSavedGame(): GameState {
  try {
    const raw = window.localStorage.getItem('tibia-tactics-save')
    if (!raw) return initialGameState
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && 'saveVersion' in value && (value.saveVersion === 1 || value.saveVersion === 2 || value.saveVersion === 3 || value.saveVersion === 4 || value.saveVersion === 5)) {
      const legacy = value as Record<string, unknown>
      const oldVersion = legacy.saveVersion
      const roster = Array.isArray(legacy.roster) ? legacy.roster.map((unit) => {
        if (typeof unit !== 'object' || unit === null) return unit
        return { ...unit, star: 'star' in unit ? unit.star : 1 }
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
      const parsedLegacy = GameStateSchema.safeParse({ ...legacy, saveVersion: 6, seed: 1, rngState: 1,
        nextUnitId: Array.isArray(roster) ? roster.length : 0, phase: migratedPhase, roster, lives: legacy.lives ?? 3,
        experience: oldVersion === 3 || oldVersion === 4 || oldVersion === 5 ? legacy.experience ?? 0 : 0,
        level: oldVersion === 3 || oldVersion === 4 || oldVersion === 5 ? legacy.level ?? 1 : 1,
        pendingLevelUps: oldVersion === 3 || oldVersion === 4 || oldVersion === 5 ? legacy.pendingLevelUps ?? 0 : 0,
        battleResult })
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
