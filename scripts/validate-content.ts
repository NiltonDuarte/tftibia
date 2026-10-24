import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { validateGameContent } from '../src/content/schemas'

const files = {
  campaign: 'src/data/campaign.yaml',
  creatures: 'src/data/creatures.yaml',
  synergies: 'src/data/synergies.yaml',
  upgrades: 'src/data/upgrades.yaml',
  vocations: 'src/data/vocations.yaml',
} as const

const documents = await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, parse(await readFile(path, 'utf8'))] as const),
)

const content = validateGameContent(Object.fromEntries(documents))
console.info(
  `Validated ${content.creatures.creatures.length} creatures, ${content.synergies.synergies.length} synergies, and ${content.campaign.campaign.nodes.length} campaign nodes.`,
)
