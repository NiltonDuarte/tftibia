# Battle background pipeline

This process separates scenery from gameplay geometry. Generated images provide the room around the arena; React/CSS owns the actual SQM surface and unit coordinates.

## Fixed layout

- Guide image: `docs/art/battle-grid-guide.png`
- Guide generator: `scripts/generate-battle-art-guide.mjs`
- Canvas: 1280 × 1280 px, square
- Playfield: x=192, y=192, width=896, height=896 px
- Tile size: 128 × 128 px, seven columns by seven rows
- Normalized playfield bounds: 15% on every side

The browser scales each scene to the square arena canvas. The `.sqmBoard` uses those same normalized bounds. Its opaque, theme-colored tiles cover the guide area in the image, so generated seams and floor details cannot shift or double up with the live grid. Creature positions are percentages within this `.sqmBoard`.

## Generate a regional background

1. Recreate the guide with `node scripts/generate-battle-art-guide.mjs` if its layout needs updating. Treat a layout change as a gameplay coordinate change too.
2. Submit the guide PNG as the image reference to the image generator.
3. Keep the canvas square. Describe the regional walls, plants, lighting, stairs, banners, and props in the outside margins. Require a clear, empty central board and no props crossing into it.
4. Copy the result to `public/assets/backgrounds/battle/<stable-region-slug>.png`. Do not crop or reposition it. The generated source may include a guide grid; the runtime tile layer covers it.
5. Map the campaign theme to that image in `src/App.module.css`. Keep the source as `background-size: 100% 100%`; no per-image zoom or background-position adjustments.
6. Inspect the battle at desktop and mobile sizes. Confirm the visible board is seven columns by seven rows, each creature stays inside one SQM while moving, and perimeter scenery remains outside the playfield.

## Prompt pattern

> Paint an original [region] battle-room background from this exact composition guide. Keep the square aspect ratio and exact layout: the centered 7-column by 7-row square-tile playfield is 70% of the image width and height. Preserve its placement. Keep the center empty and unobstructed. Place all regional environment storytelling in the outer margins only. No creatures, text, UI, columns, stairs, foliage, props, or shadows should cross into the board. [Describe landmarks, materials, atmosphere, palette, and pixel-art treatment.] No title, logo, inset frame, or HUD.

The center of the generated image is only a composition guide. The game renders the authoritative stone SQMs over it. Do not rely on AI-generated tile edges for alignment.
