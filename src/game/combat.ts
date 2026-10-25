import type { Creature, Effects, GameItem, Synergy, Upgrade, Vocation } from '../content/schemas'
import { BattleResultSchema, type BattleResult, type UnitInstance } from './stateSchema'
import { BOARD_LAYOUT } from './board'

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
  range: number
  armor: number
  damageReduction: number
  criticalMultiplier: number
  accuracyMultiplier: number
  lifeLeechFraction: number
  firstAttackBonus: number
  fighterAttackBonus: number
  healingFlat: number
  roundStartHeal: number
  attacksMade: number
  attackCooldownTicks: number
  targetId: string | null
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
  equipment: GameItem[] = [],
): BattleUnit {
  const effects = side === 'player' ? getCombinedEffects(creature, active, vocation, upgrades) : {}
  const healthPct = (effects.healthPct ?? 0) + (creature.role === 'tank' ? (effects.tankHealthPct ?? 0) : 0)
  const attackPct =
    (effects.attackPct ?? 0) + (effects.teamAttackPct ?? 0) +
    (creature.role === 'shooter' ? (effects.shooterAttackPct ?? 0) : 0) +
    (creature.role === 'mage' ? (effects.mageAttackPct ?? 0) : 0)
  const starMultiplier = star === 1 ? 1 : star === 2 ? 1.65 : 2.5
  const maxHealth = Math.round(creature.health * starMultiplier * power * (1 + healthPct))
  const weapon = equipment.find((item) => item.slot === 'weapon')?.tibiaStats
  const rawWeaponAttack = weapon
    ? weapon.averageAttack ?? ((weapon.attack ?? 0) + (weapon.elementalAttack ?? 0))
    : 0
  const attackSkills = new Set(['axe', 'club', 'sword', 'distance', 'fist'])
  const equipmentSkillBonus = equipment.reduce((total, item) =>
    total + Object.entries(item.tibiaStats.skillBonuses)
      .filter(([skill]) => attackSkills.has(skill))
      .reduce((sum, [, bonus]) => sum + bonus, 0) +
      (item.tibiaStats.magicLevel ?? 0) + Object.values(item.tibiaStats.elementMagicLevel).reduce((sum, bonus) => sum + bonus, 0), 0)
  const equipmentShielding = equipment.reduce((total, item) => total + (item.tibiaStats.skillBonuses.shielding ?? 0), 0)
  const equipmentArmor = equipment.reduce((total, item) =>
    total + (item.tibiaStats.armor ?? 0) + (item.tibiaStats.defense ?? 0) + (item.tibiaStats.defenseBonus ?? 0), 0) + equipmentShielding
  const protectionValues = equipment.flatMap((item) => Object.entries(item.tibiaStats.protectionPercent).map(([type, value]) => ({ type, value })))
  const physicalProtection = protectionValues.filter((entry) => entry.type === 'physical').reduce((sum, entry) => sum + entry.value, 0)
  const genericProtection = protectionValues.reduce((sum, entry) => sum + entry.value, 0) / Math.max(1, new Set(protectionValues.map((entry) => entry.type)).size)
  const equipmentProtection = (physicalProtection || genericProtection) / 100
  const expectedCriticalMultiplier = equipment.reduce((multiplier, item) => {
    const chance = (item.tibiaStats.criticalChancePercent ?? 0) / 100
    const extra = (item.tibiaStats.criticalExtraDamagePercent ?? 0) / 100
    return multiplier * (1 + chance * extra)
  }, 1)
  const accuracyMultiplier = equipment.reduce((multiplier, item) => multiplier * (1 + (item.tibiaStats.hitPercent ?? 0) / 100), 1)
  const expectedLifeLeech = equipment.reduce((fraction, item) =>
    fraction + (item.tibiaStats.lifeLeechChancePercent ?? 0) / 100 * (item.tibiaStats.lifeLeechAmountPercent ?? 0) / 100, 0)

  return {
    id,
    creature,
    side,
    x,
    y,
    star,
    maxHealth,
    health: maxHealth,
    attack: (Math.max(creature.attack, rawWeaponAttack) + equipmentSkillBonus) * starMultiplier * power * (1 + attackPct),
    range: Math.max(creature.range, ...equipment.map((item) => item.tibiaStats.range ?? 0)),
    armor: creature.armor + (effects.armorFlat ?? 0) + (effects.teamArmor ?? 0) + equipmentArmor,
    damageReduction: Math.min(0.65, (effects.teamDamageReductionPct ?? 0) + equipmentProtection),
    criticalMultiplier: expectedCriticalMultiplier,
    accuracyMultiplier,
    lifeLeechFraction: expectedLifeLeech,
    firstAttackBonus: (effects.firstAttackBonusPct ?? 0) +
      (creature.role === 'shooter' ? (effects.shooterFirstAttackBonusPct ?? 0) : 0),
    fighterAttackBonus: effects.fighterAttackPct ?? 0,
    healingFlat: effects.healingFlat ?? 0,
    roundStartHeal: (effects.roundStartHeal ?? 0) + (effects.teamRoundStartHeal ?? 0),
    attacksMade: 0,
    attackCooldownTicks: 2,
    targetId: null,
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

function nextStepToward(actor: BattleUnit, target: BattleUnit, units: BattleUnit[]): { x: number; y: number } | undefined {
  const occupied = new Set(units.filter((unit) => unit.health > 0 && unit.id !== actor.id)
    .map((unit) => `${unit.x}:${unit.y}`))
  const visited = new Set([`${actor.x}:${actor.y}`])
  const queue: { x: number; y: number; firstStep: { x: number; y: number } | null }[] = [
    { x: actor.x, y: actor.y, firstStep: null },
  ]
  const directions = [-1, 0, 1].flatMap((dy) => [-1, 0, 1]
    .filter((dx) => dx !== 0 || dy !== 0)
    .map((dx) => ({ dx, dy })))

  while (queue.length > 0) {
    const point = queue.shift()
    if (!point) break
    if (point.firstStep && Math.max(Math.abs(point.x - target.x), Math.abs(point.y - target.y)) <= actor.range) {
      return point.firstStep
    }
    const neighbors = directions.map(({ dx, dy }) => ({ x: point.x + dx, y: point.y + dy }))
      .filter(({ x, y }) => x >= 0 && x <= 6 && y >= 0 && y <= 6)
      .filter(({ x, y }) => !occupied.has(`${x}:${y}`) && !visited.has(`${x}:${y}`))
      .sort((a, b) => Math.max(Math.abs(a.x - target.x), Math.abs(a.y - target.y)) - Math.max(Math.abs(b.x - target.x), Math.abs(b.y - target.y)))
    for (const neighbor of neighbors) {
      visited.add(`${neighbor.x}:${neighbor.y}`)
      queue.push({
        ...neighbor,
        firstStep: point.firstStep ?? neighbor,
      })
    }
  }
  return undefined
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
  items: Record<string, GameItem>
  bossIds?: ReadonlySet<string>
  enemyPower?: number
}): BattleResult {
  const { roster, enemies, creatures, synergies: synergyDefinitions, vocation, upgrades, items, bossIds = new Set<string>(), enemyPower = 1 } = options
  const active = createPlayerSynergies(roster, creatures, synergyDefinitions)
  const playerUnits = roster.filter((unit) => unit.slot !== null).map((unit) => {
    const creature = creatures[unit.creatureId]
    const equipment = Object.values(unit.equippedItems).map((itemId) => items[itemId]).filter((item): item is GameItem => Boolean(item))
    return instantiateUnit(unit.instanceId, creature, 'player', unit.slot! % BOARD_LAYOUT.columns, 6 - Math.floor(unit.slot! / BOARD_LAYOUT.columns), active, vocation, upgrades, unit.star, 1, equipment)
  })
  const occupiedEnemySquares = new Set<string>()
  const enemyUnits = enemies.map((creature, index) => {
    const rows = creature.role === 'tank' || creature.role === 'fighter' ? [2, 1, 0] : [0, 1, 2]
    const candidates = rows.flatMap((y) => [1, 2, 3, 4, 5].map((x) => ({ x, y })))
    const point = candidates.find(({ x, y }) => !occupiedEnemySquares.has(`${x}:${y}`)) ?? { x: 1 + index % 5, y: Math.floor(index / 5) }
    occupiedEnemySquares.add(`${point.x}:${point.y}`)
    const power = enemyPower * (creature.role === 'tank' ? 1.08 : 1) * (bossIds.has(creature.id) ? 1.2 : 1)
    return instantiateUnit(`enemy-${index}-${creature.id}`, creature, 'enemy', point.x, point.y, [], undefined, [], 1, power)
  })
  const units = [...playerUnits, ...enemyUnits]
  const startingUnits = units.map((unit) => ({ id: unit.id, creatureId: unit.creature.id, side: unit.side, x: unit.x, y: unit.y, star: unit.star, health: unit.health, maxHealth: unit.maxHealth }))
  const events: BattleResult['events'] = []
  const analytics = new Map(units.map((unit) => [unit.id, {
    unitId: unit.id,
    side: unit.side,
    damageDone: 0,
    damageTaken: 0,
    damageReduced: 0,
    healingDone: 0,
    healingReceived: 0,
    defeats: 0,
  }]))
  const log: string[] = []
  const rounds = 60
  let roundsPlayed = 0
  const record = (event: BattleResult['events'][number]) => {
    events.push(event)
    log.push(`Round ${event.round}: ${event.text}`)
  }

  for (let round = 1; round <= rounds; round += 1) {
    roundsPlayed = round
    for (const unit of living(playerUnits)) {
      if (round % 2 === 0 || unit.roundStartHeal <= 0 || unit.health >= unit.maxHealth) continue
      const healed = Math.min(unit.roundStartHeal, unit.maxHealth - unit.health)
      unit.health = Math.min(unit.maxHealth, unit.health + unit.roundStartHeal)
      const stats = analytics.get(unit.id)!
      stats.healingDone += healed
      stats.healingReceived += healed
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
      actor.attackCooldownTicks = Math.min(2, actor.attackCooldownTicks + 1)
      const opponents = actor.side === 'player' ? living(enemyUnits) : living(playerUnits)
      if (opponents.length === 0) break

      if (actor.creature.role === 'healer' && actor.side === 'player') {
        const ally = living(playerUnits).filter((unit) => unit.health < unit.maxHealth)
          .sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]
        if (ally && actor.attackCooldownTicks >= 2) {
          const amount = actor.attack + actor.healingFlat
          const healed = Math.min(amount, ally.maxHealth - ally.health)
          ally.health = Math.min(ally.maxHealth, ally.health + amount)
          analytics.get(actor.id)!.healingDone += healed
          analytics.get(ally.id)!.healingReceived += healed
          record({ round, type: 'heal', actorId: actor.id, actorX: actor.x, actorY: actor.y, targetId: ally.id, targetX: ally.x, targetY: ally.y,
            targetHealth: ally.health, text: `${actor.creature.name} restores ${Math.round(amount)} health to ${ally.creature.name}.` })
          actor.attackCooldownTicks = 0
          continue
        }
        if (ally) continue
      }

      const target = opponents.find((opponent) => opponent.id === actor.targetId) ?? chooseTarget(actor, opponents)
      if (!target) continue
      actor.targetId = target.id
      if (distance(actor, target) > actor.range) {
        const step = nextStepToward(actor, target, units)
        if (step) {
          actor.x = step.x
          actor.y = step.y
          record({ round, type: 'move', actorId: actor.id, actorX: actor.x, actorY: actor.y, targetId: null, targetX: null, targetY: null,
            targetHealth: null, text: `${actor.creature.name} advances into range.` })
        }
        continue
      }

      // Each attack takes two shared combat ticks. Movement never resets this
      // timer; a ready attack is held until a target enters range.
      if (actor.attackCooldownTicks < 2) continue

      const bonus = actor.attacksMade === 0 ? actor.firstAttackBonus : 0
      const closeCombatBonus = actor.creature.role === 'fighter' && distance(actor, target) === 1 ? 0.35 + actor.fighterAttackBonus : 0
      const attackPower = actor.attack * (1 + bonus + closeCombatBonus)
      const damage = Math.max(1, Math.round((attackPower - target.armor) * (1 - target.damageReduction) * actor.criticalMultiplier * actor.accuracyMultiplier))
      const healthLost = Math.min(target.health, damage)
      analytics.get(actor.id)!.damageDone += healthLost
      analytics.get(target.id)!.damageTaken += healthLost
      analytics.get(target.id)!.damageReduced += Math.max(0, Math.round(attackPower) - damage)
      target.health = Math.max(0, target.health - damage)
      const leeched = Math.min(actor.maxHealth - actor.health, damage * actor.lifeLeechFraction)
      if (leeched > 0) {
        actor.health = Math.min(actor.maxHealth, actor.health + leeched)
        const actorStats = analytics.get(actor.id)!
        actorStats.healingDone += leeched
        actorStats.healingReceived += leeched
      }
      actor.attacksMade += 1
      actor.attackCooldownTicks = 0
      if (target.health === 0) analytics.get(actor.id)!.defeats += 1
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
    analytics: [...analytics.values()].map((stats) => Object.fromEntries(
      Object.entries(stats).map(([key, value]) => [key, typeof value === 'number' ? Math.round(value) : value]),
    )) as BattleResult['analytics'],
  })
}
