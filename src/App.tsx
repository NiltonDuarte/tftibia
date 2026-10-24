import { campaign, creatureById, creatures, nodeById, synergies, upgrades, vocationById } from './content/content'
import { getActiveSynergies } from './game/combat'
import { GameProvider } from './game/GameContext'
import { useGame } from './game/useGame'
import type { Creature, Role, Vocation } from './content/schemas'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './App.module.css'

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
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

function CreatureImage({ creature, className }: { creature: Creature; className?: string }) {
  return <img className={className ?? styles.creatureSprite} src={imageUrl(creature.image)} alt={creature.name} />
}

function Shell({ children, onOpenCompendium }: { children: ReactNode; onOpenCompendium: () => void }) {
  const { state, commands } = useGame()
  const showBar = state.phase !== 'vocation'

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
          {showBar && (
            <>
              <span className={styles.phasePill}>{phaseLabels[state.phase]}</span>
              <span className={styles.goldPill}>✦ {state.gold} gold</span>
              <span className={styles.livesPill}>♥ {state.lives}</span>
              <button className={`${styles.newRunButton} ${styles.restartButton}`} type="button" aria-label="Start a new campaign" onClick={commands.newRun}>
                <span>New campaign</span><b>↻</b>
              </button>
            </>
          )}
        </div>
      </header>
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
        <div className={styles.eyebrow}>A creature tactics campaign</div>
        <h1>Build your team.<br /><em>Survive the frontier.</em></h1>
        <p>
          Choose a vocation, recruit creatures, and send your formation into automatic battles. Every route changes the
          fight ahead.
        </p>
        <div className={styles.introFacts}>
          <span><b>01</b> Pick a path</span>
          <span><b>02</b> Shape your formation</span>
          <span><b>03</b> Watch the clash</span>
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
              <span className={styles.vocationIcon}>{vocation.icon}</span>
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
  const location = nodeById[state.mapNodeId]
  const destinations = location.nextNodeIds.map((id) => nodeById[id]).filter(Boolean)
  const encounterCount = state.completedNodeIds.length

  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div>
          <div className={styles.eyebrow}>Campaign · {campaign.title}</div>
          <h1>Choose your next route</h1>
          <p className={styles.lede}>The paths are unstable. Pick a region and prepare for what waits there.</p>
        </div>
        <div className={styles.progressCard}>
          <span>CAMPAIGN PROGRESS</span>
          <strong>{encounterCount} <small>/ 8 encounters</small></strong>
          <div className={styles.progressTrack}><i style={{ width: `${Math.min(100, encounterCount * 12.5)}%` }} /></div>
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

      <div className={styles.routeGrid}>
        {destinations.map((node, index) => {
          const enemyUnits = node.enemies.map((id) => creatureById[id]).filter(Boolean)
          return (
            <article className={styles.routeCard} key={node.id}>
              <div className={styles.routeImage}>
                <span className={styles.routeIndex}>0{index + 1}</span>
                <span className={styles.routeStage}>ENCOUNTER {node.stage}</span>
                <span className={styles.routeSigil}>{index === 0 ? '✦' : '⚔'}</span>
              </div>
              <div className={styles.routeBody}>
                <div className={styles.routeMeta}>{node.region}</div>
                <h2>{node.name}</h2>
                <p>{node.description}</p>
                <div className={styles.enemyPreview}>
                  {enemyUnits.map((creature) => (
                    <CreatureImage className={styles.enemyAvatar} creature={creature} key={creature.id} />
                  ))}
                  <span>{enemyUnits.length} creatures</span>
                </div>
                <button className={styles.primaryButton} type="button" onClick={() => commands.chooseRoute(node.id)}>
                  Travel this route <b>→</b>
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <div className={styles.mapTip}><span>✧</span> Eight encounters. Three lives. A new shop before each fight.</div>
    </section>
  )
}

function Preparation() {
  const { state, commands } = useGame()
  const node = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined
  const boardUnits = state.roster.filter((unit) => unit.slot !== null)
  const boardCreatures = boardUnits.map((unit) => creatureById[unit.creatureId]).filter(Boolean)
  const activeSynergies = getActiveSynergies(boardCreatures, synergies)
  const selected = state.roster.find((unit) => unit.instanceId === state.selectedUnitId)
  const selectedCreature = selected ? creatureById[selected.creatureId] : undefined
  const bench = state.roster.filter((unit) => unit.slot === null)

  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div>
          <div className={styles.eyebrow}>Encounter {node?.stage} · {node?.region}</div>
          <h1>{node?.name}</h1>
          <p className={styles.lede}>{node?.description} Your creatures act automatically once battle begins.</p>
        </div>
        <div className={styles.prepHeaderStats}>
          <span><b>{boardUnits.length}</b> / {campaign.boardCapacity} deployed</span>
          <span><b>{state.roster.length}</b> creatures recruited</span>
        </div>
      </div>

      <div className={styles.prepLayout}>
        <div className={styles.boardColumn}>
          <div className={styles.panelTopline}>
            <div><span className={styles.eyebrow}>Formation</span><h2>Set the board</h2></div>
            <span className={styles.boardLegend}><i /> Your side</span>
          </div>
          <div className={styles.boardFrame}>
            <div className={styles.rowLabel}>BACKLINE</div>
            <div className={styles.boardGrid}>
              {Array.from({ length: 9 }, (_, slot) => {
                const unit = state.roster.find((candidate) => candidate.slot === slot)
                const creature = unit ? creatureById[unit.creatureId] : undefined
                const isSelected = unit?.instanceId === state.selectedUnitId
                const duplicateIsDeployed = Boolean(selected && selected.slot === null && selected.creatureId === creature?.id)
                return (
                  <button
                    className={`${styles.boardSlot} ${unit ? styles.occupiedSlot : ''} ${isSelected ? styles.selectedSlot : ''}`}
                    key={slot}
                    title={duplicateIsDeployed ? 'That creature is already deployed. Merge another copy or choose a different creature.' : undefined}
                    type="button"
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
                        {unit && unit.star > 1 && <span className={styles.starBadge}>{'★'.repeat(unit.star)}</span>}
                        <span className={`${styles.roleDot} ${styles[`role_${creature.role}`]}`} />
                      </>
                    ) : <span className={styles.slotPlus}>{state.selectedUnitId ? '+' : '·'}</span>}
                  </button>
                )
              })}
            </div>
            <div className={styles.rowLabel}>FRONTLINE</div>
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
                      onClick={() => commands.selectUnit(state.selectedUnitId === unit.instanceId ? null : unit.instanceId)}
                    >
                      <CreatureImage creature={creature} className={styles.benchSprite} />
                      <span>{creature.name}</span>
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
            <p className={styles.shopDesc}>Offers are drawn from the full creature pool.</p>
            <div className={styles.shopOffers}>
              {state.shopCreatureIds.map((id, index) => {
                const creature = creatureById[id]
                if (!creature) return null
                const canBuy = state.gold >= creature.cost
                const copiesOwned = state.roster.filter((unit) => unit.creatureId === creature.id).length
                return (
                  <article className={styles.shopCard} key={`${id}-${index}`}>
                    <div className={styles.shopCardImage}><CreatureImage creature={creature} className={styles.shopSprite} /></div>
                    <div className={styles.shopCardInfo}>
                      <strong>{creature.name}</strong>
                      <span>{creature.family}{copiesOwned > 0 ? ` · ${copiesOwned} owned` : ''}</span>
                      <div className={styles.tagRow}><Tag value={creature.bestiaryClass} /><RoleTag role={creature.role} /></div>
                    </div>
                    <button className={styles.buyButton} type="button" disabled={!canBuy} onClick={() => commands.buyCreature(id)}>
                      <span>Recruit</span><b>✦ {creature.cost}</b>
                    </button>
                  </article>
                )
              })}
            </div>
            <div className={styles.shopFooter}>
              <span>Reroll costs <b>1 gold</b></span>
              <button className={styles.secondaryButton} type="button" disabled={state.gold < 1} onClick={commands.rerollShop}>↻ Reroll</button>
            </div>
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

          <div className={styles.battleAction}>
            <div><strong>Formation ready?</strong><span>Frontliners intercept threats; range and lanes change who can strike.</span></div>
            <button className={styles.battleButton} type="button" disabled={boardUnits.length === 0} onClick={commands.startBattle}>
              Begin automatic battle <b>→</b>
            </button>
          </div>
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
  const { state } = useGame()
  const result = state.battleResult
  const [eventIndex, setEventIndex] = useState(-1)
  const [paused, setPaused] = useState(false)
  const events = result?.events ?? []
  const finished = eventIndex >= events.length - 1

  useEffect(() => {
    if (!result || paused || finished) return
    const timer = window.setTimeout(() => setEventIndex((index) => Math.min(events.length - 1, index + 1)), 540)
    return () => window.clearTimeout(timer)
  }, [eventIndex, events.length, finished, paused, result])

  useEffect(() => {
    if (finished) onFinished()
  }, [finished, onFinished])

  if (!result) return null

  const shownUnits = result.units.map((unit) => ({ ...unit }))
  for (const event of result.events.slice(0, eventIndex + 1)) {
    const actor = shownUnits.find((unit) => unit.id === event.actorId)
    if (actor) actor.slot = event.actorSlot
    const target = event.targetId ? shownUnits.find((unit) => unit.id === event.targetId) : undefined
    if (target && event.targetSlot !== null) target.slot = event.targetSlot
    if (target && event.targetHealth !== null) target.health = event.targetHealth
  }
  const currentEvent = result.events[eventIndex]
  const position = (side: 'player' | 'enemy', slot: number) => ({
    x: slot % 3,
    y: side === 'player' ? 5 - Math.floor(slot / 3) : 2 - Math.floor(slot / 3),
  })

  return (
    <section className={styles.arenaPanel}>
      <div className={styles.panelTopline}>
        <div><span className={styles.eyebrow}>Live combat · round {currentEvent?.round ?? 1} / {result.rounds}</span><h2>The clash</h2></div>
        <div className={styles.playbackControls}>
          <span className={styles.roundPill}>{finished ? 'BATTLE COMPLETE' : `${eventIndex + 1} / ${result.events.length} actions`}</span>
          {!finished && <button className={styles.textButton} type="button" onClick={() => setPaused((value) => !value)}>{paused ? '▶ Resume' : 'Ⅱ Pause'}</button>}
          {!finished && <button className={styles.textButton} type="button" onClick={() => { setEventIndex(result.events.length - 1); setPaused(true) }}>Skip</button>}
        </div>
      </div>
      <div className={styles.arenaLabels}><span>ENEMY TERRITORY</span><span>YOUR FORMATION</span></div>
      <div className={styles.arenaGrid}>
        {shownUnits.map((unit) => {
          const creature = creatureById[unit.creatureId]
          if (!creature) return null
          const point = position(unit.side, unit.slot)
          const isActor = currentEvent?.actorId === unit.id
          const isTarget = currentEvent?.targetId === unit.id && currentEvent.type !== 'heal'
          const alive = unit.health > 0
          return (
            <div
              key={unit.id}
              className={`${styles.arenaUnit} ${unit.side === 'player' ? styles.playerArenaUnit : styles.enemyArenaUnit} ${isActor ? styles.actingUnit : ''} ${isTarget ? styles.hitUnit : ''} ${!alive ? styles.defeatedUnit : ''}`}
              style={{ gridColumn: point.x + 1, gridRow: point.y + 1 }}
              title={`${creature.name} · ${Math.ceil(unit.health)} / ${unit.maxHealth} health`}
            >
              <CreatureImage creature={creature} className={styles.arenaSprite} />
              <span className={styles.arenaUnitName}>{creature.name}</span>
              {unit.side === 'player' && unit.star > 1 && <span className={styles.arenaStars}>{'★'.repeat(unit.star)}</span>}
              <span className={styles.healthTrack}><i style={{ width: `${Math.max(0, unit.health / unit.maxHealth * 100)}%` }} /></span>
              <small>{Math.max(0, Math.ceil(unit.health))} / {unit.maxHealth}</small>
            </div>
          )
        })}
      </div>
      <div className={`${styles.arenaEvent} ${currentEvent?.type === 'attack' || currentEvent?.type === 'defeat' ? styles.attackEvent : ''}`}>
        <span>{currentEvent?.type === 'move' ? '↗' : currentEvent?.type === 'heal' ? '✚' : currentEvent?.type === 'defeat' ? '✦' : '⚔'}</span>
        <p>{currentEvent?.text ?? 'The two sides approach each other…'}</p>
      </div>
      {finished && <div className={styles.arenaOutcome}>{result.won ? 'Victory' : 'Defeat'} · {state.lives} {state.lives === 1 ? 'life' : 'lives'} remain</div>}
    </section>
  )
}

function BattleReport() {
  const { state, commands } = useGame()
  const node = state.encounterNodeId ? nodeById[state.encounterNodeId] : undefined
  const result = state.battleResult
  if (!result) return null
  return (
    <section className={styles.pageSection}>
      <div className={`${styles.battleBanner} ${result.won ? styles.victoryBanner : styles.defeatBanner}`}>
        <span className={styles.battleBannerIcon}>{result.won ? '✦' : '☠'}</span>
        <div>
          <div className={styles.eyebrow}>{node?.region} · {result.rounds} rounds</div>
          <h1>{result.won ? 'Victory' : 'Defeat at ' + node?.name}</h1>
          <p>{result.won ? 'Your formation held. Claim your spoils and choose the next route.' : 'Your formation fell. Return to preparation and try a new arrangement.'}</p>
        </div>
        <div className={styles.bannerMark}>{result.won ? 'W' : 'R'}</div>
      </div>

      <div className={styles.reportGrid}>
        <section className={styles.reportPanel}>
          <div className={styles.panelTopline}><div><span className={styles.eyebrow}>Combat record</span><h2>Battle log</h2></div><span className={styles.roundPill}>{result.rounds} rounds</span></div>
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
          {result.won ? (
            <button className={styles.battleButton} type="button" onClick={commands.claimVictory}>Claim victory + 3 gold <b>→</b></button>
          ) : state.lives > 0 ? (
            <div className={styles.retryActions}>
              <p className={styles.mergeHint}>You lost a life and 2 gold. {state.lives} {state.lives === 1 ? 'life' : 'lives'} remain.</p>
              <button className={styles.battleButton} type="button" onClick={commands.retryBattle}>Return to preparation <b>↻</b></button>
              <button className={styles.textButton} type="button" onClick={commands.newRun}>Abandon campaign</button>
            </div>
          ) : (
            <div className={styles.retryActions}>
              <p className={styles.mergeHint}>No lives remain. This campaign is over.</p>
              <button className={styles.battleButton} type="button" onClick={commands.newRun}>Begin a new campaign <b>↻</b></button>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function RewardScreen() {
  const { state, commands } = useGame()
  const selectedCreature = state.selectedCreatureRewardId
  const selectedUpgrade = state.selectedUpgradeRewardId

  return (
    <section className={styles.pageSection}>
      <div className={styles.pageTitleRow}>
        <div><div className={styles.eyebrow}>Victory spoils · +3 gold</div><h1>Choose your rewards</h1><p className={styles.lede}>Take one creature for your roster and one upgrade for your vocation.</p></div>
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
                <span className={styles.rewardFamily}>{creature.family}</span>
                <div className={styles.tagRow}><Tag value={creature.bestiaryClass} /><RoleTag role={creature.role} /></div>
                <span className={styles.rewardSelect}>{selectedCreature === id ? 'Added to roster ✓' : 'Choose creature →'}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className={styles.rewardBlock}>
        <div className={styles.rewardHeading}><span>02</span><div><h2>Improve your vocation</h2><p>Choose an automatic combat upgrade.</p></div>{selectedUpgrade && <b className={styles.chosenMark}>✓ Chosen</b>}</div>
        <div className={styles.upgradeGrid}>
          {state.rewardUpgradeIds.map((id) => {
            const upgrade = upgradeByIdList().find((item) => item.id === id)
            if (!upgrade) return null
            return (
              <button className={`${styles.upgradeCard} ${selectedUpgrade === id ? styles.rewardSelected : ''}`} key={id} type="button" onClick={() => commands.chooseUpgradeReward(id)}>
                <span className={styles.upgradeIcon}>{upgrade.icon}</span>
                <strong>{upgrade.name}</strong>
                <p>{upgrade.description}</p>
                <span className={styles.rewardSelect}>{selectedUpgrade === id ? 'Upgrade chosen ✓' : 'Choose upgrade →'}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className={styles.rewardFooter}>Choose one creature and one upgrade to continue along the branching campaign.</div>
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
      <h1>{victory ? 'The paths are mended.' : 'The paths remain broken.'}</h1>
      <p>{victory ? `Your ${commander?.name ?? 'commander'} and their creatures survived the Shattered Paths.` : 'Build a different formation and try another route through the frontier.'}</p>
      <div className={styles.endStats}><span><b>{state.completedNodeIds.length}</b> encounters cleared</span><span><b>{state.roster.length}</b> creatures recruited</span></div>
      <button className={styles.battleButton} type="button" onClick={commands.newRun}>Begin a new campaign <b>→</b></button>
    </section>
  )
}

function Tag({ value }: { value: string }) {
  return <span className={styles.tag}>{value}</span>
}

const roleLabels: Record<Role, string> = { tank: 'Tank', shooter: 'Shooter', mage: 'Mage', healer: 'Healer' }

function RoleTag({ role }: { role: Role }) {
  return <span className={`${styles.tag} ${styles[`tag_${role}`]}`}>{roleLabels[role]}</span>
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

function GameScreen() {
  const { state } = useGame()
  const [showCodex, setShowCodex] = useState(false)
  const [battlePlayed, setBattlePlayed] = useState(false)
  useEffect(() => setBattlePlayed(false), [state.battleResult])
  return (
    <Shell onOpenCompendium={() => setShowCodex(true)}>
      {showCodex ? <CreatureCodex onBack={() => setShowCodex(false)} /> : <>
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
