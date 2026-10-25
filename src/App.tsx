import { bossById, campaign, creatureById, creatures, nodeById, synergies, upgrades, vocationById, vocations, itemById, items } from './content/content'
import { getActiveSynergies } from './game/combat'
import { GameProvider } from './game/GameContext'
import { useGame } from './game/useGame'
import type { Creature, GameItem, Role, Vocation } from './content/schemas'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import styles from './App.module.css'
import { parseGameReplay, type GameReplay } from './game/replay'
import { BOARD_CAPACITY, BOARD_LAYOUT, BOARD_SLOTS, DEPLOYMENT_LIMIT_ITEM_COST } from './game/board'
import type { BattleResult } from './game/stateSchema'

const BalanceLab = lazy(() => import('./BalanceLab').then((module) => ({ default: module.BalanceLab })))

const phaseLabels: Record<string, string> = {
  vocation: 'Choose vocation',
  map: 'Choose a route',
  preparation: 'Prepare your team',
  battle: 'Auto battle',
  reward: 'Claim rewards',
  complete: 'Campaign cleared',
  defeat: 'Retreat',
}

function imageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

function downloadReplay(replay: GameReplay): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `tibia-replay-${replay.seed}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function CreatureImage({ creature, className }: { creature: Creature; className?: string }) {
  return <img className={className ?? styles.creatureSprite} src={imageUrl(creature.image)} alt={creature.name} />
}

function ItemImage({ item, className }: { item: GameItem; className?: string }) {
  return item.image
    ? <img className={className ?? styles.itemSprite} src={imageUrl(item.image)} alt={item.name} />
    : <span className={`${styles.itemSprite} ${styles.itemSpriteFallback}`} aria-label={item.name}>✦</span>
}

function itemStatSummary(item: GameItem): string {
  const stats = item.tibiaStats
  const values: string[] = []
  const attack = (stats.attack ?? 0) + (stats.elementalAttack ?? 0)
  if (attack > 0) values.push(`Atk ${attack}${stats.element ? ` ${stats.element}` : ''}`)
  if (stats.averageAttack !== undefined) values.push(`Avg hit ${stats.averageAttack}${stats.element ? ` ${stats.element}` : ''}`)
  if (stats.armor !== undefined) values.push(`Arm ${stats.armor}`)
  const defense = (stats.defense ?? 0) + (stats.defenseBonus ?? 0)
  if (defense > 0) values.push(`Def ${defense}`)
  if (stats.range !== undefined) values.push(`Range ${stats.range}`)
  if (stats.weaponHands !== undefined) values.push(`${stats.weaponHands}-handed`)
  if (stats.hitPercent !== undefined) values.push(`Hit +${stats.hitPercent}%`)
  const protections = Object.entries(stats.protectionPercent).map(([type, value]) => `${type} +${value}%`)
  if (protections.length > 0) values.push(protections.join(', '))
  if (stats.criticalChancePercent !== undefined) values.push(`Crit ${stats.criticalChancePercent}%`)
  if (stats.criticalExtraDamagePercent !== undefined) values.push(`Crit damage +${stats.criticalExtraDamagePercent}%`)
  if (stats.lifeLeechAmountPercent !== undefined) values.push(`Life leech ${stats.lifeLeechAmountPercent}% at ${stats.lifeLeechChancePercent ?? 0}% chance`)
  if (stats.durationMinutes !== undefined) values.push(`${stats.durationMinutes} min duration`)
  return values.join(' · ') || 'No combat stats listed'
}

function GameIcon({ name }: { name: string }) {
  const icon = name.toLowerCase()
  const shape = icon.includes('shield') || icon.includes('armor') ? (
    <><path d="M16 3 26 7v8c0 6.5-4.3 11-10 14-5.7-3-10-7.5-10-14V7l10-4Z" /><path d="m11 16 3 3 7-7" /></>
  ) : icon.includes('bow') || icon.includes('target') || icon.includes('precision') ? (
    <><path d="M10 4c10 5 10 19 0 24" /><path d="M5 16h21m-7-7 7 7-7 7" /><circle cx="10" cy="16" r="2" /></>
  ) : icon.includes('flame') || icon.includes('spark') || icon.includes('arcane') || icon.includes('magic') ? (
    <><path d="M17 3c2 7-4 7-2 12 1-2 3-3 5-4 4 8 2 15-5 16-6 0-10-4-9-10 1-4 5-7 6-12 2 3 2 5 2 7 3-3 4-6 3-9Z" /><path d="M15 21h.01" /></>
  ) : icon.includes('leaf') || icon.includes('tree') || icon.includes('sprout') || icon.includes('nature') ? (
    <><path d="M26 5C14 5 6 9 6 18c0 5 4 8 8 8 9 0 12-9 12-21Z" /><path d="M5 28c4-7 9-11 16-15" /><path d="M11 20c0-3 0-5-2-7m7 2c3 0 5 1 7 3" /></>
  ) : icon.includes('wall') || icon.includes('bulwark') ? (
    <><path d="M4 6h10v8H4zm14 0h10v8H18zM4 18h10v8H4zm14 0h10v8H18z" /><path d="M14 10h4m-4 12h4" /></>
  ) : icon.includes('sword') || icon.includes('attack') || icon.includes('rally') ? (
    <><path d="m7 25 14-14m-3-5 7 7-5 1-3-3 1-5Z" /><path d="m5 21 6 6m-8 2 5-5" /><path d="m20 22 5 5" /></>
  ) : icon.includes('crystal') || icon.includes('gem') || icon.includes('diamond') ? (
    <><path d="m16 3 10 8-10 18L6 11l10-8Z" /><path d="M6 11h20M12 11l4 18 4-18M12 3l-2 8m10-8 2 8" /></>
  ) : icon.includes('lightning') || icon.includes('overload') ? (
    <path d="M18 2 7 17h8l-1 13 11-17h-8l1-11Z" />
  ) : (
    <><path d="M16 3 19 12l9 4-9 3-3 9-3-9-9-3 9-4 3-9Z" /><path d="m25 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" /></>
  )
  return <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shape}</svg>
}

function Shell({ children, onOpenCompendium, onOpenBalance, onOpenWiki }: { children: ReactNode; onOpenCompendium: () => void; onOpenBalance: () => void; onOpenWiki: () => void }) {
  const { state, commands, replayData, playback } = useGame()
  const replayInput = useRef<HTMLInputElement>(null)
  const [replayError, setReplayError] = useState<string | null>(null)
  const showBar = state.phase !== 'vocation'

  const importReplay = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      commands.playReplay(parseGameReplay(parsed))
      setReplayError(null)
    } catch (error) {
      setReplayError(error instanceof Error ? error.message : 'Invalid replay file.')
    }
    if (replayInput.current) replayInput.current.value = ''
  }

  return (
    <div className={styles.appShell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="#top" aria-label="Tibia Tactics home">
          <span className={styles.brandMark}>T</span>
          <span>
            <strong>Tibia Tactics</strong>
            <small>CREATURES OF THE FRONTIER</small>
          </span>
        </a>
        <div className={styles.headerStatus}>
          <button className={`${styles.newRunButton} ${styles.codexButton}`} type="button" onClick={onOpenCompendium}>Creature codex</button>
          <button className={`${styles.newRunButton} ${styles.codexButton} ${styles.wikiButton}`} type="button" onClick={onOpenWiki}>Game wiki</button>
          <button className={`${styles.newRunButton} ${styles.codexButton} ${styles.balanceButton}`} type="button" onClick={onOpenBalance}>Balance lab</button>
          {replayData.actions.length > 0 && (
            <button className={`${styles.newRunButton} ${styles.replayToolButton}`} type="button" onClick={() => downloadReplay(replayData)}>Export replay</button>
          )}
          <button className={`${styles.newRunButton} ${styles.replayToolButton}`} type="button" onClick={() => replayInput.current?.click()}>Import replay</button>
          <input
            ref={replayInput}
            className={styles.hiddenInput}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importReplay(event.currentTarget.files?.[0])}
          />
          {playback && (
            <div className={styles.replayPlaybackBar} aria-label="Replay playback controls">
              <span>{playback.replay.source === 'simulation' ? 'SIM' : 'REPLAY'} {Math.min(playback.actionIndex, playback.replay.actions.length)}/{playback.replay.actions.length}</span>
              <label title="Delay between game actions">
                <input
                  aria-label="Replay action delay"
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={playback.actionDelayMs}
                  onChange={(event) => commands.setReplayDelay(Number(event.target.value))}
                />
                <small>{playback.actionDelayMs} ms</small>
              </label>
              {playback.playing ? (
                <button className={`${styles.newRunButton} ${styles.replayToolButton}`} type="button" onClick={commands.pauseReplay}>Pause</button>
              ) : playback.actionIndex < playback.replay.actions.length ? (
                <button className={`${styles.newRunButton} ${styles.replayToolButton}`} type="button" onClick={commands.resumeReplay}>Resume</button>
              ) : <span>Finished</span>}
              <button className={`${styles.newRunButton} ${styles.replayToolButton}`} type="button" onClick={commands.stopReplay}>Stop</button>
            </div>
          )}
          {replayError && <span className={styles.replayError} role="alert" title={replayError}>Replay import failed: {replayError}</span>}
          {showBar && (
            <>
              <span className={styles.phasePill}>{phaseLabels[state.phase]}</span>
              <span className={styles.goldPill}>✦ {state.gold} gold</span>
              <button className={`${styles.newRunButton} ${styles.restartButton}`} type="button" aria-label="Start a new campaign" onClick={() => commands.newRun()}>
                <span>New campaign</span><b>↻</b>
              </button>
            </>
          )}
        </div>
      </header>
      {showBar && state.commanderId && (
        <div className={styles.commanderProgress}>
          <div className={styles.commanderIdentity}>
            <span className={styles.commanderIcon}><GameIcon name={vocationById[state.commanderId].icon} /></span>
            <strong>{vocationById[state.commanderId].name}</strong>
            <b>LV {state.level}</b>
          </div>
          <div className={styles.expTrack} aria-label={`${state.experience} of 100 experience to next level`}><i style={{ width: `${state.experience}%` }} /></div>
          <span className={styles.expReadout}>{state.pendingLevelUps > 0 ? 'LEVEL UP · CHOOSE A PERK' : `${state.experience} / 100 XP`}</span>
        </div>
      )}
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>A small strategy prototype inspired by the world of Tibia.</footer>
    </div>
  )
}

function VocationSelection() {
  const { commands } = useGame()
  return (
    <section className={styles.introScreen}>
      <div className={styles.introCopy}>
        <div className={styles.eyebrow}>The Shattered Paths</div>
        <h1>Campaign setup</h1>
        <p>
          Choose a vocation, follow the route map, and prepare your creature party for each encounter.
        </p>
        <div className={styles.introFacts}>
          <span><b>01</b> Vocation</span>
          <span><b>02</b> Route map</span>
          <span><b>03</b> Formation</span>
        </div>
      </div>
      <div className={styles.vocationPanel}>
        <div className={styles.panelHeading}>
          <div>
            <div className={styles.eyebrow}>Commander selection</div>
            <h2>Choose your vocation</h2>
          </div>
          <span className={styles.stepBadge}>01 / 03</span>
        </div>
        <div className={styles.vocationGrid}>
          {vocationByIdList().map((vocation) => (
            <button
              className={styles.vocationCard}
              key={vocation.id}
              type="button"
              onClick={() => commands.chooseVocation(vocation.id)}
            >
              <span className={styles.vocationIcon}><GameIcon name={vocation.icon} /></span>
              <span className={styles.vocationTitle}>{vocation.name}</span>
              <span className={styles.vocationSubtitle}>{vocation.title}</span>
              <span className={styles.vocationDesc}>{vocation.description}</span>
              <span className={styles.cardArrow}>Choose vocation <b>↗</b></span>
            </button>
          ))}
        </div>
        <p className={styles.panelFootnote}>Vocation effects trigger automatically during combat.</p>
      </div>
    </section>
  )
}

function vocationByIdList(): Vocation[] {
  return ['knight', 'paladin', 'sorcerer', 'druid'].map((id) => vocationById[id]).filter(Boolean)
}

function CampaignMap() {
  const { state, commands } = useGame()
  const [focusedRouteId, setFocusedRouteId] = useState<string | null>(null)
  const location = nodeById[state.mapNodeId] ?? nodeById[campaign.startNodeId]
  const hasSavedRouteGraph = Object.hasOwn(state.routeEdges, campaign.startNodeId)
  const outgoingFor = (node: typeof campaign.nodes[number]) => {
    const configured = state.routeEdges[node.id]
    const candidates = configured ?? (hasSavedRouteGraph ? [] : node.nextNodeIds)
    const valid = candidates.filter((id) => Boolean(nodeById[id]))
    return configured !== undefined && valid.length === 0
      ? node.nextNodeIds.filter((id) => Boolean(nodeById[id]))
      : valid
  }
  const reachableIds = new Set<string>([campaign.startNodeId])
  const pendingNodeIds = [campaign.startNodeId]
  while (pendingNodeIds.length > 0) {
    const currentId = pendingNodeIds.shift()
    const currentNode = currentId ? nodeById[currentId] : undefined
    if (!currentNode) continue
    for (const nextId of outgoingFor(currentNode)) {
      if (reachableIds.has(nextId)) continue
      reachableIds.add(nextId)
      pendingNodeIds.push(nextId)
    }
  }
  const routeNodes = campaign.nodes.filter((node) => reachableIds.has(node.id))
  const routeEdges = Object.fromEntries(routeNodes.map((node) => [node.id, outgoingFor(node)]))
  const destinations = (routeEdges[location.id] ?? []).flatMap((id) => {
    const node = nodeById[id]
    return node ? [node] : []
  })
  const encounterCount = state.completedNodeIds.length
  const mapPosition = (nodeId: string) => {
    const node = nodeById[nodeId]
    const stageNodes = routeNodes.filter((entry) => entry.stage === node.stage)
    const lane = stageNodes.findIndex((entry) => entry.id === nodeId)
    const y = stageNodes.length === 1 ? 188 : stageNodes.length === 2 ? [92, 284][lane] ?? 188 : [72, 188, 304][lane] ?? 188
    return { x: 105 + node.stage * 108, y }
  }
  const currentPoint = mapPosition(location.id)
  const routeHistory = [campaign.startNodeId, ...state.completedNodeIds.filter((id) => Boolean(nodeById[id]))]
  const takenEdges = new Set(routeHistory.slice(0, -1).map((from, index) => `${from}->${routeHistory[index + 1]}`))
  const routeConnections = routeNodes.flatMap((from) => (routeEdges[from.id] ?? []).flatMap((toId) => {
    const to = nodeById[toId]
    return to && to.stage === from.stage + 1 ? [{ from, to }] : []
  }))
  const focusedNodeIds = new Set<string>()
  const focusedEdgeIds = new Set<string>()
  if (focusedRouteId) {
    const focusedPending = [focusedRouteId]
    focusedNodeIds.add(focusedRouteId)
    if (destinations.some((node) => node.id === focusedRouteId)) focusedEdgeIds.add(`${location.id}->${focusedRouteId}`)
    while (focusedPending.length > 0) {
      const fromId = focusedPending.shift()
      if (!fromId) continue
      for (const toId of routeEdges[fromId] ?? []) {
        const edgeId = `${fromId}->${toId}`
        focusedEdgeIds.add(edgeId)
        if (focusedNodeIds.has(toId)) continue
        focusedNodeIds.add(toId)
        focusedPending.push(toId)
      }
    }
  }

  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div>
          <div className={styles.eyebrow}>Campaign · {campaign.title}</div>
          <h1>Choose your next route</h1>
          <p className={styles.lede}>Follow each road to its destination. Every marker shows what waits at that stop.</p>
        </div>
        <div className={styles.progressCard}>
          <span>CAMPAIGN PROGRESS</span>
          <strong>{encounterCount} <small>/ 10 encounters</small></strong>
          <div className={styles.progressTrack}><i style={{ width: `${Math.min(100, encounterCount * 10)}%` }} /></div>
        </div>
      </div>

      <div className={styles.mapCurrent}>
        <span className={styles.mapPin}>⌖</span>
        <div>
          <span className={styles.mapKicker}>CURRENT LOCATION</span>
          <strong>{location.name}</strong>
          <small>{location.region}</small>
        </div>
        <span className={styles.pathLine} />
        <span className={styles.routeCount}>{destinations.length} routes ahead</span>
      </div>

      <section className={styles.clientWindow} aria-label="Campaign route map">
        <header className={styles.clientWindowTitle}><span>Cyclopedia Map</span><small>STAGE-BY-STAGE · CAMPAIGN ROUTES</small></header>
        <div className={styles.routeMapViewport} aria-label="Campaign map showing reachable routes and destinations">
        <svg className={styles.routeMapSvg} viewBox="0 0 1260 390" role="group" aria-labelledby="route-map-title">
          <title id="route-map-title">Campaign map showing the routes reachable in this run, their destinations, and each encounter type</title>
          <defs>
            <pattern id="route-label-stone" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#42484a" />
              <path d="M0 2h3M5 1h3M2 6h4" stroke="#505658" strokeWidth="1" />
            </pattern>
          </defs>
          <image href="/assets/backgrounds/campaign-world-map.png" x="-126" y="-39" width="1512" height="468" preserveAspectRatio="xMidYMid slice" />
          <rect className={styles.routeMapTint} width="1260" height="390" />
          {routeConnections.map(({ from, to }) => {
            const start = mapPosition(from.id)
            const end = mapPosition(to.id)
            const available = from.id === location.id && destinations.some((node) => node.id === to.id)
            const taken = takenEdges.has(`${from.id}->${to.id}`)
            const focused = focusedEdgeIds.has(`${from.id}->${to.id}`)
            const dimmed = focusedRouteId !== null && !focused
            const middleX = (start.x + end.x) / 2
            const d = `M ${start.x + 15} ${start.y} C ${middleX} ${start.y}, ${middleX} ${end.y}, ${end.x - 15} ${end.y}`
            return <path
              key={`${from.id}->${to.id}`}
              className={dimmed ? styles.mapRouteDimmed : focused ? styles.mapRouteFocus : available ? styles.mapRouteAvailable : taken ? styles.mapRouteTaken : styles.mapRouteFuture}
              d={d}
              aria-label={`${from.name} to ${to.name}${available ? ', available now' : ''}`}
            />
          })}
          {routeNodes.map((node) => {
            if (node.id === location.id) return null
            const point = mapPosition(node.id)
            const available = destinations.some((entry) => entry.id === node.id)
            const completed = state.completedNodeIds.includes(node.id)
            const kind = node.bossId ? 'boss' : node.routeReward === 'gold' ? 'cache' : node.routeReward === 'experience' ? 'shrine' : 'hunt'
            const kindLabel = node.bossId ? 'BOSS BATTLE' : kind === 'cache' ? 'GOLD CACHE' : kind === 'shrine' ? 'XP SHRINE' : 'CREATURE HUNT'
            const icon = kind === 'boss' ? '★' : kind === 'cache' ? '◈' : kind === 'shrine' ? '✧' : '⚔'
            const focused = focusedNodeIds.has(node.id)
            const visit = () => { if (available) commands.chooseRoute(node.id) }
            return <g
              key={node.id}
              className={`${styles.mapNode} ${available ? styles.mapNodeAvailable : completed ? styles.mapNodeCompleted : styles.mapNodeFuture} ${focused ? styles.mapNodeFocused : ''}`}
              data-kind={kind}
              transform={`translate(${point.x} ${point.y})`}
              role={available ? 'button' : undefined}
              tabIndex={available ? 0 : undefined}
              aria-label={available ? `Travel to ${node.name}, ${kindLabel.toLowerCase()}, encounter ${node.stage}` : undefined}
              onClick={visit}
              onMouseEnter={() => { if (available) setFocusedRouteId(node.id) }}
              onMouseLeave={() => { if (available) setFocusedRouteId(null) }}
              onFocus={() => { if (available) setFocusedRouteId(node.id) }}
              onBlur={() => { if (available) setFocusedRouteId(null) }}
              onKeyDown={(event) => {
                if (available && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  visit()
                }
              }}
              style={{ cursor: available ? 'pointer' : 'default' }}
            >
              <title>{node.name} — encounter {node.stage} — {kindLabel}</title>
              {available && <circle className={styles.mapNodeHit} r="28" />}
              <text className={styles.mapNodeStage} textAnchor="middle" dominantBaseline="central" y="-25">{String(node.stage).padStart(2, '0')}</text>
              <circle className={styles.mapNodeRim} r={available ? 23 : 21} />
              <circle className={styles.mapNodeCore} r={available ? 19 : 17} />
              <text className={styles.mapNodeIcon} textAnchor="middle" dominantBaseline="central">{icon}</text>
              <g className={styles.mapNodeLabel} transform="translate(0 24)">
                <rect className={styles.mapNodeLabelRim} x="-55" y="-2" width="110" height="38" />
                <rect className={styles.mapNodeLabelPlate} x="-53" y="0" width="106" height="34" />
                <path className={styles.mapNodeLabelBevel} d="M-52 1H52M-52 33H52" />
                <rect className={styles.mapNodeTypeBand} x="-52" y="19" width="104" height="14" />
                <text className={styles.mapNodeName} textAnchor="middle" dominantBaseline="central" y="10">{node.name}</text>
                <text className={styles.mapNodeKind} textAnchor="middle" dominantBaseline="central" y="26">{kindLabel}</text>
              </g>
            </g>
          })}
          <g className={styles.mapCurrentMarker} transform={`translate(${currentPoint.x} ${currentPoint.y})`} aria-label={`Current location: ${location.name}`}>
            <circle r="12" />
            <path d="M-7 0h14M0-7v14" />
          </g>
          <g className={styles.mapCurrentLabel} transform={`translate(${currentPoint.x} ${currentPoint.y + 20})`}>
            <rect x="-53" y="0" width="106" height="25" />
            <text textAnchor="middle" dominantBaseline="middle" y="13">YOU · {location.name}</text>
          </g>
        </svg>
        </div>
        <div className={styles.routeMapLegend} aria-label="Map legend">
          <span><i className={styles.mapLegendCurrent} /> Your position</span>
          <span><i className={styles.mapLegendAvailable} /> Available road</span>
          <span><i className={styles.mapLegendFuture} /> Later road</span>
          <span>Hover or focus a destination to trace it onward</span>
          <span><b className={styles.mapLegendType} data-kind="cache">◈</b> Gold cache</span>
          <span><b className={styles.mapLegendType} data-kind="shrine">✧</b> XP shrine</span>
          <span><b className={styles.mapLegendType} data-kind="hunt">⚔</b> Creature hunt</span>
          <span><b className={styles.mapLegendType} data-kind="boss">★</b> Boss battle</span>
        </div>
      </section>

      <section className={styles.routeChoices} aria-label="Available routes">
      <header className={styles.clientWindowTitle}><span>Available Routes</span><small>{destinations.length} DESTINATIONS</small></header>
      <div className={styles.routeGrid}>
        {destinations.map((node, index) => {
          const enemyUnits = node.enemies.map((id) => creatureById[id]).filter(Boolean)
          const totalEnemies = enemyUnits.length + (node.bossId ? 1 : 0)
          return (
            <article
              className={styles.routeCard}
              key={node.id}
              data-theme={node.theme}
              onMouseEnter={() => setFocusedRouteId(node.id)}
              onMouseLeave={() => setFocusedRouteId(null)}
            >
              <div className={styles.routeImage} data-theme={node.theme}>
                <span className={styles.routeIndex}>0{index + 1}</span>
                <span className={styles.routeStage}>ENCOUNTER {node.stage} {node.bossId ? '· BOSS' : ''}</span>
                {node.bossSprite && <img className={styles.bossSprite} src={node.bossSprite} alt={`${node.name} boss`} />}
                <span className={styles.routeSigil}>{node.bossId ? '★' : node.routeReward === 'gold' ? '✦' : node.routeReward === 'experience' ? '✧' : '♜'}</span>
              </div>
              <div className={styles.routeBody}>
                <div className={styles.routeMeta}>{node.region}</div>
                <h2>{node.name}</h2>
                <p>{node.description}</p>
                <div className={`${styles.routeReward} ${styles[`routeReward_${node.routeReward}`]}`}>
                  {node.routeReward === 'gold' && <>✦ Cache · +{node.rewardGold} gold</>}
                  {node.routeReward === 'experience' && <>✧ Shrine · +{node.rewardExperience} XP</>}
                  {node.routeReward === 'recruit' && <>♜ Hunt · +{node.shopBonus} shop offers</>}
                </div>
                <div className={styles.enemyPreview}>
                  {node.bossId && <img
                    className={`${styles.enemyAvatar} ${styles.bossEnemyAvatar}`}
                    src={node.bossSprite ?? bossById[node.bossId]?.image}
                    alt={bossById[node.bossId]?.name ?? 'Boss'}
                    title={bossById[node.bossId]?.name ?? 'Boss'}
                  />}
                  {enemyUnits.map((creature, creatureIndex) => (
                    <CreatureImage className={styles.enemyAvatar} creature={creature} key={`${creature.id}-${creatureIndex}`} />
                  ))}
                  <span>{totalEnemies} creatures{node.bossId ? ' · boss + themed guards' : ''}</span>
                </div>
                <button className={styles.primaryButton} type="button" onClick={() => commands.chooseRoute(node.id)}>
                  Travel this route <b>→</b>
                </button>
              </div>
            </article>
          )
        })}
      </div>
      </section>

      <div className={styles.mapTip}><span>✧</span> Ten encounters. Bosses appear at milestones. Ferumbras guards the final node.</div>
    </section>
  )
}

function Preparation() {
  const { state, commands } = useGame()
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [draggedCreatureUnitId, setDraggedCreatureUnitId] = useState<string | null>(null)
  const node = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined
  const boardUnits = state.roster.filter((unit) => unit.slot !== null)
  const boardCreatures = boardUnits.map((unit) => creatureById[unit.creatureId]).filter(Boolean)
  const activeSynergies = getActiveSynergies(boardCreatures, synergies)
  const selected = state.roster.find((unit) => unit.instanceId === state.selectedUnitId)
  const selectedCreature = selected ? creatureById[selected.creatureId] : undefined
  const bench = state.roster.filter((unit) => unit.slot === null)
  const shopOfferIds = state.shopCreatureIds
  const draggedItem = draggedItemId ? itemById[draggedItemId] : undefined
  const draggedCreatureUnit = state.roster.find((unit) => unit.instanceId === draggedCreatureUnitId)
  const draggedCreature = draggedCreatureUnit ? creatureById[draggedCreatureUnit.creatureId] : undefined
  const canSellDraggedCreature = (event: DragEvent) =>
    event.dataTransfer.types.includes('application/x-tibia-unit') &&
    !event.dataTransfer.types.includes('application/x-tibia-item')
  const itemCanEquip = (item: GameItem, creature: Creature) => item.universal || item.allowedRoles.includes(creature.role)
  const handleItemDrop = (event: DragEvent, unitId: string, creature: Creature) => {
    event.preventDefault()
    const itemId = event.dataTransfer.getData('application/x-tibia-item')
    const item = itemById[itemId]
    if (!item || !itemCanEquip(item, creature)) return
    const sourceUnitId = event.dataTransfer.getData('application/x-tibia-unit')
    const sourceSlot = event.dataTransfer.getData('application/x-tibia-slot')
    if (sourceUnitId && sourceSlot) commands.unequipItem(sourceUnitId, sourceSlot)
    commands.equipItem(unitId, itemId)
    setDraggedItemId(null)
  }

  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div>
          <div className={styles.eyebrow}>Encounter {node?.stage} · {node?.region}</div>
          <h1>{node?.name}</h1>
          <p className={styles.lede}>{node?.description} Your creatures act automatically once battle begins.</p>
        </div>
        <div className={styles.prepHeaderStats}>
          <span><b>{boardUnits.length}</b> / {state.deploymentLimit} deployed</span>
          <span><b>{state.roster.length}</b> creatures recruited</span>
        </div>
      </div>

      <div className={styles.battleAction}>
        <div><strong>Formation ready?</strong><span>Frontliners intercept threats; range and lanes change who can strike.</span></div>
        <button className={styles.battleButton} type="button" disabled={boardUnits.length === 0} onClick={commands.startBattle}>
          Begin automatic battle <b>→</b>
        </button>
      </div>

      <div className={styles.prepLayout}>
        <div className={styles.boardColumn}>
          <div className={styles.panelTopline}>
            <div><span className={styles.eyebrow}>Formation</span><h2>Set the board</h2></div>
            <span className={styles.boardLegend}><i /> Your side</span>
          </div>
          <div className={`${styles.boardFrame} ${styles.sqmRoom}`} data-theme={node?.theme}>
            <div className={styles.boardRows}>
            {BOARD_LAYOUT.rows.map((row, rowIndex) => (
            <div key={row.id}>
            <div className={styles.rowLabel}>{row.label.toUpperCase()}</div>
            <div className={styles.boardGrid} style={{ gridTemplateColumns: `repeat(${BOARD_LAYOUT.columns}, minmax(0, 1fr))` }}>
              {BOARD_SLOTS.slice(
                rowIndex * BOARD_LAYOUT.columns,
                (rowIndex + 1) * BOARD_LAYOUT.columns,
              ).map((slot) => {
                const unit = state.roster.find((candidate) => candidate.slot === slot)
                const creature = unit ? creatureById[unit.creatureId] : undefined
                const isSelected = unit?.instanceId === state.selectedUnitId
                const duplicateIsDeployed = Boolean(selected && selected.slot === null && selected.creatureId === creature?.id)
                return (
                  <button
                    className={`${styles.boardSlot} ${unit ? styles.occupiedSlot : ''} ${isSelected ? styles.selectedSlot : ''}`}
                    disabled={!unit && Boolean(state.selectedUnitId && selected?.slot === null && boardUnits.length >= state.deploymentLimit)}
                    key={slot}
                    title={duplicateIsDeployed ? 'That creature is already deployed. Merge another copy or choose a different creature.' : undefined}
                    type="button"
                    draggable={Boolean(unit)}
                    onDragStart={(event) => {
                      if (!unit) return
                      event.dataTransfer.setData('text/plain', unit.instanceId)
                      event.dataTransfer.setData('application/x-tibia-unit', unit.instanceId)
                      event.dataTransfer.effectAllowed = 'move'
                      setDraggedCreatureUnitId(unit.instanceId)
                    }}
                    onDragEnd={() => setDraggedCreatureUnitId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const unitId = event.dataTransfer.getData('application/x-tibia-unit') || event.dataTransfer.getData('text/plain')
                      if (unitId) commands.moveUnit(unitId, slot)
                    }}
                    aria-label={creature ? `${creature.name}, board slot ${slot + 1}` : `Empty board slot ${slot + 1}`}
                    onClick={() => {
                      if (unit && (!state.selectedUnitId || state.selectedUnitId === unit.instanceId)) {
                        commands.selectUnit(isSelected ? null : unit.instanceId)
                      } else {
                        commands.placeUnit(slot)
                      }
                    }}
                  >
                    {creature ? (
                      <>
                        <CreatureImage creature={creature} className={styles.boardSprite} />
                        <span className={styles.boardCreatureName}>{creature.name}</span>
                        {unit && <span className={styles.starBadge} aria-label={`${unit.star} star${unit.star === 1 ? '' : 's'}`}>{'★'.repeat(unit.star)}</span>}
                        <span className={styles.boardTraits}>{creature.family}<br />{creature.bestiaryClass}</span>
                        <span className={styles.boardRoleIcon}><RoleIcon role={creature.role} /></span>
                      </>
                    ) : <span className={styles.slotPlus}>{state.selectedUnitId ? '+' : '·'}</span>}
                  </button>
                )
              })}
            </div>
            </div>
            ))}
            </div>
          </div>

          <div className={styles.benchPanel}>
            <div className={styles.panelTopline}>
              <div><span className={styles.eyebrow}>Reserve</span><h3>Bench <small>{bench.length}</small></h3></div>
              {selected && <button className={styles.textButton} type="button" onClick={commands.benchSelected}>Send to bench</button>}
            </div>
            {bench.length === 0 ? (
              <p className={styles.emptyBench}>Reserve slots are empty. Recruit more creatures from the shop.</p>
            ) : (
              <div className={styles.benchList}>
                {bench.map((unit) => {
                  const creature = creatureById[unit.creatureId]
                  return (
                    <button
                      className={`${styles.benchUnit} ${state.selectedUnitId === unit.instanceId ? styles.selectedBench : ''}`}
                      key={unit.instanceId}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', unit.instanceId)
                        event.dataTransfer.setData('application/x-tibia-unit', unit.instanceId)
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggedCreatureUnitId(unit.instanceId)
                      }}
                      onDragEnd={() => setDraggedCreatureUnitId(null)}
                      onClick={() => commands.selectUnit(state.selectedUnitId === unit.instanceId ? null : unit.instanceId)}
                    >
                      <CreatureImage creature={creature} className={styles.benchSprite} />
                      <span className={styles.benchDetails}>
                        <b>{creature.name}</b>
                        <span className={styles.benchStars} aria-label={`${unit.star} star${unit.star === 1 ? '' : 's'}`}>{'★'.repeat(unit.star)}</span>
                        <small><RoleIcon role={creature.role} /> · {creature.family} · {creature.bestiaryClass}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {selectedCreature && <p className={styles.selectionHint}>Selected: <b>{selectedCreature.name}</b>. Choose an empty board slot to deploy it.</p>}
            {selected && selected.slot === null && state.roster.filter((unit) => unit.creatureId === selected.creatureId).length > 1 && (
              <p className={styles.mergeHint}>Collect 3 matching copies at the same rank to merge them into a stronger creature.</p>
            )}
          </div>

          <SynergyPanel active={activeSynergies} boardCount={boardUnits.length} />
        </div>

        <aside className={styles.shopColumn}>
          <section className={styles.shopPanel}>
            <div className={styles.panelTopline}>
              <div><span className={styles.eyebrow}>Recruitment</span><h2>Wandering trader</h2></div>
              <span className={styles.shopSymbol}>✦</span>
            </div>
            <div
              className={`${styles.sellDropZone} ${draggedCreatureUnitId ? styles.sellDropActive : ''}`}
              onDragOver={(event) => {
                if (!canSellDraggedCreature(event)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                if (!canSellDraggedCreature(event)) return
                event.preventDefault()
                const unitId = event.dataTransfer.getData('application/x-tibia-unit')
                if (unitId) commands.sellCreature(unitId)
                setDraggedCreatureUnitId(null)
              }}
            >
              <strong>{draggedCreature ? `Sell ${draggedCreature.name}` : 'Sell a creature'}</strong>
              <span>{draggedCreature ? `Drop here for ${Math.ceil(draggedCreature.cost / 2)} gold` : 'Drag a board or bench creature here · half its shop price, rounded up'}</span>
            </div>
            <p className={styles.shopDesc}>Every creature can appear, including ones you already own. Copies merge when three share a star rank. The current phase's main enemy family appears less often.</p>
            <div className={styles.shopOffers}>
              {shopOfferIds.length === 0 && <p className={styles.emptyBench}>No current offers. Reroll the shop for a new selection.</p>}
              {shopOfferIds.map((id, index) => {
                const creature = creatureById[id]
                if (!creature) return null
                const ownedUnits = state.roster.filter((unit) => unit.creatureId === id)
                const highestStar = Math.max(0, ...ownedUnits.map((unit) => unit.star))
                const canBuy = state.gold >= creature.cost
                return (
                  <article className={styles.shopCard} key={`${id}-${index}`}>
                    <div className={styles.shopCardImage}><CreatureImage creature={creature} className={styles.shopSprite} /></div>
                    <div className={styles.shopCardInfo}>
                      <strong>{creature.name}</strong>
                      <span>{creature.family}{ownedUnits.length > 0 ? ` · ${ownedUnits.length} owned · ★${highestStar}` : ''}</span>
                      <div className={styles.tagRow}><Tag value={creature.bestiaryClass} /><RoleTag role={creature.role} /></div>
                    </div>
                    <button className={styles.buyButton} type="button" disabled={!canBuy} onClick={() => commands.buyCreature(id)}>
                      <span>{ownedUnits.length === 0 ? 'Recruit' : 'Buy copy'}</span><b>✦ {creature.cost}</b>
                    </button>
                  </article>
                )
              })}
            </div>
            <div className={styles.shopFooter}>
              <span>Reroll costs <b>1 gold</b></span>
              <button className={styles.secondaryButton} type="button" disabled={state.gold < 1} onClick={commands.rerollShop}>↻ Reroll</button>
            </div>
            <article className={styles.shopCard}>
              <div className={styles.shopCardImage}><span className={styles.shopSymbol}>＋</span></div>
              <div className={styles.shopCardInfo}>
                <strong>Formation Permit</strong>
                <span>Increase deployment limit by 1 · {state.deploymentLimit}/{BOARD_CAPACITY}</span>
              </div>
              <button className={styles.buyButton} type="button" disabled={state.gold < DEPLOYMENT_LIMIT_ITEM_COST || state.deploymentLimit >= BOARD_CAPACITY} onClick={commands.buyDeploymentUpgrade}>
                <span>{state.deploymentLimit >= BOARD_CAPACITY ? 'Maximum' : 'Recruit'}</span><b>✦ {DEPLOYMENT_LIMIT_ITEM_COST}</b>
              </button>
            </article>
          </section>

          {selectedCreature && (
            <section className={styles.detailPanel}>
              <CreatureImage creature={selectedCreature} className={styles.detailSprite} />
              <div>
                <span className={styles.eyebrow}>Selected creature</span>
                <h3>{selectedCreature.name}</h3>
                <p>{selectedCreature.description}</p>
                <span className={styles.statsLine}>♥ {selectedCreature.health} <b>⚔ {selectedCreature.attack}</b> <i>⬟ {selectedCreature.armor}</i></span>
              </div>
            </section>
          )}

          <section className={styles.inventoryPanel} aria-label="Player backpack and creature inventories">
            <div className={styles.inventoryHeading}>
              <div><span className={styles.eyebrow}>Player inventory · {state.backpackItemIds.length} items</span><h3>Loot backpack</h3></div>
              <span className={styles.inventoryHint}>Drag loot onto an eligible creature</span>
            </div>
            <div
              className={styles.backpackGrid}
              onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-tibia-unit')) event.preventDefault() }}
              onDrop={(event) => {
                event.preventDefault()
                const unitId = event.dataTransfer.getData('application/x-tibia-unit')
                const slot = event.dataTransfer.getData('application/x-tibia-slot')
                if (unitId && slot) commands.unequipItem(unitId, slot)
              }}
            >
              {state.backpackItemIds.length === 0 && <span className={styles.emptyBackpack}>No boss loot yet. Boss drops appear here automatically.</span>}
              {state.backpackItemIds.map((itemId, index) => {
                const item = itemById[itemId]
                if (!item) return null
                return <button
                  className={styles.inventoryItem}
                  key={itemId + '-' + index}
                  type="button"
                  draggable
                  title={item.name + ' · ' + itemStatSummary(item)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-tibia-item', item.id)
                    event.dataTransfer.effectAllowed = 'move'
                    setDraggedItemId(item.id)
                  }}
                  onDragEnd={() => setDraggedItemId(null)}
                >
                  <ItemImage item={item} className={styles.itemSprite} />
                  <span><b>{item.name}</b><small>{item.slot} · {item.universal ? 'all roles' : item.allowedRoles.join(', ')}</small></span>
                </button>
              })}
            </div>
            <div className={styles.inventoryRosterHeading}><span className={styles.eyebrow}>Creature inventories</span></div>
            <div className={styles.equipmentRoster}>
              {boardUnits.map((unit) => {
                const creature = creatureById[unit.creatureId]
                if (!creature) return null
                const canEquipDraggedItem = !draggedItem || itemCanEquip(draggedItem, creature)
                return <article
                  key={unit.instanceId}
                  className={styles.equipmentUnit + (draggedItem ? ' ' + (canEquipDraggedItem ? styles.equipmentEligible : styles.equipmentIneligible) : '')}
                  onDragOver={(event) => {
                    if (draggedItem && itemCanEquip(draggedItem, creature)) {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }
                  }}
                  onDrop={(event) => handleItemDrop(event, unit.instanceId, creature)}
                >
                  <div className={styles.inventoryCreature}>
                    <CreatureImage creature={creature} className={styles.inventoryCreatureSprite} />
                    <span><b>{creature.name}</b><small><RoleIcon role={creature.role} /> · {creature.family}</small></span>
                  </div>
                  <div className={styles.equipmentSlots}>
                    {Object.entries(unit.equippedItems).map(([slot, itemId]) => {
                      const item = itemById[itemId]
                      if (!item) return null
                      return <div className={styles.equipmentSlot} key={slot}>
                        <button
                          className={styles.equippedItem}
                          type="button"
                          draggable
                          aria-label={`Unequip ${item.name} from ${creature.name}`}
                          title={item.name + ' · ' + itemStatSummary(item)}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('application/x-tibia-item', item.id)
                            event.dataTransfer.setData('application/x-tibia-unit', unit.instanceId)
                            event.dataTransfer.setData('application/x-tibia-slot', slot)
                            event.dataTransfer.effectAllowed = 'move'
                            setDraggedItemId(item.id)
                          }}
                          onDragEnd={() => setDraggedItemId(null)}
                          onClick={() => commands.unequipItem(unit.instanceId, slot)}
                        >
                          <ItemImage item={item} className={styles.equippedItemSprite} />
                        </button>
                      </div>
                    })}
                  </div>
                </article>
              })}
            </div>
          </section>

        </aside>
      </div>
    </section>
  )
}

function SynergyPanel({ active, boardCount }: { active: ReturnType<typeof getActiveSynergies>; boardCount: number }) {
  return (
    <section className={styles.synergyPanel}>
      <div className={styles.panelTopline}>
        <div><span className={styles.eyebrow}>Team traits</span><h3>Active synergies</h3></div>
        <span className={styles.synergyCount}>{active.length} active</span>
      </div>
      {active.length === 0 ? (
        <p className={styles.emptyBench}>{boardCount < 2 ? 'Deploy more creatures to activate team traits.' : 'Recruit matching creatures to unlock a synergy.'}</p>
      ) : (
        <div className={styles.synergyList}>
          {active.map((synergy) => (
            <div className={styles.synergyRow} key={synergy.id}>
              <span className={`${styles.synergyIcon} ${styles[`synergy_${synergy.category}`]}`}>{synergy.category === 'family' ? '⌘' : synergy.category === 'bestiary' ? '◈' : '✧'}</span>
              <div className={styles.synergyText}>
                <strong>{synergy.label} <small>{synergy.count}</small></strong>
                <span>{synergy.tier.title}: {synergy.tier.description}</span>
              </div>
              <span className={styles.tierPill}>{synergy.category}</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.synergyNote}>Family traits activate sooner; broad Bestiary traits need a larger team.</div>
    </section>
  )
}

function BattlePlayback({ onFinished }: { onFinished: () => void }) {
  const { state, playback, commands } = useGame()
  const result = state.battleResult
  const [tickIndex, setTickIndex] = useState(-1)
  const [paused, setPaused] = useState(false)
  const [tickDuration, setTickDuration] = useState(320)
  const [showPlayableGrid, setShowPlayableGrid] = useState(false)
  const ticks = result ? Array.from({ length: result.rounds }, (_, index) => index + 1) : []
  const finished = ticks.length === 0 || tickIndex >= ticks.length - 1

  useEffect(() => {
    if (!result || paused || finished || (playback && !playback.playing)) return
    const timer = window.setTimeout(() => setTickIndex((index) => Math.min(ticks.length - 1, index + 1)), playback?.actionDelayMs ?? tickDuration)
    return () => window.clearTimeout(timer)
  }, [tickIndex, ticks.length, tickDuration, finished, paused, playback, result])

  useEffect(() => {
    if (!finished) return
    onFinished()
    if (playback?.waitingForBattle) commands.finishReplayBattle()
  }, [commands, finished, onFinished, playback?.waitingForBattle])

  if (!result) return null

  const currentTick = ticks[tickIndex] ?? 0
  const shownEvents = result.events.filter((event) => event.round <= currentTick)
  const eventsThisTick = result.events.filter((event) => event.round === currentTick)
  const shownUnits = result.units.map((unit) => ({ ...unit }))
  for (const event of shownEvents) {
    const actor = shownUnits.find((unit) => unit.id === event.actorId)
    if (actor) { actor.x = event.actorX; actor.y = event.actorY }
    const target = event.targetId ? shownUnits.find((unit) => unit.id === event.targetId) : undefined
    if (target && event.targetX !== null && event.targetY !== null) { target.x = event.targetX; target.y = event.targetY }
    if (target && event.targetHealth !== null) target.health = event.targetHealth
  }
  const currentEvent = eventsThisTick.at(-1)
  const position = (unit: (typeof shownUnits)[number]) => ({ x: unit.x, y: unit.y })

  const battleNode = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined
  const finalBoss = battleNode?.bossId === 'ferumbras'
  const victoryGold = battleNode ? 3 + battleNode.rewardGold : 3
  const victoryExperience = battleNode ? 25 + battleNode.rewardExperience : 25
  return (
    <section className={`${styles.arenaPanel} ${styles.sqmRoom}`} data-theme={battleNode?.theme}>
      <div className={styles.panelTopline}>
        <div><span className={styles.eyebrow}>{battleNode?.bossId ? 'Boss battle' : 'Live combat'} · tick {currentTick || 1} / {result.rounds}</span><h2>{battleNode?.bossId ? battleNode.name : 'The clash'}</h2></div>
        {battleNode?.bossSprite && <img className={styles.bossSprite} src={battleNode.bossSprite} alt={`${battleNode.name} boss`} />}
        <div className={styles.playbackControls}>
          <span className={styles.roundPill}>{finished ? 'BATTLE COMPLETE' : `TICK ${currentTick} · ${eventsThisTick.length} actions`}</span>
          <button className={styles.textButton} type="button" aria-label={showPlayableGrid ? 'Hide playable grid' : 'Show playable grid'} aria-pressed={showPlayableGrid} onClick={() => setShowPlayableGrid((visible) => !visible)}>{showPlayableGrid ? 'Grid: on' : 'Grid: off'}</button>
          {!finished && <label className={styles.tickSpeed}>Tick {tickDuration}ms<input aria-label="Combat tick duration" type="range" min="120" max="800" step="20" value={tickDuration} onChange={(event) => setTickDuration(Number(event.currentTarget.value))} /></label>}
          {!finished && <button className={styles.textButton} type="button" onClick={() => setPaused((value) => !value)}>{paused ? '▶ Resume' : 'Ⅱ Pause'}</button>}
          {!finished && <button className={styles.textButton} type="button" onClick={() => { setTickIndex(ticks.length - 1); setPaused(true) }}>Skip</button>}
        </div>
      </div>
      {finished && <div className={styles.arenaContinue} aria-live="polite">
        {result.won ? (
          <button className={styles.battleButton} type="button" onClick={commands.claimVictory}>
            {finalBoss ? 'End campaign' : 'Claim spoils · +' + victoryGold + ' gold · +' + victoryExperience + ' XP'} <b>→</b>
          </button>
        ) : (
          <>
            <div><strong>Defeat · no rewards</strong><span>Retry this encounter and adjust your formation.</span></div>
            <button className={styles.battleButton} type="button" onClick={commands.retryBattle}>Retry encounter <b>↻</b></button>
            <button className={styles.textButton} type="button" onClick={() => commands.newRun()}>Abandon campaign</button>
          </>
        )}
      </div>}
      <div className={styles.arenaLabels}><span>HOSTILE · CORAL</span><span>ALLY · CYAN</span></div>
      <div className={styles.battleStage}>
        <div className={styles.arenaGrid} data-theme={battleNode?.theme} data-grid-visible={showPlayableGrid} aria-label="Live tactical battlefield">
          <div className={styles.sqmBoard}>
            {Array.from({ length: 49 }, (_, index) => <span aria-hidden="true" className={styles.sqmTile} key={`sqm-${index}`} />)}
            <div className={styles.combatEffects} aria-hidden="true">
              {eventsThisTick.map((event, index) => {
                if (event.targetX === null || event.targetY === null || (event.type !== 'attack' && event.type !== 'defeat' && event.type !== 'heal')) return null
                const actor = shownUnits.find((unit) => unit.id === event.actorId)
                const actorCreature = actor ? creatureById[actor.creatureId] ?? bossById[actor.creatureId] : undefined
                if (!actorCreature) return null
                const kind = event.type === 'heal' ? 'heal' : actorCreature.role === 'shooter' ? 'arrow' : actorCreature.role === 'mage' || actorCreature.role === 'healer' ? 'spell' : 'melee'
                return <CombatProjectile key={`${event.round}-${event.actorId}-${event.targetId}-${index}`} event={event} kind={kind} durationMs={Math.max(140, Math.round(tickDuration * 0.85))} paused={paused} />
              })}
            </div>
            {shownUnits.map((unit) => {
              const creature = creatureById[unit.creatureId] ?? bossById[unit.creatureId]
              if (!creature) return null
              const point = position(unit)
              const isActor = currentEvent?.actorId === unit.id
              const isTarget = currentEvent?.targetId === unit.id && currentEvent.type !== 'heal'
              const alive = unit.health > 0
              const lastAttackTick = shownEvents.filter((event) => event.actorId === unit.id && (event.type === 'attack' || event.type === 'defeat' || (event.type === 'heal' && event.targetId !== unit.id))).at(-1)?.round ?? currentTick - 2
              return (
                <div
                  key={unit.id}
                  className={`${styles.arenaUnit} ${unit.side === 'player' ? styles.playerArenaUnit : styles.enemyArenaUnit} ${isActor ? styles.actingUnit : ''} ${isTarget ? styles.hitUnit : ''} ${!alive ? styles.defeatedUnit : ''}`}
                  style={{ left: `${point.x * 100 / 7}%`, top: `${point.y * 100 / 7}%`, transitionDuration: `${tickDuration}ms` }}
                  title={`${creature.name} · ${Math.ceil(unit.health)} / ${unit.maxHealth} health`}
                >
                  <CreatureImage creature={creature} className={styles.arenaSprite} />
                  <span className={styles.factionLabel}>{unit.side === 'player' ? 'ALLY' : 'ENEMY'}</span>
                  <span className={styles.arenaUnitName}>{creature.name}</span>
                  {unit.side === 'player' && unit.star > 1 && <span className={styles.arenaStars}>{'★'.repeat(unit.star)}</span>}
                  <span className={styles.healthTrack}><i style={{ width: `${Math.max(0, unit.health / unit.maxHealth * 100)}%` }} /></span>
                  <span className={styles.attackCooldownTrack} title="Action cooldown · two ticks"><i key={lastAttackTick} className={lastAttackTick > 0 ? styles.cooldownCharging : undefined} style={lastAttackTick > 0 ? { animationDuration: `${tickDuration * 2}ms`, animationPlayState: paused ? 'paused' : 'running' } : { width: '100%' }} /></span>
                  <small>{Math.max(0, Math.ceil(unit.health))} / {unit.maxHealth}</small>
                </div>
              )
            })}
          </div>
        </div>
        <aside className={styles.battleRoster} aria-label="Combatant status">
          {(['player', 'enemy'] as const).map((side) => {
            const roster = shownUnits.filter((unit) => unit.side === side)
            const active = roster.filter((unit) => unit.health > 0).length
            return <section className={styles.battleSide} key={side}>
              <header><span>{side === 'player' ? 'Your party' : 'Opposition'}</span><b>{active} / {roster.length}</b></header>
              <div className={styles.battleSideList}>
                {roster.map((unit) => {
                  const creature = creatureById[unit.creatureId] ?? bossById[unit.creatureId]
                  if (!creature) return null
                  const healthPercent = Math.max(0, unit.health / unit.maxHealth * 100)
                  return <div className={`${styles.battleRosterUnit} ${unit.health <= 0 ? styles.battleRosterDefeated : ''}`} key={unit.id}>
                    <CreatureImage creature={creature} className={styles.battleRosterSprite} />
                    <div><strong>{creature.name}</strong><span>{Math.max(0, Math.ceil(unit.health))} / {unit.maxHealth} health</span><i><b style={{ width: `${healthPercent}%` }} /></i></div>
                    {unit.side === 'player' && unit.star > 1 && <em>{'★'.repeat(unit.star)}</em>}
                  </div>
                })}
              </div>
            </section>
          })}
        </aside>
      </div>
      <div className={`${styles.arenaEvent} ${currentEvent?.type === 'attack' || currentEvent?.type === 'defeat' ? styles.attackEvent : ''}`}>
        <span>{currentEvent?.type === 'move' ? '↗' : currentEvent?.type === 'heal' ? '✚' : currentEvent?.type === 'defeat' ? '✦' : '⚔'}</span>
        <p>{eventsThisTick.length ? eventsThisTick.map((event) => event.text).join(' · ') : 'The two sides approach each other…'}</p>
      </div>
      {finished && <div className={styles.arenaOutcome}>{result.won ? 'Victory' : 'Defeat'}{result.won ? '' : ' · retry available'}</div>}
    </section>
  )
}

function CombatProjectile({
  event,
  kind,
  durationMs,
  paused,
}: {
  event: BattleResult['events'][number]
  kind: 'arrow' | 'spell' | 'heal' | 'melee'
  durationMs: number
  paused: boolean
}) {
  const projectileRef = useRef<HTMLSpanElement>(null)
  const animationRef = useRef<Animation | null>(null)

  useEffect(() => {
    const projectile = projectileRef.current
    const board = projectile?.parentElement
    if (!projectile || !board || event.targetX === null || event.targetY === null) return
    const cellWidth = board.clientWidth / 7
    const cellHeight = board.clientHeight / 7
    const deltaX = (event.targetX - event.actorX) * cellWidth
    const deltaY = (event.targetY - event.actorY) * cellHeight
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI
    const sourceTransform = `translate(-50%, -50%) rotate(${angle}deg)`
    const targetTransform = `translate(-50%, -50%) translate(${deltaX}px, ${deltaY}px) rotate(${angle}deg)`
    const flight = projectile.animate([
      { transform: sourceTransform, opacity: 0 },
      { offset: 0.12, transform: sourceTransform, opacity: 1 },
      { offset: 0.78, transform: targetTransform, opacity: 1 },
      { transform: targetTransform, opacity: 0 },
    ], { duration: durationMs, easing: 'cubic-bezier(.2,.7,.35,1)', fill: 'forwards' })
    animationRef.current = flight
    return () => {
      flight.cancel()
      animationRef.current = null
    }
  }, [durationMs, event.actorX, event.actorY, event.targetX, event.targetY])

  useEffect(() => {
    if (paused) animationRef.current?.pause()
    else animationRef.current?.play()
  }, [paused])

  const kindClass = {
    arrow: styles.arrowProjectile,
    spell: styles.spellProjectile,
    heal: styles.healProjectile,
    melee: styles.meleeProjectile,
  }[kind]

  return <span
    ref={projectileRef}
    className={`${styles.combatProjectile} ${kindClass}`}
    style={{ left: `${(event.actorX + 0.5) * 100 / 7}%`, top: `${(event.actorY + 0.5) * 100 / 7}%` }}
  >{kind === 'arrow' ? '➤' : kind === 'melee' ? '✦' : kind === 'heal' ? '+' : ''}</span>
}

function BattleReport() {
  const { state } = useGame()
  const node = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined
  const finalBoss = node?.bossId === 'ferumbras'
  const result = state.battleResult
  if (!result) return null
  const unitById = new Map(result.units.map((unit) => [unit.id, unit]))
  const analytics = (result.analytics ?? []).map((entry) => ({ ...entry, unit: unitById.get(entry.unitId) }))
  const alliedStats = analytics.filter((entry) => entry.side === 'player')
  const summary = {
    damageDone: alliedStats.reduce((total, entry) => total + entry.damageDone, 0),
    damageTaken: alliedStats.reduce((total, entry) => total + entry.damageTaken, 0),
    damageReduced: alliedStats.reduce((total, entry) => total + entry.damageReduced, 0),
    healingDone: alliedStats.reduce((total, entry) => total + entry.healingDone, 0),
  }
  return (
    <section className={styles.pageSection}>
      <div className={`${styles.battleBanner} ${result.won ? styles.victoryBanner : styles.defeatBanner}`}>
        <span className={styles.battleBannerIcon}>{result.won ? '✦' : '☠'}</span>
        <div>
          <div className={styles.eyebrow}>{node?.region} · {result.rounds} ticks</div>
          <h1>{result.won ? 'Victory' : 'Defeat at ' + node?.name}</h1>
          <p>{result.won ? finalBoss ? 'Ferumbras has fallen. This is the end of the campaign.' : 'Your formation held. Claim your spoils and choose the next route.' : 'Your formation fell. Return to preparation and try a new arrangement.'}</p>
        </div>
        <div className={styles.bannerMark}>{result.won ? 'W' : 'R'}</div>
      </div>

      <section className={styles.analysisPanel} aria-label="Battle analysis">
        <div className={styles.panelTopline}>
          <div><span className={styles.eyebrow}>Battle analysis</span><h2>Formation performance</h2></div>
          <span className={styles.roundPill}>ALLIES · {alliedStats.length}</span>
        </div>
        {analytics.length > 0 ? (
          <>
            <div className={styles.analysisSummary}>
              <div><span>Damage dealt</span><strong>{summary.damageDone.toLocaleString()}</strong></div>
              <div><span>Damage taken</span><strong>{summary.damageTaken.toLocaleString()}</strong></div>
              <div><span>Damage reduced</span><strong>{summary.damageReduced.toLocaleString()}</strong></div>
              <div><span>Healing done</span><strong>{summary.healingDone.toLocaleString()}</strong></div>
            </div>
            <div className={styles.analysisTableWrap}>
              <table className={styles.analysisTable}>
                <thead><tr><th>Creature</th><th>Side</th><th>Damage dealt</th><th>Damage taken</th><th>Damage reduced</th><th>Healing</th><th>Defeats</th></tr></thead>
                <tbody>{analytics.map((entry) => {
                  const creature = entry.unit ? creatureById[entry.unit.creatureId] ?? bossById[entry.unit.creatureId] : undefined
                  return (
                    <tr key={entry.unitId}>
                      <td><span className={styles.analysisCreature}>{creature && <CreatureImage creature={creature} className={styles.analysisSprite} />}{creature?.name ?? 'Unknown creature'}</span></td>
                      <td><span className={`${styles.analysisSide} ${entry.side === 'player' ? styles.analysisAlly : styles.analysisEnemy}`}>{entry.side === 'player' ? 'Ally' : 'Enemy'}</span></td>
                      <td>{entry.damageDone.toLocaleString()}</td><td>{entry.damageTaken.toLocaleString()}</td><td>{entry.damageReduced.toLocaleString()}</td><td>{entry.healingDone.toLocaleString()}</td><td>{entry.defeats}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </>
        ) : <p className={styles.analysisEmpty}>Detailed metrics are not available for this saved battle.</p>}
      </section>

      <div className={styles.reportGrid}>
        <section className={styles.reportPanel}>
          <div className={styles.panelTopline}><div><span className={styles.eyebrow}>Combat record</span><h2>Battle log</h2></div><span className={styles.roundPill}>{result.rounds} ticks</span></div>
          <div className={styles.logList}>
            {result.log.map((entry, index) => <p key={`${index}-${entry}`}><span>{String(index + 1).padStart(2, '0')}</span>{entry.replace(/^Round \d+: /, '')}</p>)}
          </div>
        </section>
        <aside className={styles.reportSide}>
          <section className={styles.reportPanel}>
            <span className={styles.eyebrow}>Your survivors</span>
            <div className={styles.survivorList}>
              {result.survivors.map((survivor) => {
                const unit = state.roster.find((entry) => entry.instanceId === survivor.unitId)
                const creature = unit ? creatureById[unit.creatureId] : undefined
                if (!creature) return null
                return (
                  <div className={styles.survivorRow} key={survivor.unitId}>
                    <CreatureImage creature={creature} className={styles.survivorSprite} />
                    <div><strong>{creature.name}</strong><span>♥ {survivor.health} / {survivor.maxHealth}</span></div>
                  </div>
                )
              })}
              {result.survivors.length === 0 && <p className={styles.emptyBench}>No survivors returned.</p>}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

function RewardScreen() {
  const { state, commands } = useGame()
  const selectedCreature = state.selectedCreatureRewardId
  const selectedUpgrade = state.selectedUpgradeRewardId
  const node = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined

  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div><div className={styles.eyebrow}>Victory spoils · +{3 + (node?.rewardGold ?? 0)} gold · +{25 + (node?.rewardExperience ?? 0)} XP</div><h1>Choose your rewards</h1><p className={styles.lede}>Recruit one creature. Level-ups also unlock a vocation perk choice.</p></div>
        <span className={styles.stepBadge}>REWARD CACHE</span>
      </div>
      <div className={styles.rewardBlock}>
        <div className={styles.rewardHeading}><span>01</span><div><h2>Recruit a creature</h2><p>Choose one from the frontier arrivals.</p></div>{selectedCreature && <b className={styles.chosenMark}>✓ Chosen</b>}</div>
        <div className={styles.rewardGrid}>
          {state.rewardCreatureIds.map((id) => {
            const creature = creatureById[id]
            if (!creature) return null
            return (
              <button className={`${styles.rewardCard} ${selectedCreature === id ? styles.rewardSelected : ''}`} key={id} type="button" onClick={() => commands.chooseCreatureReward(id)}>
                <CreatureImage creature={creature} className={styles.rewardSprite} />
                <span className={styles.rewardName}>{creature.name}</span>
                <span className={styles.rewardFamily}>{creature.family} · {[...state.roster, { creatureId: creature.id }].filter((unit) => unit.creatureId === creature.id).length - 1} owned</span>
                <div className={styles.tagRow}><Tag value={creature.bestiaryClass} /><RoleTag role={creature.role} /></div>
                <span className={styles.rewardSelect}>{selectedCreature === id ? 'Added to roster ✓' : 'Choose creature →'}</span>
              </button>
            )
          })}
        </div>
      </div>
      {state.selectedItemRewardId && itemById[state.selectedItemRewardId] && <div className={styles.rewardBlock}>
        <div className={styles.rewardHeading}><span>★</span><div><h2>Boss loot dropped</h2><p>A random item was added to your backpack.</p></div><b className={styles.chosenMark}>✓ Added</b></div>
        <div className={styles.rewardGrid}>
          {(() => {
            const item = itemById[state.selectedItemRewardId]
            if (!item) return null
            return <div className={styles.rewardCard}>
              <ItemImage item={item} className={styles.lootRewardImage} />
              <span className={styles.rewardName}>{item.name}</span>
              <span className={styles.rewardFamily}>{item.slot} · {item.universal ? 'all creatures' : item.allowedRoles.join(', ')}</span>
              <small>{itemStatSummary(item)}</small>
              {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className={styles.textButton}>Tibia item details ↗</a>}
              <span className={styles.rewardSelect}>Added automatically ✓</span>
            </div>
          })()}
        </div>
      </div>}
      {state.pendingLevelUps > 0 && <div className={`${styles.rewardBlock} ${styles.perkRewardBlock}`}>
        <div className={styles.rewardHeading}><span>LV {state.level}</span><div><h2>Choose a vocation perk</h2><p>Level up unlocked a permanent run upgrade for this commander.</p></div>{selectedUpgrade && <b className={styles.chosenMark}>✓ Chosen</b>}</div>
        <div className={styles.upgradeGrid}>
          {state.rewardUpgradeIds.map((id) => {
            const upgrade = upgradeByIdList().find((item) => item.id === id)
            if (!upgrade) return null
            return (
              <button className={`${styles.upgradeCard} ${selectedUpgrade === id ? styles.rewardSelected : ''}`} key={id} type="button" onClick={() => commands.chooseUpgradeReward(id)}>
                <span className={styles.upgradeIcon}><GameIcon name={upgrade.icon} /></span>
                <strong>{upgrade.name}</strong>
                <p>{upgrade.description}</p>
                <span className={styles.rewardSelect}>{selectedUpgrade === id ? 'Perk chosen ✓' : 'Choose perk →'}</span>
              </button>
            )
          })}
        </div>
      </div>}
      <div className={styles.rewardFooter}>{state.pendingLevelUps > 0 ? 'Choose one creature and the newly unlocked vocation perk to continue.' : 'Choose one creature to continue. Keep earning experience to unlock a vocation perk.'}</div>
    </section>
  )
}

function upgradeByIdList() {
  return upgrades
}

function CampaignEnd({ victory }: { victory: boolean }) {
  const { state, commands } = useGame()
  const commander = state.commanderId ? vocationById[state.commanderId] : undefined
  return (
    <section className={styles.endScreen}>
      <span className={styles.endSigil}>{victory ? '✦' : '⌂'}</span>
      <div className={styles.eyebrow}>{victory ? 'The frontier remembers' : 'Campaign ended'}</div>
      <h1>{victory ? 'Ferumbras is defeated.' : 'The paths remain broken.'}</h1>
      <p>{victory ? `Your ${commander?.name ?? 'commander'} and their creatures ended the Shattered Paths by defeating Ferumbras.` : 'Build a different formation and try another route through the frontier.'}</p>
      <div className={styles.endStats}><span><b>{state.completedNodeIds.length}</b> encounters cleared</span><span><b>{state.roster.length}</b> creatures recruited</span></div>
      <button className={styles.battleButton} type="button" onClick={() => commands.newRun()}>Begin a new campaign <b>→</b></button>
    </section>
  )
}

function Tag({ value }: { value: string }) {
  return <span className={styles.tag}>{value}</span>
}

const roleLabels: Record<Role, string> = { tank: 'Tank', fighter: 'Fighter', shooter: 'Shooter', mage: 'Mage', healer: 'Healer' }

function RoleTag({ role }: { role: Role }) {
  return <span className={`${styles.tag} ${styles[`tag_${role}`]} ${styles.roleIconTag}`} title={roleLabels[role]} aria-label={roleLabels[role]}><RoleIcon role={role} /></span>
}

function RoleIcon({ role }: { role: Role }) {
  const shapes: Record<Role, ReactNode> = {
    shooter: <><path d="M4 3c9 4 9 14 0 18" /><path d="M4 3v18M4 12h17m-5-5 5 5-5 5" /></>,
    tank: <><path d="m12 2 8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3Z" /><path d="m8 12 2.5 2.5L16 9" /></>,
    mage: <><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" /><path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8L19 2Z" /></>,
    healer: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></>,
    fighter: <><path d="m4 3 17 17m-5-17L3 16m0-13 4 1-3 3-1-4Zm17 17-1-4-3 3 4 1Z" /></>,
  }
  return <svg className={styles.roleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[role]}</svg>
}

function CreatureCodex({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [family, setFamily] = useState('all')
  const families = [...new Set(creatures.map((creature) => creature.family))].sort()
  const visibleCreatures = creatures.filter((creature) => {
    const matchesText = `${creature.name} ${creature.family} ${creature.bestiaryClass}`.toLowerCase().includes(query.toLowerCase())
    return matchesText && (role === 'all' || creature.role === role) && (family === 'all' || creature.family === family)
  })

  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div><div className={styles.eyebrow}>Field guide · {creatures.length} creatures</div><h1>Creature codex</h1><p className={styles.lede}>Browse every recruit currently in the campaign pool.</p></div>
        <button className={styles.secondaryButton} type="button" onClick={onBack}>← Return to campaign</button>
      </div>
      <div className={styles.codexFilters}>
        <input aria-label="Search creatures" placeholder="Search name, family, or class…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="all">All roles</option>{Object.entries(roleLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select>
        <select aria-label="Filter by family" value={family} onChange={(event) => setFamily(event.target.value)}>
          <option value="all">All families</option>{families.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </div>
      <div className={styles.codexGrid}>
        {visibleCreatures.map((creature) => (
          <article className={styles.codexCard} key={creature.id}>
            <div className={styles.codexArt}><CreatureImage creature={creature} className={styles.codexSprite} /><span>✦ {creature.cost}</span></div>
            <div className={styles.codexBody}>
              <span className={styles.routeMeta}>{creature.family}</span><h2>{creature.name}</h2>
              <p>{creature.description}</p>
              <div className={styles.tagRow}><Tag value={creature.bestiaryClass} /><RoleTag role={creature.role} /></div>
              <div className={styles.codexStats}><span>♥ {creature.health}</span><span>⚔ {creature.attack}</span><span>⬟ {creature.armor}</span><span>↗ {creature.range}</span></div>
            </div>
          </article>
        ))}
        {visibleCreatures.length === 0 && <p className={styles.emptyBench}>No creatures match those filters.</p>}
      </div>
    </section>
  )
}

function GameWiki({ onBack }: { onBack: () => void }) {
  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div><div className={styles.eyebrow}>Field manual</div><h1>Game rules</h1><p className={styles.lede}>How to build a formation, earn rewards, and resolve battles.</p></div>
        <button className={styles.secondaryButton} type="button" onClick={onBack}>← Return to campaign</button>
      </div>
      <div className={styles.reportGrid}>
        <section className={styles.reportPanel}><h2>Campaign loop</h2><ol>
          <li>Choose one of four vocations. Its passive applies automatically in every battle.</li>
          <li>Choose from a randomly generated sparse route map. Each node previews its encounter and reward type before you commit.</li>
          <li>Prepare before the encounter: buy creatures, reroll creature offers for 1 gold, buy Formation Permits, and arrange units.</li>
          <li>Watch the automatic battle. Victory grants encounter rewards; defeat grants nothing and lets you retry the same encounter.</li>
          <li>After victory, choose one free creature. XP is also paid only on victory. Every 100 XP grants a level and one vocation perk choice.</li>
          <li>Complete ten encounters to reach the canonical ending: the final battle against Ferumbras.</li>
        </ol></section>
        <section className={styles.reportPanel}><h2>Bosses, loot, and equipment</h2><ul>
          <li>Boss battles appear at encounters 3, 6, and 9. The Cobra family is led by Scarlett Etzel, Falcon by Grand Master Oberon, and Asura by The Moonsnow Magnolia. Ferumbras is the final boss at encounter 10.</li>
          <li>The family bosses are the only source of equipment. Each family boss victory randomly drops one item from that boss's drop pool; it is added to the backpack automatically. Defeat grants no item. Defeating Ferumbras ends the campaign without loot.</li>
          <li>Items occupy one equipment slot per creature. Move loot freely between the backpack and any eligible creature. Equipping an item into an occupied slot returns the old item to the backpack.</li>
          <li>Druid gear is for healers, Sorcerer gear for mages, Paladin gear for shooters, and Monk gear for fighters. Knight weapons of either hand type and shields are tank-only; Knight armor and amulets can be used by tanks or fighters. The Cobra Amulet and Ferumbras' Hat are universal.</li>
          <li>Item YAML preserves Tibia attack, defense, armor, range, skill, protection, critical, leech, duration, level, and weight values. The game uses these as combat bonuses: weapon attack can replace lower creature attack, armor and defense add to armor, range extends attacks, protection reduces damage, and critical/leech values apply as expected-value bonuses.</li>
          {items.map((item) => <li key={item.id}><b>{item.name}</b> ({item.slot}; {item.universal ? 'all roles' : item.allowedRoles.join(', ')}): dropped by {item.bossId}. Tibia stats: {itemStatSummary(item)}.</li>)}
        </ul></section>
        <section className={styles.reportPanel}><h2>Recruitment and formation</h2><ul>
          <li>You begin with 5 gold, three creatures, and a deployment limit of five. The reserve has no size limit.</li>
          <li>The player formation is three rows by seven columns. The combat room is seven by seven tiles.</li>
          <li>Only one copy of a creature can be deployed at a time. Extra copies stay on the bench.</li>
          <li>A Formation Permit costs 5 gold and permanently raises the run's deployment limit by one, up to all 21 formation spaces. It is available in preparation and does not change when creature offers reroll.</li>
          <li>Three copies of the same creature at the same star rank merge into one creature of the next rank. Rank 2 and 3 multiply health and attack by 1.65 and 2.5.</li>
          <li>Every creature remains in the shop pool, including creatures already owned and those at three stars. Copies can be bought repeatedly; three at the same star rank merge into the next rank, up to three stars. Buying removes that offer; when the list is exhausted, it refreshes from the full creature pool. Manual rerolls cost one gold.</li>
          <li>Creature offers are weighted away from the current phase's main enemy family. In boss encounters, the boss's family is the phase family.</li>
          <li>Hunt routes add two shop offers and offer five victory recruits instead of three.</li>
        </ul></section>
        <section className={styles.reportPanel}><h2>Roles and synergies</h2><ul>
          <li><b>Tank:</b> durable frontline. <b>Fighter:</b> melee attacker with bonus damage when adjacent. <b>Shooter</b> and <b>Mage:</b> ranged damage dealers. <b>Healer:</b> heals the most wounded ally instead of attacking when possible.</li>
          <li>Each creature contributes one count to its role, family, and Bestiary class synergies while deployed. Benched units do not count. A creature can count once in each of those three categories.</li>
          {synergies.map((synergy) => <li key={synergy.id}><b>{synergy.label}</b> ({synergy.category}: {synergy.tag})<ul>{synergy.breakpoints.map((tier) => <li key={tier.count}>{tier.count} units — {tier.title}: {tier.description}</li>)}</ul></li>)}
          <li>Vocation passives, owned perks, and active synergies apply automatically. Perks stack; when multiple levels are earned together, a fresh set of three choices appears for each level. The same perk can be chosen more than once.</li>
          {vocations.map((vocation) => <li key={vocation.id}><b>{vocation.name}:</b> {vocation.description}</li>)}
          {upgrades.map((upgrade) => <li key={upgrade.id}><b>{upgrade.name} ({upgrade.vocation}):</b> {upgrade.description}</li>)}
        </ul></section>
        <section className={styles.reportPanel}><h2>Battle rules</h2><ul>
          <li>All units start each encounter at full health. Health does not carry between encounters.</li>
          <li>Boss encounters include the boss and the themed creatures shown on that route card. The boss is included in the displayed enemy count.</li>
          <li>Combat advances in shared ticks. Every unit acts on the same clock, and the tick duration can be adjusted during playback.</li>
          <li>Attacks have a two-tick cooldown. A ready attack is held while no opponent is in range and releases as soon as a target is nearby. Creatures keep their chosen target until it is defeated.</li>
          <li>Range and distance use neighboring sqm steps; diagonal steps count as one. Units use the shortest clear path and move one free neighboring tile per tick. Moving does not reset attack cooldown.</li>
          <li>Damage is at least 1 and is calculated from attack and bonuses, minus target armor, then reduced by damage-reduction effects. Fighters deal an additional 35% when adjacent.</li>
          <li>Enemy power scales by encounter stage: 1 + max(0, stage − 1) × 12%; enemy tanks receive an additional 8% power and bosses receive 20% additional power.</li>
          <li>Periodic healing resolves every two ticks. Healers use their action cooldown to heal the living ally with the lowest health percentage instead of attacking when possible. Healing cannot exceed max health.</li>
          <li>Combat ends when a side is eliminated or after 60 ticks. If both sides remain, compare the sum of each side's survivors' health percentages. The higher total wins; a tie is a defeat.</li>
        </ul></section>
        <section className={styles.reportPanel}><h2>Rewards and retries</h2><ul>
          <li>Victory rewards include 3 base gold plus route gold, 25 base XP plus route XP, and one creature choice. These are all granted only after victory.</li>
          <li>Every loss grants no rewards and allows an unlimited retry of the same encounter.</li>
          <li>A retry keeps the same encounter and current shop state. Preparation actions remain available.</li>
          <li>Experience rolls over at 100. Each level grants one perk choice from the selected vocation's upgrades.</li>
        </ul></section>
      </div>
    </section>
  )
}

function GameScreen() {
  const { state, commands, playback } = useGame()
  const [showCodex, setShowCodex] = useState(false)
  const [showBalance, setShowBalance] = useState(false)
  const [showWiki, setShowWiki] = useState(false)
  const [battlePlayed, setBattlePlayed] = useState(false)
  useEffect(() => setBattlePlayed(false), [state.battleResult])
  return (
    <Shell onOpenCompendium={() => { setShowCodex(true); setShowBalance(false); setShowWiki(false) }} onOpenBalance={() => { setShowBalance(true); setShowCodex(false); setShowWiki(false) }} onOpenWiki={() => { setShowWiki(true); setShowCodex(false); setShowBalance(false) }}>
      {playback ? <>
        {(state.phase === 'battle' || (state.battleResult && !battlePlayed && state.phase === 'defeat')) && <><BattlePlayback onFinished={() => setBattlePlayed(true)} />{battlePlayed && state.phase === 'battle' && <BattleReport />}</>}
        {state.phase === 'vocation' && <VocationSelection />}
        {state.phase === 'map' && <CampaignMap />}
        {state.phase === 'preparation' && <Preparation />}
        {state.phase === 'reward' && <RewardScreen />}
        {state.phase === 'complete' && <CampaignEnd victory />}
        {state.phase === 'defeat' && (battlePlayed || !state.battleResult) && <CampaignEnd victory={false} />}
      </> : showWiki ? <GameWiki onBack={() => setShowWiki(false)} /> : showBalance ? <Suspense fallback={<section className={styles.pageSection}><p>Opening balance lab…</p></section>}><BalanceLab onBack={() => setShowBalance(false)} onPlayReplay={(replay) => { setShowBalance(false); commands.playReplay(replay) }} /></Suspense> : showCodex ? <CreatureCodex onBack={() => setShowCodex(false)} /> : <>
        {state.phase === 'vocation' && <VocationSelection />}
        {state.phase === 'map' && <CampaignMap />}
        {state.phase === 'preparation' && <Preparation />}
        {state.phase === 'battle' && <><BattlePlayback onFinished={() => setBattlePlayed(true)} />{battlePlayed && <BattleReport />}</>}
        {state.phase === 'reward' && <RewardScreen />}
        {state.phase === 'complete' && <CampaignEnd victory />}
        {state.phase === 'defeat' && <CampaignEnd victory={false} />}
      </>}
    </Shell>
  )
}

export default function App() {
  return <GameProvider><GameScreen /></GameProvider>
}
