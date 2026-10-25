# Creature asset sources

Creature portraits in `public/assets/creatures/` were downloaded from the TibiaDraptor Bestiary image directory on 2026-10-24. The game loads these local PNG copies and does not request creature art from TibiaDraptor at runtime.

The regional triptych in `public/assets/backgrounds/region-triptych.png` is original AI-generated pixel-art environment art used by the campaign and vocation screens.

The battle backgrounds in `public/assets/backgrounds/battle/` are original environment scenes made for this project and informed by Tibia location screenshots. The runtime draws combatants over the full room through a transparent 7×7 coordinate layer. Art and rendering rules are documented in [BATTLE_ART_PIPELINE.md](BATTLE_ART_PIPELINE.md); reference research is in [ART_DIRECTION_RESEARCH.md](ART_DIRECTION_RESEARCH.md). No Tibia screenshots or map layouts are bundled.

The item sprites in `public/assets/items/` are local 32×32 copies from the item file pages on Tibia Wiki. Each item's data entry links to its source page and references the corresponding local image.

Boss portraits in `public/assets/bosses/` are local 64×64 copies from TibiaDraptor's Bosstiary image directory. Boss data keeps the source URL for attribution; gameplay uses the local image paths.

| Local file | TibiaDraptor source |
|---|---|
| `dawnfire-asura.png` | [Dawnfire Asura](https://tibiadraptor.com/images/monsters/Dawnfire_Asura.png) |
| `frost-flower-asura.png` | [Frost Flower Asura](https://tibiadraptor.com/images/monsters/Frost_Flower_Asura.png) |
| `midnight-asura.png` | [Midnight Asura](https://tibiadraptor.com/images/monsters/Midnight_Asura.png) |
| `true-feverbloom-asura.png` | [True Feverbloom Asura](https://tibiadraptor.com/images/monsters/True_Feverbloom_Asura.png) |
| `cobra-assassin.png` | [Cobra Assassin](https://tibiadraptor.com/images/monsters/Cobra_Assassin.png) |
| `cobra-scout.png` | [Cobra Scout](https://tibiadraptor.com/images/monsters/Cobra_Scout.png) |
| `cobra-vizier.png` | [Cobra Vizier](https://tibiadraptor.com/images/monsters/Cobra_Vizier.png) |
| `falcon-knight.png` | [Falcon Knight](https://tibiadraptor.com/images/monsters/Falcon_Knight.png) |
| `falcon-paladin.png` | [Falcon Paladin](https://tibiadraptor.com/images/monsters/Falcon_Paladin.png) |
| `druids-apparition.png` | [Druid's Apparition](https://tibiadraptor.com/images/monsters/Druid%27s_Apparition.png) |

| Local boss file | TibiaDraptor source |
|---|---|
| `scarlett-etzel.png` | [Scarlett Etzel](https://tibiadraptor.com/images/bosses/Scarlett_Etzel.png) |
| `grand-master-oberon.png` | [Grand Master Oberon](https://tibiadraptor.com/images/bosses/Grand_Master_Oberon.png) |
| `moonsnow-magnolia.png` | [The Moonsnow Magnolia](https://tibiadraptor.com/images/bosses/The_Moonsnow_Magnolia.png) |
| `ferumbras.png` | [Ferumbras](https://tibiadraptor.com/images/bosses/Ferumbras.png) |
