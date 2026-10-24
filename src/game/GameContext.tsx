import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { campaign, creatureById, creatures, nodeById, synergies, upgradeById, upgrades, vocationById } from '../content/content'
import type { Creature, Vocation } from '../content/schemas'
import { simulateBattle } from './combat'
import { GameContext, type GameCommands } from './gameContext'
import { initialGameState, loadSavedGame, saveGame, type BattleResult, type GameState } from './stateSchema'

type Action =
  | { type: 'choose-vocation'; vocationId: string }
  | { type: 'choose-route'; nodeId: string; shop: string[]; rngState: number }
  | { type: 'buy'; creatureId: string; instanceId: string }
  | { type: 'reroll'; shop: string[]; rngState: number }
  | { type: 'select-unit'; unitId: string | null }
  | { type: 'place-unit'; slot: number }
  | { type: 'bench-unit' }
  | { type: 'battle'; result: BattleResult; creatureRewards: string[]; upgradeRewards: string[]; rngState: number }
  | { type: 'retry' }
  | { type: 'claim-victory' }
  | { type: 'choose-creature-reward'; creatureId: string; instanceId: string }
  | { type: 'choose-upgrade-reward'; upgradeId: string }
  | { type: 'new-run'; seed: number }

function nextRandom(state: number): { value: number; state: number } {
  let next = state >>> 0
  if (next === 0) next = 0x6d2b79f5
  next ^= next << 13
  next ^= next >>> 17
  next ^= next << 5
  next >>>= 0
  return { value: next / 0x100000000, state: next }
}

