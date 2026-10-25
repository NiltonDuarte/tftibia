# Tibia Tactics — Game Design Scaffold

An auto-battler inspired by Teamfight Tactics, using Tibia creatures, creature groups, and vocations. This is an early design scaffold: the rules below are proposals to discuss, not final decisions.

## Core match concept

- The player chooses a vocation as their commander/character.
- The player recruits Tibia creatures and places them on a board.
- Creatures fight automatically; creature abilities are passive or trigger automatically. The player shapes the team through recruitment, positioning, upgrades, and synergy choices, not by manually activating creature abilities.
- Between rounds, the player gets opportunities to change the roster and prepare for the next campaign encounter.

**Decision:** Start with a PvE campaign.

## Synergy vocabulary

Each creature usually carries all three tags: Bestiary class, family, and role. Bestiary class and family overlap because every creature belongs to both. A synergy activates when the board has enough units sharing a tag. The same creature can contribute to all three synergies, so a roster can be built around overlapping themes.

### 1. Bestiary class

Use TibiaDraptor's Bestiary page as the reference for the game's existing Bestiary classes. Its **Class** filter exposes the class list, and creature entries display their assigned class (examples visible on the page include Construct, Demon, Human, Mammal, Plant, Aquatic, Bird, Humanoid, Magical, and Fey). Treat that source taxonomy as the starting point for our “bestiary” synergy tag, rather than inventing a parallel set of broad categories.

**Draft effect direction:** Bestiary synergies express a broad shared trait (for example, resilience, a damage type, or a small stat benefit). Since the class tag is broad and overlaps with family, require more units for these bonuses and keep their effects modest. That should encourage collecting creatures from different families rather than getting a large payoff from one family alone.

### 2. Families / creature groups

Named groups whose members are associated in Tibia, even when they do not fit one bestiary category. Examples from the initial pitch: Falcons, Cobras, Were-creatures, and Asuras.

**Draft effect direction:** family synergies express a signature tactic or group identity. They can activate with fewer units and have more distinctive effects than Bestiary bonuses.

### 3. Combat roles

- **Tank:** absorbs pressure, protects allies, or controls space.
- **Fighter:** melee attacker who benefits from fighting adjacent to a target.
- **Shooter:** deals physical damage from range.
- **Mage:** deals magical damage or area effects.
- **Healer:** restores health, shields, or otherwise sustains allies.

Roles help players understand what a creature does at a glance. A creature could have a primary role and, where useful, a secondary role.

## Initial synergy rules to consider

**Decision:** Synergy rewards mix stat bonuses and new abilities/rules, with a clear effect at each breakpoint. Proposed split: family synergies start around 2 / 3 units and offer more distinctive effects; broad Bestiary class synergies start around 3 / 5 / 7 and offer smaller, general effects. Tune these numbers to the board size and campaign recruit pool.

Potential guardrails for a first prototype:

- Prefer clear, readable effects over many small percentage bonuses.
- Let role synergies support team composition, while bestiary and family synergies give the roster its theme.
- Avoid making one creature count twice toward the same synergy unless that is an explicit, rare mechanic.
- Start with a small set of tags and a small creature roster; add breadth after the combinations are fun.

## Campaign pressure and formation rules

- **Prototype decision:** The first campaign spans eight encounters, with two route choices at each stage. The final branch ends the run.
- **Prototype decision:** The commander has three lives. A lost encounter costs one life and 2 gold; the player can retry while lives remain. Reaching zero lives ends the campaign.
- **Prototype decision:** Creatures outside attack range advance toward a target and cannot attack that turn. Frontline placement changes which enemies are closest, while range and lane occupancy determine when units can strike.
- **Prototype decision:** Recruits of the same creature can be held on the bench and merge automatically in groups of three at the same rank. Rank 2 and rank 3 creatures gain stronger combat stats. Only one creature of a given identity may be deployed at a time.
- **Prototype UI:** The creature codex lists the recruit pool with search and role/family filters.
- **Prototype decision:** The commander gains experience from encounters and route rewards. At 100 experience the commander levels up and chooses a vocation-specific perk from the reward pool.
- **Prototype decision:** Every campaign map offers three route rewards: a gold cache, an experience shrine, or a hunt with extra shop and creature offers. Routes use distinct room biomes and enemy groups that fit the biome.
- **Prototype decision:** Combat rooms use a centered 7×7 playable board over a square scenario image. The playable footprint covers 70% of the image; walls, water, props, and hazards remain outside it. Units can move across all seven rows; allies use cyan markers and enemies use coral markers. See [BATTLE_ART_PIPELINE.md](BATTLE_ART_PIPELINE.md).
- **Prototype decision:** Cobra Assassin is the first melee fighter. It has one-tile range and deals bonus damage when adjacent to a target.

