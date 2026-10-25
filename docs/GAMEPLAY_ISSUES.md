# Gameplay Decisions and Open Questions

Decisions requested during the gameplay review and their implementation status. The coded rules are in [GAMEPLAY_REVIEW.md](GAMEPLAY_REVIEW.md); the player-facing version is available in the in-game Game wiki.

## Decisions implemented

- Use a 7×7 battle room and a three-row, seven-column player formation.
- Start each run with a deployment limit of five. A 5-gold Formation Permit raises the limit by one, up to 21.
- Grant every route reward only after the encounter is won. A loss grants nothing and allows a retry while lives remain.
- Treat Fighter as a first-class role. Cobra Assassin is a Fighter.
- Offer a fresh set of three vocation perks for each level-up. The player can choose the same perk more than once.
- Surface the gameplay rules in a Game wiki page in the app.

## One clarification

The campaign currently has three different final routes. Each route leads to a different final encounter, and all three count as a campaign victory. My earlier question was whether one route should be the single canonical story ending. No change is needed unless you want one ending to be canonical; the implementation currently treats the three endings equally.