function shuffle<T>(items: T[], initialState: number): { items: T[]; rngState: number } {
  const result = [...items]
  let rngState = initialState
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = nextRandom(rngState)
    rngState = random.state
    const swapIndex = Math.floor(random.value * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return { items: result, rngState }
}

function drawCreatureOffers(count: number, rngState: number): { offers: string[]; rngState: number } {
  const shuffled = shuffle(creatures, rngState)
  return { offers: shuffled.items.slice(0, count).map((creature) => creature.id), rngState: shuffled.rngState }
}

function drawUpgradeOffers(vocationId: string | null, rngState: number): { offers: string[]; rngState: number } {
  const shuffled = shuffle(upgrades.filter((upgrade) => upgrade.vocation === vocationId), rngState)
  return { offers: shuffled.items.slice(0, 3).map((upgrade) => upgrade.id), rngState: shuffled.rngState }
}

function createRunState(seed: number): GameState {
  const normalizedSeed = Math.trunc(seed) >>> 0
  return { ...initialGameState, seed: normalizedSeed, rngState: normalizedSeed || 0x6d2b79f5 }
}

function mergeCopies(roster: GameState['roster']): GameState['roster'] {
  let result = [...roster]
  let merged = true
  while (merged) {
    merged = false
    const creatureIds = [...new Set(result.map((unit) => unit.creatureId))]
    for (const creatureId of creatureIds) {
      for (const star of [1, 2]) {
        const copies = result.filter((unit) => unit.creatureId === creatureId && unit.star === star)
        if (copies.length < 3) continue
        const triple = copies.slice(0, 3)
        const leader = triple.find((unit) => unit.slot !== null) ?? triple[0]!
        const occupiedSlot = triple.find((unit) => unit.slot !== null)?.slot ?? null
        const removed = new Set(triple.map((unit) => unit.instanceId))
        result = result.filter((unit) => !removed.has(unit.instanceId))
        result.push({ ...leader, slot: occupiedSlot, star: star + 1 })
        merged = true
        break
      }
      if (merged) break
    }
  }
  return result
}

function firstEmptySlot(roster: GameState['roster']): number | null {
  const occupied = new Set(roster.flatMap((unit) => (unit.slot === null ? [] : [unit.slot])))
  for (let slot = 0; slot < 9; slot += 1) {
    if (!occupied.has(slot)) return slot
  }
  return null
}

function finishRewards(state: GameState): GameState {
  if (!state.selectedCreatureRewardId || state.pendingLevelUps > 0 || !state.encounterNodeId) return state
  const node = nodeById[state.encounterNodeId]
  const completedNodeIds = [...new Set([...state.completedNodeIds, node.id])]
  return {
    ...state,
    phase: node.nextNodeIds.length === 0 ? 'complete' : 'map',
    mapNodeId: node.id,
    encounterNodeId: null,
    selectedUnitId: null,
    shopCreatureIds: [],
    rewardCreatureIds: [],
    rewardUpgradeIds: [],
    selectedCreatureRewardId: null,
    selectedUpgradeRewardId: null,
    battleResult: null,
    completedNodeIds,
  }
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'choose-vocation': {
      const selected = vocationById[action.vocationId] as Vocation | undefined
      if (!selected) return state
      const roster = campaign.startingCreatures.map((creatureId, index) => ({
        instanceId: `unit-${index}`, creatureId, slot: [6, 1, 2][index] ?? firstEmptySlot([]), star: 1,
      }))
      return {
        ...state,
        phase: 'map',
        commanderId: selected.id,
        mapNodeId: campaign.startNodeId,
        gold: campaign.startingGold,
        lives: 3,
        roster,
        nextUnitId: roster.length,
      }
    }
    case 'choose-route': {
      if (state.phase !== 'map') return state
      const origin = nodeById[state.mapNodeId]
      if (!origin?.nextNodeIds.includes(action.nodeId)) return state
      return {
        ...state,
        phase: 'preparation',
        encounterNodeId: action.nodeId,
        shopCreatureIds: action.shop,
        rngState: action.rngState,
        selectedUnitId: null,
        battleResult: null,
      }
    }
    case 'buy': {
      if (state.phase !== 'preparation') return state
      const creature = creatureById[action.creatureId]
      if (!creature || state.gold < creature.cost) return state
      const duplicateAlreadyDeployed = state.roster.some((unit) => unit.creatureId === creature.id && unit.slot !== null)
      const deployedCount = state.roster.filter((unit) => unit.slot !== null).length
      const slot = !duplicateAlreadyDeployed && deployedCount < campaign.boardCapacity ? firstEmptySlot(state.roster) : null
      const roster = mergeCopies([...state.roster, { instanceId: action.instanceId, creatureId: creature.id, slot, star: 1 }])
      return {
        ...state,
        gold: state.gold - creature.cost,
        roster,
        nextUnitId: state.nextUnitId + 1,
        selectedUnitId: state.selectedUnitId && roster.some((unit) => unit.instanceId === state.selectedUnitId) ? state.selectedUnitId : null,
      }
    }
    case 'reroll':
      if (state.phase !== 'preparation' || state.gold < 1) return state
      return { ...state, gold: state.gold - 1, shopCreatureIds: action.shop, rngState: action.rngState }
    case 'select-unit':
      if (state.phase !== 'preparation') return state
      return { ...state, selectedUnitId: action.unitId }
    case 'place-unit': {
      if (state.phase !== 'preparation' || !state.selectedUnitId) return state
      const selected = state.roster.find((unit) => unit.instanceId === state.selectedUnitId)
      if (!selected) return state
      const duplicateOnBoard = state.roster.some((unit) => unit.instanceId !== selected.instanceId && unit.slot !== null && unit.creatureId === selected.creatureId)
      if (duplicateOnBoard) return state
      const occupant = state.roster.find((unit) => unit.slot === action.slot)
      if (occupant && occupant.instanceId !== state.selectedUnitId) {
        return { ...state, selectedUnitId: occupant.instanceId }
      }
      return {
        ...state,
        roster: state.roster.map((unit) =>
          unit.instanceId === state.selectedUnitId ? { ...unit, slot: action.slot } : unit,
        ),
      }
    }
    case 'bench-unit':
      if (state.phase !== 'preparation' || !state.selectedUnitId) return state
      return {
        ...state,
        roster: state.roster.map((unit) =>
          unit.instanceId === state.selectedUnitId ? { ...unit, slot: null } : unit,
        ),
        selectedUnitId: null,
      }
    case 'battle':
      if (state.phase !== 'preparation') return state
      return {
        ...state,
        phase: 'battle',
        lives: action.result.won ? state.lives : Math.max(0, state.lives - 1),
        gold: action.result.won ? state.gold : Math.max(0, state.gold - 2),
        battleResult: action.result,
        rewardCreatureIds: action.creatureRewards,
        rewardUpgradeIds: action.upgradeRewards,
        rngState: action.rngState,
      }
    case 'claim-victory':
      if (state.phase !== 'battle' || !state.battleResult?.won) return state
      if (!state.encounterNodeId) return state
      {
        const node = nodeById[state.encounterNodeId]
        const totalExperience = state.experience + 25 + node.rewardExperience
        const levelsGained = Math.floor(totalExperience / 100)
        return {
          ...state,
          phase: 'reward',
          gold: state.gold + 3 + node.rewardGold,
          experience: totalExperience % 100,
          level: state.level + levelsGained,
          pendingLevelUps: levelsGained,
        }
      }
    case 'retry':
      if (state.phase !== 'battle' || state.battleResult?.won || state.lives <= 0) return state
      return { ...state, phase: 'preparation', battleResult: null }
    case 'choose-creature-reward': {
      if (state.phase !== 'reward' || state.selectedCreatureRewardId || !state.rewardCreatureIds.includes(action.creatureId)) return state
      const creature = creatureById[action.creatureId]
      if (!creature) return state
      const alreadyDeployed = state.roster.some((unit) => unit.creatureId === creature.id && unit.slot !== null)
      const deployed = state.roster.filter((unit) => unit.slot !== null).length
      const roster = mergeCopies([...state.roster, { instanceId: action.instanceId, creatureId: creature.id,
        slot: !alreadyDeployed && deployed < campaign.boardCapacity ? firstEmptySlot(state.roster) : null, star: 1 }])
      const selectedUnitId = state.selectedUnitId && roster.some((unit) => unit.instanceId === state.selectedUnitId) ? state.selectedUnitId : null
      return finishRewards({ ...state, roster, nextUnitId: state.nextUnitId + 1, selectedUnitId, selectedCreatureRewardId: action.creatureId })
    }
    case 'choose-upgrade-reward': {
      if (state.phase !== 'reward' || state.pendingLevelUps <= 0 || !state.rewardUpgradeIds.includes(action.upgradeId)) return state
      return finishRewards({
        ...state,
        upgradeIds: [...state.upgradeIds, action.upgradeId],
        selectedUpgradeRewardId: action.upgradeId,
        pendingLevelUps: state.pendingLevelUps - 1,
      })
    }
    case 'new-run':
      return createRunState(action.seed)
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadSavedGame)

  useEffect(() => {
    saveGame(state)
  }, [state])

  const commands = useMemo<GameCommands>(
    () => ({
      chooseVocation: (vocationId) => dispatch({ type: 'choose-vocation', vocationId }),
      chooseRoute: (nodeId) => {
        const node = nodeById[nodeId]
        if (!node) return
        const draw = drawCreatureOffers(campaign.shopSize + node.shopBonus, state.rngState)
        dispatch({ type: 'choose-route', nodeId, shop: draw.offers, rngState: draw.rngState })
      },
      buyCreature: (creatureId) => dispatch({ type: 'buy', creatureId, instanceId: `unit-${state.nextUnitId}` }),
      rerollShop: () => {
        const draw = drawCreatureOffers(campaign.shopSize, state.rngState)
        dispatch({ type: 'reroll', shop: draw.offers, rngState: draw.rngState })
      },
      selectUnit: (unitId) => dispatch({ type: 'select-unit', unitId }),
      placeUnit: (slot) => dispatch({ type: 'place-unit', slot }),
      benchSelected: () => dispatch({ type: 'bench-unit' }),
      startBattle: () => {
        if (state.phase !== 'preparation' || !state.encounterNodeId) return
        const node = nodeById[state.encounterNodeId]
        const enemies = node.enemies.map((id) => creatureById[id]).filter((creature): creature is Creature => Boolean(creature))
        const vocation = state.commanderId ? vocationById[state.commanderId] : undefined
        const selectedUpgrades = state.upgradeIds.map((id) => upgradeById[id]).filter((upgrade) => Boolean(upgrade))
        const result = simulateBattle({
          roster: state.roster,
          enemies,
          creatures: creatureById,
          synergies,
          vocation,
          upgrades: selectedUpgrades,
          enemyPower: 1 + Math.max(0, node.stage - 1) * 0.12,
        })
        let rngState = state.rngState
        const creatureRewards = result.won ? drawCreatureOffers(node.creatureOfferCount, rngState) : { offers: [], rngState }
        rngState = creatureRewards.rngState
        const upgradeRewards = result.won ? drawUpgradeOffers(state.commanderId, rngState) : { offers: [], rngState }
        rngState = upgradeRewards.rngState
        dispatch({
          type: 'battle',
          result,
          creatureRewards: creatureRewards.offers,
          upgradeRewards: upgradeRewards.offers,
          rngState,
        })
      },
      claimVictory: () => dispatch({ type: 'claim-victory' }),
      retryBattle: () => dispatch({ type: 'retry' }),
      chooseCreatureReward: (creatureId) => dispatch({ type: 'choose-creature-reward', creatureId, instanceId: `unit-${state.nextUnitId}` }),
      chooseUpgradeReward: (upgradeId) => dispatch({ type: 'choose-upgrade-reward', upgradeId }),
      newRun: (seed = (state.seed + 0x9e3779b9) >>> 0) => dispatch({ type: 'new-run', seed }),
    }),
    [state, dispatch],
  )

  return <GameContext.Provider value={{ state, commands }}>{children}</GameContext.Provider>
}
