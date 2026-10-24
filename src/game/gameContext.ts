import { createContext } from 'react'
import type { GameReplay } from './replay'
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
  newRun: (seed?: number) => void
  playReplay: (replay: GameReplay) => void
  pauseReplay: () => void
  resumeReplay: () => void
  stopReplay: () => void
  setReplayDelay: (delayMs: number) => void
  finishReplayBattle: () => void
}

export type ReplayPlayback = {
  replay: GameReplay
  actionIndex: number
  actionDelayMs: number
  playing: boolean
  waitingForBattle: boolean
}

export type GameContextValue = {
  state: GameState
  commands: GameCommands
  replayData: GameReplay
  playback: ReplayPlayback | null
}

export const GameContext = createContext<GameContextValue | null>(null)
