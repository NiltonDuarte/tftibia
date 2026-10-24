import { createContext } from 'react'
import type { GameState } from './stateSchema'

export type GameCommands = {
  chooseVocation: (vocationId: string) => void
  chooseRoute: (nodeId: string) => void
  buyCreature: (creatureId: string) => void
  rerollShop: () => void
  selectUnit: (unitId: string | null) => void
  placeUnit: (slot: number) => void
  benchSelected: () => void
  startBattle: () => void
  claimVictory: () => void
  retryBattle: () => void
  chooseCreatureReward: (creatureId: string) => void
  chooseUpgradeReward: (upgradeId: string) => void
  newRun: () => void
}

export type GameContextValue = { state: GameState; commands: GameCommands }

export const GameContext = createContext<GameContextValue | null>(null)
