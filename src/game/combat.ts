import type { Creature, Effects, Synergy, Upgrade, Vocation } from '../content/schemas'
import { BattleResultSchema, type BattleResult, type UnitInstance } from './stateSchema'

type BattleUnit = {
  id: string
  creature: Creature
  side: 'player' | 'enemy'
  x: number
  y: number
  star: number
  health: number
  maxHealth: number
  attack: number
  armor: number
  damageReduction: number
  firstAttackBonus: number
  fighterAttackBonus: number
  healingFlat: number
  roundStartHeal: number
  attacksMade: number
}

export type ActiveSynergy = {
  id: string
  label: string
  category: Synergy['category']
  count: number
  tier: Synergy['breakpoints'][number]
  tiers: Synergy['breakpoints']
}

export function getActiveSynergies(board: Creature[], definitions: Synergy[]): ActiveSynergy[] {
  const active: ActiveSynergy[] = []
  for (const synergy of definitions) {
    const count = board.filter((creature) => {
      if (synergy.category === 'role') return creature.role === synergy.tag
      if (synergy.category === 'family') return creature.family === synergy.tag
      return creature.bestiaryClass === synergy.tag
    }).length
    const tiers = synergy.breakpoints.filter((breakpoint) => count >= breakpoint.count)
    const tier = tiers.at(-1)
    if (tier) active.push({ id: synergy.id, label: synergy.tag, category: synergy.category, count, tier, tiers })
  }
  return active
}

function getCombinedEffects(
  unit: Creature,
  active: ActiveSynergy[],
  vocation: Vocation | undefined,
  upgrades: Upgrade[],
): Effects {
  const effects: Effects = {}
  const applicableSources: (Effects | undefined)[] = [vocation?.effect, ...upgrades.map((upgrade) => upgrade.effects)]
  const teamKeys: (keyof Effects)[] = ['teamAttackPct', 'teamArmor', 'teamDamageReductionPct', 'teamRoundStartHeal']
  for (const synergy of active) {
    const relevant =
      (synergy.category === 'role' && unit.role === synergy.label) ||
      (synergy.category === 'family' && unit.family === synergy.label) ||
      (synergy.category === 'bestiary' && unit.bestiaryClass === synergy.label)
    for (const tier of synergy.tiers) {
      if (relevant) applicableSources.push(tier.effects)
      else {
        const teamEffects: Effects = {}
        for (const key of teamKeys) {
          const value = tier.effects[key]
          if (typeof value === 'number') teamEffects[key] = value
        }
        applicableSources.push(teamEffects)
      }
    }
  }

  for (const source of applicableSources) {
    if (!source) continue
    const keys: (keyof Effects)[] = [
      'attackPct', 'healthPct', 'armorFlat', 'teamAttackPct', 'teamArmor', 'teamDamageReductionPct',
      'firstAttackBonusPct', 'roundStartHeal', 'teamRoundStartHeal', 'healingFlat',
    ]
    if (unit.role === 'shooter') keys.push('shooterAttackPct', 'shooterFirstAttackBonusPct')
    if (unit.role === 'mage') keys.push('mageAttackPct')
    if (unit.role === 'fighter') keys.push('fighterAttackPct')
    if (unit.role === 'tank') keys.push('tankHealthPct')
    for (const key of keys) {
      const value = source[key]
      if (typeof value === 'number') effects[key] = (effects[key] ?? 0) + value
    }
  }
  return effects
}

function instantiateUnit(
  id: string,
  creature: Creature,
  side: BattleUnit['side'],
  x: number,
  y: number,
  active: ActiveSynergy[],
  vocation: Vocation | undefined,
  upgrades: Upgrade[],
  star = 1,
  power = 1,
): BattleUnit {
  const effects = side === 'player' ? getCombinedEffects(creature, active, vocation, upgrades) : {}
  const healthPct = (effects.healthPct ?? 0) + (creature.role === 'tank' ? (effects.tankHealthPct ?? 0) : 0)
  const attackPct =
    (effects.attackPct ?? 0) + (effects.teamAttackPct ?? 0) +
    (creature.role === 'shooter' ? (effects.shooterAttackPct ?? 0) : 0) +
    (creature.role === 'mage' ? (effects.mageAttackPct ?? 0) : 0)
  const starMultiplier = star === 1 ? 1 : star === 2 ? 1.65 : 2.5
  const maxHealth = Math.round(creature.health * starMultiplier * power * (1 + healthPct))

  return {
    id,
    creature,
    side,
    x,
    y,
    star,
    maxHealth,
    health: maxHealth,
    attack: creature.attack * starMultiplier * power * (1 + attackPct),
    armor: creature.armor + (effects.armorFlat ?? 0) + (effects.teamArmor ?? 0),
    damageReduction: Math.min(0.65, effects.teamDamageReductionPct ?? 0),
    firstAttackBonus: (effects.firstAttackBonusPct ?? 0) +
      (creature.role === 'shooter' ? (effects.shooterFirstAttackBonusPct ?? 0) : 0),
    fighterAttackBonus: effects.fighterAttackPct ?? 0,
    healingFlat: effects.healingFlat ?? 0,
    roundStartHeal: (effects.roundStartHeal ?? 0) + (effects.teamRoundStartHeal ?? 0),
    attacksMade: 0,
  }
}

