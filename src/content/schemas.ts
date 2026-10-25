import { z } from 'zod'

export const RoleSchema = z.enum(['tank', 'fighter', 'shooter', 'mage', 'healer'])
export const EquipmentSlotSchema = z.enum(['amulet', 'weapon', 'head', 'body', 'legs', 'shield'])
export const GameItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  bossId: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  slot: EquipmentSlotSchema,
  allowedRoles: z.array(RoleSchema),
  universal: z.boolean().default(false),
  image: z.string().optional(),
  description: z.string().min(1),
  tibiaStats: z.object({
    sourceClasses: z.array(z.enum(['knight', 'paladin', 'sorcerer', 'druid', 'monk', 'all'])).default([]),
    requiredLevel: z.number().int().nonnegative().optional(),
    attack: z.number().nonnegative().optional(),
    elementalAttack: z.number().nonnegative().optional(),
    element: z.enum(['physical', 'fire', 'ice', 'energy', 'earth', 'death', 'holy']).optional(),
    averageAttack: z.number().nonnegative().optional(),
    defense: z.number().nonnegative().optional(),
    defenseBonus: z.number().nonnegative().optional(),
    armor: z.number().nonnegative().optional(),
    range: z.number().nonnegative().optional(),
    hitPercent: z.number().optional(),
    weaponHands: z.union([z.literal(1), z.literal(2)]).optional(),
    skillBonuses: z.record(z.string(), z.number()).default({}),
    protectionPercent: z.record(z.string(), z.number()).default({}),
    magicLevel: z.number().optional(),
    elementMagicLevel: z.record(z.string(), z.number()).default({}),
    criticalChancePercent: z.number().nonnegative().optional(),
    criticalExtraDamagePercent: z.number().nonnegative().optional(),
    lifeLeechChancePercent: z.number().nonnegative().optional(),
    lifeLeechAmountPercent: z.number().nonnegative().optional(),
    durationMinutes: z.number().positive().optional(),
    weightOz: z.number().nonnegative().optional(),
  }),
})
export const ItemDocumentSchema = z.object({ items: z.array(GameItemSchema).min(1) })
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
  image: z.string().refine((value) => value.startsWith('/') || z.string().url().safeParse(value).success),
  description: z.string().min(1),
})

export const BossSchema = CreatureSchema.extend({
  id: z.enum(['scarlett-etzel', 'grand-master-oberon', 'moonsnow-magnolia', 'ferumbras']),
  spriteSource: z.string().url(),
})
export const BossDocumentSchema = z.object({ bosses: z.array(BossSchema).length(4) })

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
    fighterAttackPct: z.number().optional(),
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
  bossId: z.enum(['scarlett-etzel', 'grand-master-oberon', 'moonsnow-magnolia', 'ferumbras']).nullable().default(null),
  bossSprite: z.string().refine((value) => value.startsWith('/') || z.string().url().safeParse(value).success).optional(),
  theme: z.enum(['crossroads', 'garden', 'desert', 'bastion', 'crypt', 'palace', 'mirror', 'deep', 'throne', 'hunt']),
  routeReward: z.enum(['gold', 'experience', 'recruit']),
  rewardGold: z.number().int().nonnegative(),
  rewardExperience: z.number().int().nonnegative(),
  shopBonus: z.number().int().nonnegative(),
  creatureOfferCount: z.number().int().positive(),
  description: z.string().min(1),
  enemies: z.array(z.string()),
  nextNodeIds: z.array(z.string()),
})

export const CampaignSchema = z.object({
  title: z.string().min(1),
  startNodeId: z.string().min(1),
  startingGold: z.number().int().nonnegative(),
  startingCreatures: z.array(z.string()),
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
  items: ItemDocumentSchema,
  bosses: BossDocumentSchema,
})

export type GameContent = z.infer<typeof GameContentSchema>
export type Creature = z.infer<typeof CreatureSchema>
export type Boss = z.infer<typeof BossSchema>
export type Synergy = z.infer<typeof SynergySchema>
export type Vocation = z.infer<typeof VocationSchema>
export type Upgrade = z.infer<typeof UpgradeSchema>
export type Effects = z.infer<typeof EffectsSchema>
export type Role = z.infer<typeof RoleSchema>
export type GameItem = z.infer<typeof GameItemSchema>
export type SynergyCategory = z.infer<typeof SynergyCategorySchema>

export function validateGameContent(input: unknown): GameContent {
  const content = GameContentSchema.parse(input)
  const creatureIds = new Set(content.creatures.creatures.map((creature) => creature.id))
  const nodeIds = new Set(content.campaign.campaign.nodes.map((node) => node.id))
  const upgradeIds = new Set(content.upgrades.upgrades.map((upgrade) => upgrade.id))
  const itemIds = new Set(content.items.items.map((item) => item.id))
  const bossIds = new Set<string>(content.campaign.campaign.nodes.flatMap((node) => node.bossId ? [node.bossId] : []))
  const bossRecordIds = new Set<string>(content.bosses.bosses.map((boss) => boss.id))

  if (creatureIds.size !== content.creatures.creatures.length) {
    throw new Error('Creature IDs must be unique.')
  }
  if (nodeIds.size !== content.campaign.campaign.nodes.length) {
    throw new Error('Campaign node IDs must be unique.')
  }
  if (upgradeIds.size !== content.upgrades.upgrades.length) {
    throw new Error('Upgrade IDs must be unique.')
  }
  if (itemIds.size !== content.items.items.length) throw new Error('Item IDs must be unique.')
  if (bossRecordIds.size !== content.bosses.bosses.length || content.creatures.creatures.some((creature) => bossRecordIds.has(creature.id))) {
    throw new Error('Boss IDs must be unique and cannot overlap recruit creature IDs.')
  }
  for (const bossId of bossIds) {
    if (!bossRecordIds.has(bossId)) throw new Error(`Campaign references missing boss "${bossId}".`)
  }
  for (const item of content.items.items) {
    if (!bossRecordIds.has(item.bossId)) throw new Error(`Item "${item.id}" references unknown boss "${item.bossId}".`)
    if (!item.universal && item.allowedRoles.length === 0) throw new Error(`Restricted item "${item.id}" must allow at least one role.`)
  }
  if (content.items.items.some((item) => item.universal && item.allowedRoles.length > 0)) {
    throw new Error('Universal items must not also list role restrictions.')
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
