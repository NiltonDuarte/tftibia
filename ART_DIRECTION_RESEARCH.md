# Battle environment research

**Reviewed:** 2026-10-25

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
| Ankrahmun / Cobra Bastion (`desert`) | [Cobra Bastion](https://tibia.fandom.com/wiki/Cobra_Bastion), [Cobra Bastion quest screenshots](https://www.tibialife.com.br/grave-danger-parte-2-the-order-of-the-cobra-su19/), [Cobra Bastion tomb screenshot](https://www.tibiawiki.com.br/index.php?stableid=303553&title=Arquivo%3ATumba_Cobra_Bastion.png) | The supplied reference shows a sandy courtyard with red-orange masonry, patterned stone inset, palms, urns, and wall torches. Preserve this tiled, compact overhead room language; use serpent banners and copper accents sparingly. Current image: `cobra-bastion-v2.png`. |
| Tiquanda / Asura Palace (`garden`, `palace`) | [Asura Palace hunt screenshots](https://forums.tibiabr.com/threads/502252-Asura-Palace), [Asura Palace creatures](https://www.tibiaanalyzer.com.br/en/hunt/asura-palace) | Keep Asura's cream palace stone, blue fountains, and lush garden details in the outer margins. The central playable area is a plain, low-detail sandstone floor with no square tile seams or repeated marks, so it cannot visually conflict with the 7×7 gameplay grid. Current image: `asura-palace-v4.png`. |
| Falcon Bastion / Falcon order (`bastion`, `hunt`) | [Falcon Bastion overview](https://tibia.fandom.com/wiki/Falcon_Bastion), [Falcon Bastion quest screenshots](https://tibiaduality.com/pt-quest-falcon) | The supplied reference shows a close gray flagstone corridor, adjoining rooms, a water channel, and a short wooden bridge. Favor small connected stone rooms, restrained wood and weapon props, and little open empty space. Current image: `falcon-bastion-v2.png`. |
| Mirrored Nightmare (`crypt`, `mirror`) | [Mirrored Nightmare](https://www.tibiawiki.com.br/wiki/Mirrored_Nightmare), [Druid's Apparition](https://tibia.fandom.com/wiki/Druid%27s_Apparition) | Distorted underground sacred spaces, mirror images, apparition reflections, ruined stone, and cold wind. Blue-black stone, indigo, and spectral cyan. The playable floor uses detailed irregular cobbles without obvious square seams, following the Falcon Castle floor treatment. Current image: `mirrored-crypt-v3.png`. |
| Fractured Deep (`deep`, `throne`) | Campaign-original region; the game name is not an official Tibia location. The [Mirrored Nightmare](https://www.tibiawiki.com.br/wiki/Mirrored_Nightmare) is a tonal reference only. | A new final arena: cracked obsidian, a distant empty throne, floating fragments, blue fissures, and small braziers. This is an original campaign synthesis rather than a claim about Tibia canon. Current image: `fractured-throne-v2.png`. |

These screenshots are references for real Tibia tile language: square floor tiles, overhead walls and props, and recognizable place-specific landmarks. The attached screenshots and online references were not copied into the project. The location scenes are original interpretations. The tactical grid is a centered 7×7 square covering 70% of every battle image; the surrounding margin is scenario art and must remain outside the playable area. See [BATTLE_ART_PIPELINE.md](BATTLE_ART_PIPELINE.md) for the generation and validation rules.

## Asset mapping

| Campaign theme | Local battle background |
|---|---|
| `desert` | `public/assets/backgrounds/battle/cobra-bastion-v2.png` |
| `garden`, `palace` | `public/assets/backgrounds/battle/asura-palace-v4.png` |
| `bastion`, `hunt` | `public/assets/backgrounds/battle/falcon-bastion-v2.png` |
| `crypt`, `mirror` | `public/assets/backgrounds/battle/mirrored-crypt-v3.png` |
| `deep`, `throne` | `public/assets/backgrounds/battle/fractured-throne-v2.png` |
| `crossroads` | No battle encounter; keep the neutral campaign art. |

To add a region: verify its location and residents, note its distinct architectural and environmental features, generate a square background using the shared 70% guide footprint, pass `npm run validate:battle-art`, visually review it with the in-game grid toggle, map its campaign theme in `src/App.module.css`, and add its sources here. The original unversioned battle images remain as unused drafts; the game maps the aligned `-v2` images.
