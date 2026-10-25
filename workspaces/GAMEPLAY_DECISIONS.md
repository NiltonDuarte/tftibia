# Gameplay Feature Decisions

Living decision record for bosses, equipment, loot, and campaign-map generation. Update this file as decisions are made so implementation and design stay aligned.

## Confirmed

- Boss assignments: Order of the Cobra → Scarlett Etzel; Order of the Falcon → Grand Master Oberon; Asuri → The Moonsnow Magnolia.
- Bosses appear at fixed milestones in a ten-encounter run: family bosses at encounters 3, 6, and 9; Ferumbras is the canonical final boss at encounter 10. Defeating Ferumbras ends the campaign without loot or a rewards phase.
- Family bosses are the only source of equipment. Every family-boss victory offers one player-chosen item from that boss's eligible pool. Losses grant no rewards and allow a retry.
- Item metadata and real Tibia item stats are stored in YAML and adapted into game combat stats.
- Item role mappings: Druid → Healer; Sorcerer → Mage; Paladin → Shooter; Monk → Fighter. Knight armor and amulets can be used by Tank or Fighter; Knight weapons of either hand type and shields are Tank-only. The Cobra Amulet is universal.
- Creatures can equip one item per equipment slot. Items move freely between the backpack and creatures.
- The ten-encounter map is generated from a seeded random sparse graph, shows encounter and reward information before selection, uses two options on regular layers and all three family-boss options at boss milestones, and leads to one Ferumbras final node. All intermediate nodes are connected without dead ends.
- Boss sprites are sourced from TibiaDraptor's Bosstiary; item details and drops are sourced from the specified TibiaWiki pages.

## Research status

- Confirmed TibiaDraptor sprite URLs (all return PNG):
  - Scarlett Etzel: `https://tibiadraptor.com/images/bosses/Scarlett_Etzel.png`
  - Grand Master Oberon: `https://tibiadraptor.com/images/bosses/Grand_Master_Oberon.png`
  - The Moonsnow Magnolia: `https://tibiadraptor.com/images/bosses/The_Moonsnow_Magnolia.png`
  - Ferumbras: `https://tibiadraptor.com/images/bosses/Ferumbras.png`
- Drop pages checked: [Scarlett Etzel](https://www.tibiawiki.com.br/wiki/Scarlett_Etzel), [Grand Master Oberon](https://www.tibiawiki.com.br/wiki/Grand_Master_Oberon), [The Moonsnow Magnolia](https://www.tibiawiki.com.br/index.php?stable=1&title=The_Moonsnow_Magnolia).
- Magnolia amulet drops documented by the source: Enchanted Flamingo Amulets of Destruction (Sorcerer), Nature (Druid), Precision (Paladin), Valor (Knight), and Enchanted Swan Amulet of Balance (Monk). These map to Mage, Healer, Shooter, Tank/Fighter, and Fighter respectively.
- Oberon's Falcon-family loot includes Falcon Battleaxe, Longsword, Mace, Bow, Circlet, Coif, Rod, Wand, Greaves, Plate, Sai, Shield, and Grant of Arms. Item pages identify Paladin and Monk restrictions as well as the requested Druid/Sorcerer/Knight classes.
- Scarlett's Cobra-family loot includes Cobra Axe, Club, Bo, Crossbow, Hood, Rod, Sword, Wand, and The Cobra Amulet. Item pages likewise include Monk/Paladin-only gear, and The Cobra Amulet is class-unrestricted.
- These item-role mappings intentionally adapt Tibia vocations to this game's roles as directed by the player. Grant of Arms is not equippable equipment, so it is omitted from the item pool.
- Item-page checks confirm Cobra Axe and Cobra Club are one-handed Knight weapons, Cobra Hood is Knight-only, Cobra Crossbow is a two-handed Paladin weapon, Cobra Rod is Druid-only, Cobra Wand is Sorcerer-only, Falcon Battleaxe and Falcon Longsword are two-handed Knight weapons, Falcon Mace is one-handed Knight gear, Falcon Bow is a two-handed Paladin weapon, Falcon Circlet is Sorcerer/Druid gear, and Falcon Greaves is Knight/Paladin gear. The agreed game mapping takes precedence over Tibia's original hand restriction.
- Item page references checked include [Cobra Axe](https://www.tibiawiki.com.br/wiki/Cobra_Axe), [Cobra Hood](https://www.tibiawiki.com.br/wiki/Cobra_Hood), [Cobra Club](https://www.tibiawiki.com.br/wiki/Cobra_Club), [Cobra Crossbow](https://www.tibiawiki.com.br/wiki/Cobra_Crossbow), [Cobra Rod](https://www.tibiawiki.com.br/wiki/Cobra_Rod), [Cobra Wand](https://www.tibiawiki.com.br/wiki/Cobra_Wand), [Falcon Battleaxe](https://www.tibiawiki.com.br/wiki/Falcon_Battleaxe), [Falcon Longsword](https://www.tibiawiki.com.br/wiki/Falcon_Longsword), [Falcon Mace](https://www.tibiawiki.com.br/wiki/Falcon_Mace), [Falcon Bow](https://www.tibiawiki.com.br/wiki/Falcon_Bow), [Falcon Circlet](https://www.tibiawiki.com.br/wiki/Falcon_Circlet), and [Falcon Greaves](https://www.tibiawiki.com.br/wiki/Falcon_Greaves).
- Item data now stores 26 boss drops with their source item page, source class, vocation level, item slot, weapon hand count where relevant, and Tibia combat statistics. These include all five Magnolia amulets, Falcon equipment, Cobra equipment, and The Cobra Amulet.
- Ferumbras's page lists equipment, but the player confirmed that the run ends on his defeat and no final-boss loot is needed.
- Each victory against one of the three family bosses randomly drops one item from that boss's eligible pool and adds it to the backpack automatically. Defeating Ferumbras ends the campaign without loot or a rewards phase.
