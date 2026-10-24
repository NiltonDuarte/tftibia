import { useContext } from 'react'
import { GameContext, type GameContextValue } from './gameContext'

export function useGame(): GameContextValue {
  const value = useContext(GameContext)
  if (!value) throw new Error('useGame must be used within a GameProvider.')
  return value
}
