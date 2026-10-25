import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GameContext, type GameCommands, type ReplayPlayback } from "./gameContext";
import { createGame, gameReducer, type GameAction } from "./engine";
import {
  addReplayAction,
  loadPlayerReplay,
  parseGameReplay,
  savePlayerReplay,
  type GameReplay,
} from "./replay";
import { loadSavedGame, saveGame, type GameState } from "./stateSchema";

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadSavedGame);
  const [replayData, setReplayData] = useState(() => loadPlayerReplay(state));
  const recordingRef = useRef(replayData);
  const [playback, setPlayback] = useState<ReplayPlayback | null>(null);
  const playbackRef = useRef<ReplayPlayback | null>(null);
  const [playbackState, setPlaybackState] = useState<GameState | null>(null);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  const sendAction = useCallback((action: GameAction) => {
    if (playbackRef.current) return;
    dispatch(action);
    const resetState =
      action.type === "new-run" ? createGame(action.seed) : null;
    const nextReplay = addReplayAction(
      recordingRef.current,
      action,
      resetState,
    );
    recordingRef.current = nextReplay;
    setReplayData(nextReplay);
    savePlayerReplay(nextReplay);
  }, []);

  const playReplay = useCallback((value: GameReplay) => {
    const replay = parseGameReplay(value);
    const nextPlayback: ReplayPlayback = {
      replay,
      actionIndex: 0,
      actionDelayMs: 300,
      playing: true,
      waitingForBattle:
        Boolean(replay.baseState.battleResult) &&
        (replay.baseState.phase === "battle" ||
          replay.baseState.phase === "defeat"),
    };
    playbackRef.current = nextPlayback;
    setPlaybackState(replay.baseState);
    setPlayback(nextPlayback);
  }, []);

  const pauseReplay = useCallback(() => {
    setPlayback((current) => {
      if (!current) return current;
      const next = { ...current, playing: false };
      playbackRef.current = next;
      return next;
    });
  }, []);

  const resumeReplay = useCallback(() => {
    setPlayback((current) => {
      if (!current) return current;
      const next = { ...current, playing: true };
      playbackRef.current = next;
      return next;
    });
  }, []);

  const stopReplay = useCallback(() => {
    playbackRef.current = null;
    setPlayback(null);
    setPlaybackState(null);
  }, []);

  const setReplayDelay = useCallback((delayMs: number) => {
    const bounded = Math.max(0, Math.min(5000, Math.trunc(delayMs)));
    setPlayback((current) => {
      if (!current) return current;
      const next = { ...current, actionDelayMs: bounded };
      playbackRef.current = next;
      return next;
    });
  }, []);

  const finishReplayBattle = useCallback(() => {
    setPlayback((current) => {
      if (!current) return current;
      const next = { ...current, waitingForBattle: false };
      playbackRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (
      !playback?.playing ||
      playback.waitingForBattle ||
      !playbackState
    )
      return;
    if (playback.actionIndex >= playback.replay.actions.length) {
      setPlayback((current) => {
        if (!current) return current;
        const next = { ...current, playing: false };
        playbackRef.current = next;
        return next;
      });
      return;
    }
    const action = playback.replay.actions[playback.actionIndex];
    if (!action) return;
    const timer = window.setTimeout(() => {
      const nextState = gameReducer(playbackState, action);
      const waitingForBattle =
        action.type === "start-battle" &&
        Boolean(nextState.battleResult) &&
        (nextState.phase === "battle" || nextState.phase === "defeat");
      setPlaybackState(nextState);
      setPlayback((current) => {
        if (!current) return current;
        const next = {
          ...current,
          actionIndex: current.actionIndex + 1,
          waitingForBattle,
        };
        playbackRef.current = next;
        return next;
      });
    }, playback.actionDelayMs);
    return () => window.clearTimeout(timer);
  }, [playback, playbackState]);

  const commands = useMemo<GameCommands>(
    () => ({
      chooseVocation: (vocationId) =>
        sendAction({ type: "choose-vocation", vocationId }),
      chooseRoute: (nodeId) => sendAction({ type: "choose-route", nodeId }),
      buyCreature: (creatureId) => sendAction({ type: "buy", creatureId }),
      sellCreature: (unitId) => sendAction({ type: "sell-unit", unitId }),
      rerollShop: () => sendAction({ type: "reroll" }),
      buyDeploymentUpgrade: () => sendAction({ type: "buy-deployment-upgrade" }),
      equipItem: (unitId, itemId) => sendAction({ type: "equip-item", unitId, itemId }),
      unequipItem: (unitId, slot) => sendAction({ type: "unequip-item", unitId, slot }),
      selectUnit: (unitId) => sendAction({ type: "select-unit", unitId }),
      placeUnit: (slot) => sendAction({ type: "place-unit", slot }),
      moveUnit: (unitId, slot) => sendAction({ type: "move-unit", unitId, slot }),
      benchSelected: () => sendAction({ type: "bench-unit" }),
      startBattle: () => sendAction({ type: "start-battle" }),
      claimVictory: () => sendAction({ type: "claim-victory" }),
      retryBattle: () => sendAction({ type: "retry" }),
      chooseCreatureReward: (creatureId) =>
        sendAction({ type: "choose-creature-reward", creatureId }),
      chooseUpgradeReward: (upgradeId) =>
        sendAction({ type: "choose-upgrade-reward", upgradeId }),
      chooseItemReward: (itemId) => sendAction({ type: "choose-item-reward", itemId }),
      newRun: (seed = (state.seed + 0x9e3779b9) >>> 0) =>
        sendAction({ type: "new-run", seed }),
      playReplay,
      pauseReplay,
      resumeReplay,
      stopReplay,
      setReplayDelay,
      finishReplayBattle,
    }),
    [
      sendAction,
      state.seed,
      playReplay,
      pauseReplay,
      resumeReplay,
      stopReplay,
      setReplayDelay,
      finishReplayBattle,
    ],
  );

  const visibleState = playbackState ?? state;

  return (
    <GameContext.Provider value={{ state: visibleState, commands, replayData, playback }}>
      {children}
    </GameContext.Provider>
  );
}
