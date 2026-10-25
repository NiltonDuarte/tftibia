# Battle room art

Battle scenes are full-frame, top-down rooms inspired by Tibia's map tiles. They provide the visible floor, walls, water, and props across the complete square battlefield. The game places its 7×7 combatants over the room as a transparent coordinate layer; it does not draw a second floor, tile seams, or a board frame.

## Art requirements

- Use a square image and show the room edge to edge.
- Keep the central floor mostly open so combatants and effects remain readable.
- Use repeated square floor tiles and crisp overhead props to evoke Tibia's client view.
- Put walls, furniture, plants, water, and hazards around the room with clear edges and walkable gaps.
- Match each hunt to its own location: Falcon Castle uses gray stone corridors and sparse military props; Cobra Bastion uses pale sand, red masonry, and serpent details; Asura Palace uses cream palace tiles, garden beds, fountains, and red floor hazards.
- Do not add a 7×7 board outline, a centered inset square, a checkerboard, interface panels, labels, or characters.

## Runtime mapping

Images live in `public/assets/backgrounds/battle/` and are mapped by campaign theme in `src/App.module.css`. `.sqmBoard` fills the entire `.arenaGrid` but has no visible floor styling. Its seven columns and rows still place combatants consistently over the room art. Keep unit names, health indicators, and combat effects above the scenery.

Check the room at desktop and mobile sizes. Confirm the whole scene remains visible, combatants use the full field, labels stay readable, and the background is not covered by opaque tiles.
