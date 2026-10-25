# Battle environment research

**Reviewed:** 2026-10-24

**Purpose:** Record the Tibia references and visual decisions behind battle-room art so future areas can be researched and added consistently.

## Search process

For a new region, search the exact location and its faction or creature family together. Prefer a location or quest page for landmarks, then a creature or bestiary page to verify who belongs there. Use in-game screenshots only to study composition, materials, lighting, and props. Do not copy screenshots or map layouts into the game.

Search queries used for this pass:

- `Tibia Cobra Bastion Ankrahmun desert fortress room snake columns basin`
- `Tibia Asura Palace Tiquanda jungle palace Forbidden Gardens`
- `Tibia Falcon Bastion Zao Steppe ruined castle underground`
- `Tibia Druid's Apparition Mirrored Nightmare mirror images`
- `Tibia Cobra Bastion screenshot`, `Tibia Asura Palace screenshot`, `Tibia Falcon Bastion screenshot`

## Findings translated into art direction

| Region / game theme | Tibia references | Visual elements used in the original battle scene |
|---|---|---|
| Ankrahmun / Cobra Bastion (`desert`) | [Cobra Bastion](https://tibia.fandom.com/wiki/Cobra_Bastion), [Ankrahmun](https://tibia.fandom.com/wiki/Ankrahmun), [Cobra Bastion screenshots](https://tibiaduality.com/pvp-cobra) | Sandstone fortress chamber, red serpent banners and columns, shallow ceremonial basins, weapons and torchlight. Warm sand and copper palette. |
| Tiquanda / Asura Palace (`garden`, `palace`) | [Asura Palace](https://tibia.fandom.com/wiki/Asura_Palace), [Tiquanda](https://tibia.fandom.com/wiki/Tiquanda), [Asura Palace screenshot reference](https://forums.tibiabr.com/threads/502252-Asura-Palace) | Opulent palace architecture within dense rainforest: gold-trimmed arches, vines, reflecting pools, water, and violet flowers. Emerald, teal, and gold palette. |
| Falcon Bastion / Falcon order (`bastion`, `hunt`) | [Falcon Bastion](https://tibia.fandom.com/wiki/Falcon_Bastion), [Falcon Knight](https://tibia.fandom.com/wiki/Falcon_Knight), [Falcon Bastion screenshots](https://tibiaduality.com/pt-quest-falcon) | Ruined stone castle and underground rooms, broken battlements, cracks, beams, faded banners, and cold mountain light. Slate, blue-gray, and restrained torch amber. |
| Mirrored Nightmare (`crypt`, `mirror`) | [Mirrored Nightmare](https://www.tibiawiki.com.br/wiki/Mirrored_Nightmare), [Druid's Apparition](https://tibia.fandom.com/wiki/Druid%27s_Apparition) | Distorted underground sacred spaces, mirror images, apparition reflections, ruined stone, and cold wind. Blue-black stone, indigo, and spectral cyan. |
| Fractured Deep (`deep`, `throne`) | Campaign-original region; the game name is not an official Tibia location. The [Mirrored Nightmare](https://www.tibiawiki.com.br/wiki/Mirrored_Nightmare) is a tonal reference only. | A new final arena: cracked obsidian, a distant empty throne, floating fragments, blue fissures, and small braziers. This is an original campaign synthesis rather than a claim about Tibia canon. |

The pages above establish locations, factions, and broad landmarks; specific room arrangements in the generated scenes are original. The reference screenshots were not copied into the project. Battle scenes use a fixed square canvas and a reserved central 7×7 playfield. See [BATTLE_ART_PIPELINE.md](BATTLE_ART_PIPELINE.md) for the guide, dimensions, prompt pattern, and rendering rules.

## Asset mapping

| Campaign theme | Local battle background |
|---|---|
| `desert` | `public/assets/backgrounds/battle/cobra-bastion.png` |
| `garden`, `palace` | `public/assets/backgrounds/battle/asura-palace.png` |
| `bastion`, `hunt` | `public/assets/backgrounds/battle/falcon-bastion.png` |
| `crypt`, `mirror` | `public/assets/backgrounds/battle/mirrored-crypt.png` |
| `deep`, `throne` | `public/assets/backgrounds/battle/fractured-throne.png` |
| `crossroads` | No battle encounter; keep the neutral campaign art. |

To add a region: verify its location and residents, note its distinct architectural and environmental features, follow [BATTLE_ART_PIPELINE.md](BATTLE_ART_PIPELINE.md), map its campaign theme in `src/App.module.css`, and add its sources here.
