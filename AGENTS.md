# Agent instructions

## TypeScript and application code

- Use the existing domain types and Zod schemas. Avoid `any`, unsafe casts, and non-null assertions; treat parsed, persisted, and imported values as `unknown` until validated and narrowed.
- Model game phases, events, and transitions explicitly. Handle every variant exhaustively, including empty, null, zero, and boundary cases.
- Keep combat rules and other game decisions in small deterministic functions where practical. Pass randomness and other changing inputs in explicitly; keep storage, React state, timers, and browser APIs at the application boundary.
- Treat YAML content and browser local storage as untrusted input. Validate them at load boundaries and preserve explicit migrations when save shapes change.
- Keep React effects scoped to their lifecycle: clean up timers and subscriptions, and avoid stale state updates.
- Add focused tests for meaningful game-rule, state-transition, and migration changes. Run the relevant checks available in `package.json` (`npm run build`, `npm run lint`, and `npm test`) when validating a change.
- Keep changes within the requested scope and update the relevant game, architecture, asset, or workflow documentation when behavior or conventions change.

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
