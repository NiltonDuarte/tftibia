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
2. Choose between two routes across an eight-encounter branching campaign. You have three lives; losses cost a life and gold.
3. Recruit from the randomized shop and arrange a formation of up to six creatures.
4. Repeated recruits merge automatically in groups of three. Only one copy of a creature can be deployed at a time.
5. Watch the animated battle board: units move when targets are out of range, and lanes/positions affect targeting.
6. Choose a creature and vocation upgrade after victory; campaign progress is saved in browser storage.

Use **Creature codex** in the top bar to browse the current recruit pool by name, family, and role.

Creature, synergy, vocation, upgrade, and campaign content is stored in `src/data/*.yaml`. It is checked by Zod during build validation and when loaded in the browser. Creature image sources are listed in [ASSET_SOURCES.md](ASSET_SOURCES.md).