These are initial difficulty and pacing levers. Tune the encounter curve, loss penalty, rank multipliers, XP pace, and route rewards through play.

## Vocation as the player's character

The vocation could shape the player's decisions without replacing the creature team. Candidate models:

1. **Commander ability:** each vocation has a passive or automatically triggered effect (e.g. Knight protects the frontline; Paladin marks a target; Sorcerer blasts an area; Druid heals or roots).
2. **Team-building identity:** vocation gives a modest bonus or special shop/recruiting option that encourages a style, without requiring it.
3. **Progression path:** vocation levels or chooses upgrades during a match, creating a build on top of the creature roster.
4. **Board support:** vocation is represented as a controllable or stationary unit on the board, with a risk/reward of exposing it.

**Decision:** Vocation is a commander ability plus in-run upgrades. The commander effect is passive or automatically triggered; combat does not require the player to press an ability button.

## Starter creature sample (research draft)

This sample is for exploring tag overlap, not a balanced or final recruit pool. **Bestiary class** is taken from TibiaDraptor creature entries/search-indexed results where available. **Family** is grouped from shared names or in-game group identity. **Role** is our game-design guess, informed by creature themes and attack styles; it is not a TibiaDraptor field.

| Creature | Bestiary class | Proposed family | Guessed role | Rationale / possible game identity |
|---|---|---|---|---|
| Dawnfire Asura | Demon | Asuri | Mage | Fire/energy-themed magic; ranged area damage. |
| Frost Flower Asura | Demon | Asuri | Shooter | Ice-associated ranged attacker; could slow enemies. |
| Midnight Asura | Demon | Asuri | Mage | Asuri spellcaster; could disrupt or weaken enemies. |
| True Feverbloom Asura | Demon | Asuri | Mage | Higher-tier Asura with fire/earth pressure; elite damage dealer. |
| Cobra Assassin | Human | Order of the Cobra | Fighter | Fast, stealthy melee striker who gains bonus damage while adjacent. |
| Cobra Scout | Human | Order of the Cobra | Shooter | Recon/ranged attacker; could reveal or weaken a target. |
| Cobra Vizier | Human | Order of the Cobra | Tank | Frontline protector; could use defensive magic or bodyguard effects to shield allies. |
| Falcon Knight | Undead | Order of the Falcon | Tank | Armored melee fighter; holds the frontline. |
| Falcon Paladin | Undead | Order of the Falcon | Shooter | Ranged fighter; deals damage from the backline. |
| Druid's Apparition | Undead | Goshnar's Apparitions | Healer | Automatically restores health to wounded allies. |

### Roster notes

- Each sample creature contributes to both its named family and its Bestiary class. For example, Asuri contribute to Asuri and Demon; Cobra units to Order of the Cobra and Human; Falcon units to Order of the Falcon and Undead.
- Confirm family membership and exact classes against the live Bestiary while expanding the roster.
- For a first campaign prototype, try family breakpoints at 2 / 3 and broad class breakpoints at 2 / 4 / 6.

### Possible first synergy effects (placeholders)

- **Demon:** at larger breakpoints, grant a small general bonus to magical damage or spell resistance.
- **Asuri:** at 2 / 3, apply a family mark; the second tier makes marked enemies take bonus damage.
- **Human:** at larger breakpoints, grant a small general defensive or resource bonus.
- **Order of the Cobra:** gain an ambush effect or bonus against isolated targets.
- **Undead:** at larger breakpoints, grant a small survivability or death-themed effect.
- **Order of the Falcon:** Falcon units defend each other or gain a formation bonus.

These are concept seeds. Keep broad class effects distinct from family effects so both tags remain useful.

