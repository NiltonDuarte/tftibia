# Agent instructions

## TypeScript and application code

- Use the existing domain types and Zod schemas. Avoid `any`, unsafe casts, and non-null assertions; treat parsed, persisted, and imported values as `unknown` until validated and narrowed.
- Model game phases, events, and transitions explicitly. Handle every variant exhaustively, including empty, null, zero, and boundary cases.
- Keep combat rules and other game decisions in small deterministic functions where practical. Pass randomness and other changing inputs in explicitly; keep storage, React state, timers, and browser APIs at the application boundary.
- Treat YAML content and browser local storage as untrusted input. Validate them at load boundaries and preserve explicit migrations when save shapes change.
- Keep React effects scoped to their lifecycle: clean up timers and subscriptions, and avoid stale state updates.
- Add focused tests for meaningful game-rule, state-transition, and migration changes. Run the relevant checks available in `package.json` (`npm run build`, `npm run lint`, and `npm test`) when validating a change.
- Keep changes within the requested scope and update the relevant game, architecture, asset, or workflow documentation when behavior or conventions change.

## Game change regression checks

- For every change to gameplay, campaign state, content that affects play, or game UI flows, add or update regression tests and run the relevant tests before finishing.
- Verify that a player run can be exported to JSON, imported again, and replayed to the same resulting state. Include schema validation and legacy replay migrations when the change affects saved or replayed state.
- Verify that the Balance Lab completes seeded campaigns and uses the same current rules, content, rewards, and state transitions as the game. Update its simulation and diagnostics whenever gameplay changes.
- Review every existing balance strategy against each new or changed feature. Update strategies or add a focused new strategy when needed so simulations exercise the feature; cover those decisions in tests.
- Run `npm test` and the relevant build or lint checks after game changes. Report any check that could not be run and why.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit:

```text
<type>[optional scope]: <short imperative summary>
```

Use a lowercase type and summary. Keep the subject concise and omit the final period. Common types:

- `feat`: add or change user-facing behavior
- `fix`: correct a bug
- `docs`: update documentation
- `refactor`: restructure code without changing behavior
- `test`: add or update tests
- `build`: change build tooling or dependencies
- `ci`: change automation or deployment workflows
- `chore`: maintenance that does not fit another type

Add a scope when it helps identify the affected area, such as `feat(combat): add damage analysis`. For a breaking change, append `!` after the type or scope and explain it in a `BREAKING CHANGE:` footer.
