# Tibia Tactics UI direction

This guide captures a visual direction for the campaign screens. Tibia’s own interface and vocabulary are the primary creative references: they give the game its identity and should be recognizable in the way we frame information, name places and systems, and present creatures. The browser game should feel like a campaign running inside the Tibia client: a central play area framed by compact status, list, and control windows. Keep that identity while making decisions, costs, combat outcomes, and navigation easier to scan. Treat it as a working reference for the UI revamp.

## Reference shelf

- [Tibia official interface guide](https://www.tibia.com/gameguides/?section=interface&subtopic=manual) — primary reference for Tibia’s interface identity, information vocabulary, and concepts such as the minimap, Bestiary, and Cyclopedia. Preserve familiar Tibia names where the game uses those concepts, and use Tibia’s own terminology as the naming baseline for new related features. Its movable, dense client layout is not a browser layout template: carry over its identity and useful ideas, then organize them for readable web screens.
- [Interface In Game screenshots](https://interfaceingame.com/screenshots/) — comparative reference for menus, maps, inventory, progression, and in-game screens. Use it to study solutions for each screen job and gather interaction/layout ideas; it should inform execution, not replace Tibia as the source of the game's visual and naming identity.
- [Albion Online references in Interface In Game](https://interfaceingame.com/games/albion-online/) — review the World Map and Details/Inventory captures for how a game view stays central while map, stats, and inventory information sit in compact adjacent windows. Borrow the composition and information grouping only; keep Tibia's own colors, icon language, and terminology.
- [Xbox Accessibility Guidelines](https://learn.microsoft.com/gaming/accessibility/guidelines) — use guidelines for readable text, contrast, multiple ways to communicate state, UI navigation, and visible focus.
- [Material Design typography: Applying type](https://m3.material.io/styles/typography/applying-type) — use its display/headline/title/body/label roles and line-height guidance as a readability reference; do not adopt its visual style.

## Screen jobs and reference searches

| Screen | Player's question | Collect references for |
| --- | --- | --- |
| Vocation selection | What kind of run am I choosing? | Class/character selection, readable comparison cards, strong selected state |
| Route choice | What is ahead and what does each path offer? | Strategy maps, branching maps, encounter previews, reward markers |
| Formation and shop | Who is deployed, what can I change, and what can I afford? | Party formation, grid inventory, tactical loadouts, shop offers |
| Battle results | Why did we win or lose, and who survived? | Combat recap, readable event log, damage/healing summaries |
| Rewards | What am I choosing and what changes if I take it? | Reward choice, upgrade cards, recruit comparison |
| Creature codex | How do creatures compare and how do I find one? | Bestiary/encyclopedia, searchable catalogs, filter and stat layouts |

For each job, save 2–4 references with a note about the specific idea to study (hierarchy, map legibility, state, comparison, or density). Include a Tibia reference wherever the concept exists, then use other games to compare layout and interaction approaches. Record both what to carry forward from Tibia and what to adapt for browser readability. Preserve established Tibia names such as vocation, Bestiary, and Cyclopedia; for new names, prefer concise terms that fit Tibia's world and established player vocabulary over generic app labels. Avoid collecting screenshots only for surface styling.

## Client frame and layout

The Tibia client is organized around a central Game Window with surrounding windows for maps, status bars, inventory, combat controls, shortcuts, console, cooldowns, and action bars. Reinterpret that frame for this campaign instead of presenting screens as unrelated web pages:

- Keep the campaign decision or play area central. Frame supporting information as distinct client windows with compact title bars, thin steel borders, and square corners.
- Use the shared top chrome for commander level/experience, gold, current phase, and quick access to the Bestiary/Cyclopedia (codex), help, and replay tools. Keep these controls visibly button-like, as client controls.
- Arrange supporting content in side-window patterns: formation and synergies beside the shop; battlefield beside party/opposition status; summary beside the event log; filters above the codex collection.
- Use Tibia's restrained charcoal and blue-gray client chrome, dark game view, small gold accents, pixel creature art, and map tile cues. Use flat fills and thin borders; do not use gradients, glow, drop shadows, decorative textures, or generic full-page fantasy wallpaper. Keep colorful location artwork inside the play window.
- Treat the campaign map like a Cyclopedia map: keep the terrain as the main view and draw every possible campaign route over it. Highlight the player's current mark and routes available now; keep later branches visible but subdued so players can compare the whole path before choosing.
- Keep encounter-specific battleground art visible behind the square combat grid. Use a translucent tile wash for readability rather than replacing the scene with a solid floor.
- Make every section read as a named client window. A short title bar should identify the content, with status/counts aligned to the same bar where useful. Avoid floating rounded cards, soft app-like gradients, oversized hero marketing layouts, and navigation that looks like a separate SaaS dashboard.
- On narrow screens, stack client windows in the order needed for the decision and keep their title bars and frames consistent.

## Layout and hierarchy

- Give each screen one clear title and one short sentence describing the decision or next action.
- Keep the shared campaign status (phase, gold, commander and XP) compact and stable. Screen content gets the visual priority.
- Use a consistent content width and align section headers, cards, and actions to the same grid. On narrow screens, stack columns in decision order.
- Route cards lead with place and encounter, then threat and reward, then travel action. Preparation leads with formation, then roster/synergies and shop, then the battle action.
- Battle results lead with outcome and survivors, then a concise summary, then the detailed log. Rewards lead with the choice and its effect, then optional detail.
- Codex leads with search and filters, then art/name/role, then concise stats and description. Keep filters visible while browsing where practical.
- Use Tibia creature art, world motifs, and familiar naming as the expressive identity of the interface; reserve decorative flourishes for quiet edges and backgrounds. Avoid placing text over noisy artwork without a solid or opaque backing.

## Type, spacing, and color

Use a compact role-based type scale that feels like a game client while staying readable. Suggested desktop sizes (CSS px):

| Role | Size / line height | Use |
| --- | --- | --- |
| Display | 28–36 / 1.15 | Campaign outcome only |
| Headline | 22–28 / 1.2 | Screen title |
| Title | 14–18 / 1.25 | Window and section heading |
| Body | 13–15 / 1.4 | Descriptions, explanations, battle log |
| Label | 10–12 / 1.3 | Controls, metadata, compact stats |

Use a plain sans-serif client font for controls and most text; reserve serif for a few Tibia-flavored titles. Keep mono for short numbers and tabular values. Essential labels should not fall below 10px. At small widths, reflow controls and lists rather than shrinking type.

Use a 4px spacing base: 4/8px inside controls and rows, 8/12px inside windows, and 16/24px between windows. Prefer compact client-like grouping over oversized card padding.

Use flat charcoal/blue-gray client surfaces, pale text, small Tibia gold accents, and red/green health bars for combat status. Assign colors semantic roles: surface, raised surface, border, primary text, secondary text, action, reward, warning, and danger. Meet at least 4.5:1 contrast for normal text and 3:1 for large text; verify actual foreground/background pairs. Never communicate role, danger, selection, or success by color alone—pair color with labels, icons, shape, or text.

## Interaction states and accessibility

- Every interactive item has default, hover, keyboard focus, selected, disabled, and (where relevant) pressed/loading states. Selection needs a visible outline/check/label as well as color.
- Keep keyboard order aligned with visual reading order; provide visible focus on every control and ensure all actions work without a pointer.
- Give icon-only controls accessible names. Keep hit areas generous, especially on touch layouts.
- Announce important changes such as chosen route, recruited creature, purchase failure, battle outcome, and replay errors in text, not only animation or color.
- Respect reduced-motion preferences. Do not make timed animation the only way to understand a battle or result.
- Use solid backplates or adjustable overlays for text over art. Test contrast on each region/background combination.

## Current UI audit anchors

The current interface already has distinct phase views, creature and item art, route previews, formation/shop panels, reward choice cards, and a searchable codex. The revamp should remove its oversized hero layout, gradients, bevels, and card-heavy web styling. Keep a single compact client frame around useful information windows, preserving the party/opposition status lists in combat. Keep essential labels at 10px or larger and retain the visible focus outline in `src/index.css`.

## Working workflow

1. Collect references for each row in the screen-jobs table, starting with Tibia where applicable, and annotate what each reference solves and what naming or terminology it establishes.
2. Sketch one screen at desktop and narrow widths, then agree on shared tokens and component states.
3. Implement screen by screen, checking keyboard flow, contrast, text resizing, and the actual creature art against overlays.
4. Update this guide when a shared convention changes; keep it short enough to use during implementation.