## First design interview

Reply with your picks, or answer in your own words. We can decide one layer at a time.

1. **Campaign map:** Should branching routes show encounter rewards/recruit opportunities in advance, or should some branches be unknown until chosen?
2. **Recruiting:** Campaign rewards offer a choice of creatures. How often should the shop refresh?
3. **Vocation progression:** Should in-run upgrades be offered as a choice after encounters, or purchased in the shop?
4. **Synergy split:** Does the proposed family 2/3 and Bestiary 3/5/7 split fit your intent, or should Bestiary require even more units?

## Decisions and follow-ups

- **Chosen match structure:** PvE campaign
- **Chosen tag approach:** Most creatures have Bestiary class + family + role
- **Chosen synergy payoff:** Mix of stats and abilities/rules, with a clear effect per breakpoint
- **Chosen vocation model:** Commander ability + in-run upgrades
- **Chosen campaign map:** Branching encounters
- **Chosen recruitment scope:** Any creature can be recruited
- **Chosen recruitment sources:** Randomized shop pool + campaign rewards
- **Chosen campaign reward:** Player chooses from a selection of creatures
- **Chosen combat ability control:** Creature abilities are passive or automatic; no manual activations
- **Working synergy distinction:** Family is specific and stronger at lower counts; Bestiary class is broad and weaker at higher counts
- **Current implementation:** A playable eight-encounter campaign with three route choices between encounters, 10 sample creatures, 12 synergy definitions, four vocations, a three-row by seven-column player formation, and animated automatic combat on a 7×7 sqm room. The deployment limit starts at five and can be increased by buying Formation Permits in the shop. The game includes rank merges, commander XP/perks, three campaign lives, victory-only path rewards, and local saves. Every encounter offers distinct room themes; enemy groups follow their route's creature family or regional theme. Shop and recruit rewards draw from the full creature pool. Combat creatures occupy discrete tiles and step to neighboring tiles, including diagonals. Treat roles, combat numbers, and effects as balance placeholders.
- **Next design task:** Tune the encounter curve, three-copy merge bonuses, and positioning rules through play; then expand the creature pool.

## Balance test strategies

The balance lab simulates complete campaigns for every selected vocation, strategy, and seed. The default run uses 1,000 sequential seeds starting at 1. Each run records its win/loss, encounters played and cleared, lives, gold, and final roster size. Per-seed rows can be filtered, sorted, and exported as CSV; a grouped view reports win rate by vocation and strategy.

The strategy set uses deliberately different play patterns to expose balance across the implemented rules:

- **Random baseline:** Uses its own seeded random stream to choose routes, purchases, perk rewards, and formation. This supplies a noisy comparison point while remaining replayable.
- **Synergy builder:** Recruits toward role, family, and Bestiary breakpoints, then arranges units by frontline and backline roles.
- **Family stack:** Favors adding to the most represented creature family and activating family breakpoints.
- **Frontline wall:** Prioritizes tanks, fighters, healing, armor, and damage reduction, placing durable units forward.
- **Ranged burst:** Prioritizes shooters and mages, their range and attack effects, and relevant vocation bonuses.
- **Vocation specialist:** Drafts toward the selected Knight, Paladin, Sorcerer, or Druid passive and matching upgrades.

The game reducer and simulator share the same seeded state transitions and combat resolver. Each strategy has a separate seeded decision stream; the game seed controls shops and rewards. Re-running the same seed, vocation, and strategy reproduces the same campaign. These policies are diagnostic examples, not claims of optimal play.

## References

- [TibiaDraptor Bestiary](https://tibiadraptor.com/bestiary) — reference for Tibia creature data and the **Class** filter's Bestiary class list. The site may update over time; check the live filter when defining the roster.
- [TibiaDraptor Bestiary, indexed creature entries](https://tibiadraptor.com/bestiary?kills=5) — source for sample creature class labels. Family groupings and roles in the table are design interpretations, not source fields.
- [Tibia official controls manual](https://www.tibia.com/gameguides/?section=controls&subtopic=manual) — movement supports eight directions, including diagonals.
- [SQM definition](https://www.tibiawiki.com.br/wiki/SQM) — each character and creature occupies one sqm, even when its artwork appears larger.
