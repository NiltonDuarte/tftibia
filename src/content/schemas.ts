import { z } from 'zod'

export const RoleSchema = z.enum(['tank', 'shooter', 'mage', 'healer'])
export const SynergyCategorySchema = z.enum(['role', 'family', 'bestiary'])

export const CreatureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  bestiaryClass: z.string().min(1),
  family: z.string().min(1),
  role: RoleSchema,
  cost: z.number().int().positive(),
  health: z.number().positive(),
  attack: z.number().positive(),
  armor: z.number().nonnegative(),
  range: z.number().int().positive(),
  image: z.string().startsWith('/'),
  description: z.string().min(1),
})

export const EffectsSchema = z
  .object({
    attackPct: z.number().optional(),
    healthPct: z.number().optional(),
    armorFlat: z.number().optional(),
    teamAttackPct: z.number().optional(),
    teamArmor: z.number().optional(),
    teamDamageReductionPct: z.number().optional(),
    firstAttackBonusPct: z.number().optional(),
    shooterAttackPct: z.number().optional(),
    shooterFirstAttackBonusPct: z.number().optional(),
    mageAttackPct: z.number().optional(),
    tankHealthPct: z.number().optional(),
    roundStartHeal: z.number().optional(),
    teamRoundStartHeal: z.number().optional(),
    healingFlat: z.number().optional(),
  })
  .default({})

export const CreatureDocumentSchema = z.object({ creatures: z.array(CreatureSchema).min(1) })

export const SynergySchema = z.object({
  id: z.string().min(1),
  category: SynergyCategorySchema,
  tag: z.string().min(1),
  label: z.string().min(1),
  breakpoints: z
    .array(
      z.object({
        count: z.number().int().positive(),
        title: z.string().min(1),
        description: z.string().min(1),
        effects: EffectsSchema,
      }),
    )
    .min(1),
})

export const SynergyDocumentSchema = z.object({ synergies: z.array(SynergySchema).min(1) })

export const VocationSchema = z.object({
  id: z.enum(['knight', 'paladin', 'sorcerer', 'druid']),
  name: z.string().min(1),
  title: z.string().min(1),
  icon: z.string().min(1),
  description: z.string().min(1),
  effect: EffectsSchema,
})

export const VocationDocumentSchema = z.object({ vocations: z.array(VocationSchema).length(4) })

export const UpgradeSchema = z.object({
  id: z.string().min(1),
  vocation: VocationSchema.shape.id,
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  effects: EffectsSchema,
})

export const UpgradeDocumentSchema = z.object({ upgrades: z.array(UpgradeSchema).min(1) })

export const CampaignNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  stage: z.number().int().nonnegative(),
  description: z.string().min(1),
  enemies: z.array(z.string()),
  nextNodeIds: z.array(z.string()),
})

export const CampaignSchema = z.object({
  title: z.string().min(1),
  startNodeId: z.string().min(1),
  startingGold: z.number().int().nonnegative(),
  startingCreatures: z.array(z.string()).min(1),
  boardCapacity: z.number().int().positive(),
  shopSize: z.number().int().positive(),
  nodes: z.array(CampaignNodeSchema).min(1),
})

export const CampaignDocumentSchema = z.object({ campaign: CampaignSchema })

export const GameContentSchema = z.object({
  creatures: CreatureDocumentSchema,
  synergies: SynergyDocumentSchema,
  vocations: VocationDocumentSchema,
  upgrades: UpgradeDocumentSchema,
  campaign: CampaignDocumentSchema,
})

export type GameContent = z.infer<typeof GameContentSchema>
export type Creature = z.infer<typeof CreatureSchema>
export type Synergy = z.infer<typeof SynergySchema>
export type Vocation = z.infer<typeof VocationSchema>
export type Upgrade = z.infer<typeof UpgradeSchema>
export type Effects = z.infer<typeof EffectsSchema>
export type Role = z.infer<typeof RoleSchema>
export type SynergyCategory = z.infer<typeof SynergyCategorySchema>

export function validateGameContent(input: unknown): GameContent {
  const content = GameContentSchema.parse(input)
  const creatureIds = new Set(content.creatures.creatures.map((creature) => creature.id))
  const nodeIds = new Set(content.campaign.campaign.nodes.map((node) => node.id))
  const upgradeIds = new Set(content.upgrades.upgrades.map((upgrade) => upgrade.id))

  if (creatureIds.size !== content.creatures.creatures.length) {
    throw new Error('Creature IDs must be unique.')
  }
  if (nodeIds.size !== content.campaign.campaign.nodes.length) {
    throw new Error('Campaign node IDs must be unique.')
  }
  if (upgradeIds.size !== content.upgrades.upgrades.length) {
    throw new Error('Upgrade IDs must be unique.')
  }

  const nodes = content.campaign.campaign.nodes
  for (const node of nodes) {
    for (const enemyId of node.enemies) {
      if (!creatureIds.has(enemyId)) {
        throw new Error(`Campaign node "${node.id}" references unknown creature "${enemyId}".`)
      }
    }
    for (const nextNodeId of node.nextNodeIds) {
      if (!nodeIds.has(nextNodeId)) {
        throw new Error(`Campaign node "${node.id}" references unknown route "${nextNodeId}".`)
      }
    }
  }

  const campaign = content.campaign.campaign
  if (!nodeIds.has(campaign.startNodeId)) {
    throw new Error(`Campaign start node "${campaign.startNodeId}" does not exist.`)
  }
  for (const creatureId of campaign.startingCreatures) {
    if (!creatureIds.has(creatureId)) {
      throw new Error(`Starting roster references unknown creature "${creatureId}".`)
    }
  }
  if (content.upgrades.upgrades.some((upgrade) => !content.vocations.vocations.some((v) => v.id === upgrade.vocation))) {
    throw new Error('Every upgrade must reference a known vocation.')
  }

  return content
}