function distance(a: BattleUnit, b: BattleUnit): number {
	// Tibia movement uses the eight neighboring sqms. Chebyshev distance measures
	// how many one-sqm steps separate two creatures when diagonal steps are allowed.
	return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function living(units: BattleUnit[]): BattleUnit[] {
  return units.filter((unit) => unit.health > 0)
}

function chooseTarget(actor: BattleUnit, candidates: BattleUnit[]): BattleUnit | undefined {
  return [...candidates].sort((a, b) => distance(actor, a) - distance(actor, b) || a.health - b.health)[0]
}

function createPlayerSynergies(roster: UnitInstance[], creatures: Record<string, Creature>, definitions: Synergy[]): ActiveSynergy[] {
  const board = roster.filter((unit) => unit.slot !== null).map((unit) => creatures[unit.creatureId])
    .filter((creature): creature is Creature => Boolean(creature))
  return getActiveSynergies(board, definitions)
}

export function simulateBattle(options: {
  roster: UnitInstance[]
  enemies: Creature[]
  creatures: Record<string, Creature>
  synergies: Synergy[]
  vocation?: Vocation
  upgrades: Upgrade[]
  enemyPower?: number
}): BattleResult {
  const { roster, enemies, creatures, synergies: synergyDefinitions, vocation, upgrades, enemyPower = 1 } = options
  const active = createPlayerSynergies(roster, creatures, synergyDefinitions)
  const playerUnits = roster.filter((unit) => unit.slot !== null).map((unit) => {
    const creature = creatures[unit.creatureId]
    return instantiateUnit(unit.instanceId, creature, 'player', 2 + unit.slot! % 3, 6 - Math.floor(unit.slot! / 3), active, vocation, upgrades, unit.star)
  })
  const occupiedEnemySquares = new Set<string>()
  const enemyUnits = enemies.map((creature, index) => {
    const rows = creature.role === 'tank' || creature.role === 'fighter' ? [2, 1, 0] : [0, 1, 2]
    const candidates = rows.flatMap((y) => [1, 2, 3, 4, 5].map((x) => ({ x, y })))
    const point = candidates.find(({ x, y }) => !occupiedEnemySquares.has(`${x}:${y}`)) ?? { x: 1 + index % 5, y: Math.floor(index / 5) }
    occupiedEnemySquares.add(`${point.x}:${point.y}`)
    const power = enemyPower * (creature.role === 'tank' ? 1.08 : 1)
    return instantiateUnit(`enemy-${index}-${creature.id}`, creature, 'enemy', point.x, point.y, [], undefined, [], 1, power)
  })
  const units = [...playerUnits, ...enemyUnits]
  const startingUnits = units.map((unit) => ({ id: unit.id, creatureId: unit.creature.id, side: unit.side, x: unit.x, y: unit.y, star: unit.star, health: unit.health, maxHealth: unit.maxHealth }))
  const events: BattleResult['events'] = []
  const log: string[] = []
  const rounds = 10
  let roundsPlayed = 0
  const record = (event: BattleResult['events'][number]) => {
    events.push(event)
    log.push(`Round ${event.round}: ${event.text}`)
  }

  for (let round = 1; round <= rounds; round += 1) {
    roundsPlayed = round
    for (const unit of living(playerUnits)) {
      if (unit.roundStartHeal <= 0 || unit.health >= unit.maxHealth) continue
      unit.health = Math.min(unit.maxHealth, unit.health + unit.roundStartHeal)
      record({ round, type: 'heal', actorId: unit.id, actorX: unit.x, actorY: unit.y, targetId: unit.id, targetX: unit.x, targetY: unit.y,
        targetHealth: unit.health, text: `${unit.creature.name} recovers ${Math.round(unit.roundStartHeal)} health.` })
    }

    const playerOrder = living(playerUnits)
    const enemyOrder = living(enemyUnits)
    const order: BattleUnit[] = []
    for (let turn = 0; turn < Math.max(playerOrder.length, enemyOrder.length); turn += 1) {
      if (playerOrder[turn]) order.push(playerOrder[turn]!)
      if (enemyOrder[turn]) order.push(enemyOrder[turn]!)
    }
    for (const actor of order) {
      if (actor.health <= 0) continue
      const opponents = actor.side === 'player' ? living(enemyUnits) : living(playerUnits)
      if (opponents.length === 0) break

      if (actor.creature.role === 'healer' && actor.side === 'player') {
        const ally = living(playerUnits).filter((unit) => unit.health < unit.maxHealth)
          .sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]
        if (ally) {
          const amount = actor.attack + actor.healingFlat
          ally.health = Math.min(ally.maxHealth, ally.health + amount)
          record({ round, type: 'heal', actorId: actor.id, actorX: actor.x, actorY: actor.y, targetId: ally.id, targetX: ally.x, targetY: ally.y,
            targetHealth: ally.health, text: `${actor.creature.name} restores ${Math.round(amount)} health to ${ally.creature.name}.` })
          continue
        }
      }

      const target = chooseTarget(actor, opponents)
      if (!target) continue
      if (distance(actor, target) > actor.creature.range) {
        const origin = { x: actor.x, y: actor.y }
        const occupied = new Set(units.filter((unit) => unit.health > 0 && unit.id !== actor.id).map((unit) => {
          return `${unit.x}:${unit.y}`
        }))
        const steps = [-1, 0, 1].flatMap((dy) => [-1, 0, 1]
          .filter((dx) => dx !== 0 || dy !== 0)
          .map((dx) => [origin.x + dx, origin.y + dy]))
          .filter(([x, y]) => x !== undefined && y !== undefined && x >= 0 && x <= 6 && y >= 0 && y <= 6)
          .filter(([x, y]) => !occupied.has(`${x}:${y}`))
          .sort((a, b) => {
            const distanceA = Math.max(Math.abs(a[0]! - target.x), Math.abs(a[1]! - target.y))
            const distanceB = Math.max(Math.abs(b[0]! - target.x), Math.abs(b[1]! - target.y))
            return distanceA - distanceB
          })
        const step = steps[0]
        if (step) {
          actor.x = step[0]!
          actor.y = step[1]!
          record({ round, type: 'move', actorId: actor.id, actorX: actor.x, actorY: actor.y, targetId: null, targetX: null, targetY: null,
            targetHealth: null, text: `${actor.creature.name} advances into range.` })
        }
        continue
      }

      const bonus = actor.attacksMade === 0 ? actor.firstAttackBonus : 0
      const closeCombatBonus = actor.creature.role === 'fighter' && distance(actor, target) === 1 ? 0.35 + actor.fighterAttackBonus : 0
      const damage = Math.max(1, Math.round((actor.attack * (1 + bonus + closeCombatBonus) - target.armor) * (1 - target.damageReduction)))
      target.health = Math.max(0, target.health - damage)
      actor.attacksMade += 1
      record({ round, type: target.health === 0 ? 'defeat' : 'attack', actorId: actor.id, actorX: actor.x, actorY: actor.y,
        targetId: target.id, targetX: target.x, targetY: target.y, targetHealth: target.health,
        text: `${actor.creature.name} hits ${target.creature.name} for ${damage}${target.health === 0 ? ' and defeats it' : ''}.` })
    }
    if (living(playerUnits).length === 0 || living(enemyUnits).length === 0) break
  }

  const playerTotal = living(playerUnits).reduce((total, unit) => total + unit.health / unit.maxHealth, 0)
  const enemyTotal = living(enemyUnits).reduce((total, unit) => total + unit.health / unit.maxHealth, 0)
  const won = living(playerUnits).length > 0 && (living(enemyUnits).length === 0 || playerTotal > enemyTotal)

  return BattleResultSchema.parse({
    won,
    rounds: roundsPlayed,
    log,
    units: startingUnits,
    events,
    survivors: playerUnits.filter((unit) => unit.health > 0)
      .map((unit) => ({ unitId: unit.id, health: Math.round(unit.health), maxHealth: unit.maxHealth })),
  })
}
