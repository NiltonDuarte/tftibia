import { parse } from 'yaml'
import campaignYaml from '../data/campaign.yaml?raw'
import creaturesYaml from '../data/creatures.yaml?raw'
import synergiesYaml from '../data/synergies.yaml?raw'
import upgradesYaml from '../data/upgrades.yaml?raw'
import vocationsYaml from '../data/vocations.yaml?raw'
import itemsYaml from '../data/items.yaml?raw'
import bossesYaml from '../data/bosses.yaml?raw'
import { validateGameContent } from './schemas'

export const content = validateGameContent({
  campaign: parse(campaignYaml),
  creatures: parse(creaturesYaml),
  synergies: parse(synergiesYaml),
  upgrades: parse(upgradesYaml),
  vocations: parse(vocationsYaml),
  items: parse(itemsYaml),
  bosses: parse(bossesYaml),
})

export const creatures = content.creatures.creatures
export const campaign = content.campaign.campaign
export const synergies = content.synergies.synergies
export const vocations = content.vocations.vocations
export const upgrades = content.upgrades.upgrades
export const items = content.items.items
export const bosses = content.bosses.bosses

export const creatureById = Object.fromEntries([...creatures, ...bosses].map((creature) => [creature.id, creature]))
export const bossById = Object.fromEntries(bosses.map((boss) => [boss.id, boss]))
export const nodeById = Object.fromEntries(campaign.nodes.map((node) => [node.id, node]))
export const vocationById = Object.fromEntries(vocations.map((vocation) => [vocation.id, vocation]))
export const upgradeById = Object.fromEntries(upgrades.map((upgrade) => [upgrade.id, upgrade]))
export const itemById = Object.fromEntries(items.map((item) => [item.id, item]))
