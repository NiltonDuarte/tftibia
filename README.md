# Tibia Tactics

A browser auto-battler prototype inspired by Tibia. Choose a vocation, recruit creatures, build overlapping Bestiary/family/role synergies, and fight through branching PvE encounters.

## Run locally

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev
```

## Current MVP loop

1. Choose a vocation and its automatic commander effect.
2. Choose between three themed routes across an eight-encounter branching campaign: a gold cache, an experience shrine, or a hunting route with extra shop offers. You have three lives; losses cost a life and gold.
3. Recruit from the randomized shop and arrange a formation of up to six creatures.
4. Repeated recruits merge automatically in groups of three. Only one copy of a creature can be deployed at a time.
5. Watch the animated battle board: each creature occupies one tile on a 7×7 sqm room and moves only between neighboring tiles, including diagonals. Position affects targeting.
6. Earn commander experience. Each level unlocks a choice of a vocation perk; choose a creature after every victory.

Use **Creature codex** in the top bar to browse the current recruit pool by name, family, and role.

Creature, synergy, vocation, upgrade, and campaign content is stored in `src/data/*.yaml`. It is checked by Zod during build validation and when loaded in the browser. Creature image sources are listed in [ASSET_SOURCES.md](ASSET_SOURCES.md).
