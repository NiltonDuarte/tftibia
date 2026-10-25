# Battle background art pipeline

## Authoritative playable footprint

Every battle image uses the same square, top-down canvas and the same centered playable footprint. The authoritative reference is [`docs/art/battle-grid-guide.png`](docs/art/battle-grid-guide.png): a 7-column by 7-row square covering 70% of the canvas, with equal margins on all four sides. Preserve the guide's proportions when generating at a different square resolution.

The play area is the square under the guide. The other 30% of the canvas is scenario space for walls, water, garden beds, furniture, doors, and other non-playable elements. Keep all of those elements outside the 7×7 footprint. Do not change the footprint to fit a particular scene; compose the scene around it.

## Generate a background

1. Start with a square canvas and the battle-grid guide as the composition reference. Keep a copy of the guide visible over the art during composition checks.
2. Generate a full-frame, orthographic top-down room in Tibia-inspired pixel art. The central 70% square must be open, continuous, walkable floor with a plain, low-detail surface. Avoid obvious tile seams, square patterns, or any repeated floor marks that could conflict with the 7×7 runtime grid. Put walls, water, vegetation, furniture, hazards, and other blocking scenery in the outer margins.
3. Match location materials and props to the encounter. Keep the visual density low enough that combat sprites, labels, and effects remain readable over every cell.
4. Do not draw the guide, a grid, tile boundaries, board outlines, text, labels, characters, or UI into the exported image. The grid is a runtime analysis overlay, not part of the background.
5. Export a square PNG. Do not crop or stretch a non-square result to make it square; regenerate or recompose it on the square canvas.
6. Save as a new versioned file in `public/assets/backgrounds/battle/` and map it in `src/App.module.css`. Keep earlier art until the replacement is reviewed and accepted.

### Prompt template

> Create a square, full-frame, orthographic top-down pixel-art battle room for a Tibia-inspired browser game. Use the attached battle-grid guide only as a composition reference: keep the centered square area occupying the middle 70% of the canvas completely open and walkable, sized for a 7×7 combat grid. The play area floor must be plain, continuous, and low-detail, with no visible tile seams, square patterns, or repeated marks. All walls, water, plants, furniture, hazards, and other obstacles must stay outside that square. Continue the room naturally through the outer margins. Match the requested location's architecture and palette. No grid lines, tile boundaries, board border, text, labels, characters, interface, or watermark. Export as a square image.

Append the location-specific architectural materials, palette, and landmark props to the prompt. Do not alter the footprint instructions.

## Acceptance checklist

- [ ] PNG is square; it is not a stretched or cropped landscape image.
- [ ] The guide overlays the generated image with the grid centered and the same 70% square bounds.
- [ ] All 49 cells contain continuous plain, low-detail walkable floor; no tile seams, square patterns, water, walls, garden beds, furniture, hazards, or other blocking objects cross into the playable square.
- [ ] The play area is large enough for 7×7 cells and leaves room for creature sprites and labels.
- [ ] No grid, board, text, UI, or characters are baked into the image.
- [ ] With the in-game **Grid: on** toggle enabled, all four sides of the runtime grid match the guide and sit entirely on open floor.
- [ ] Scene remains legible at desktop and mobile display sizes.

Reject and regenerate any image that fails a check. Do not compensate with per-image runtime insets or background stretching.

## Runtime and validation

Battle PNGs are mapped by theme in `src/App.module.css`. The `.arenaGrid` background and `.sqmBoard` must both be square; the latter is centered at 15% inset on every side. Combat remains a 7×7 logical board. The analysis toggle shows the actual runtime SQM boundaries without adding floor texture or changing combat behavior.

`npm run validate:battle-art` checks that every mapped battle background is a square PNG. Build runs this validation. The check catches dimension mismatches; a person must still review floor clearance and alignment with the guide using the analysis toggle.
