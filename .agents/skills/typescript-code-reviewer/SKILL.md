---
name: typescript-code-reviewer
description: Review TypeScript application code for correctness, maintainability, and security. Use when asked to review, audit, inspect, or critique TypeScript changes or a codebase. Report actionable findings with file and line references; do not edit unless asked.
---

# TypeScript Code Reviewer

Review the requested TypeScript changes or codebase for defects and maintainability risks. Ground findings in code and project conventions. Prefer a few high-confidence, actionable findings over speculative style feedback.

## Review workflow

1. Read repository instructions, architecture notes, and relevant package scripts/configuration. Follow project conventions unless they conflict with correctness or security.
2. Establish scope. For a change review, inspect the diff and surrounding code. For a broader audit, map relevant modules and trace important data and state flows.
3. Trace inputs, state transitions, side effects, and outputs. Pay attention to untrusted input, persistence, external services, asynchronous work, and resource lifecycles.
4. Check invariants, failure behavior, boundary cases, and security assumptions. Validate suspected issues against call sites and tests.
5. Use existing project checks (typecheck, lint, tests, build) when useful and available. Do not modify files during a review. Report checks run and limitations.
6. Return findings first, ordered by severity, followed by a concise summary. If there are no actionable findings, say so and mention meaningful coverage gaps.

## Review areas

### Correctness and TypeScript

- Check strict typing and meaningful domain types. Avoid `any`, unsafe casts, non-null assertions, and broad conversions that hide uncertainty. Use `unknown` at untrusted boundaries and narrow or validate before domain logic.
- Check that finite states and transitions are represented explicitly, invalid states are hard to construct, and exhaustive handling is maintained.
- Verify optional, null, empty, zero, and boundary values. Check numeric precision, units, and assumptions about ranges.
- Inspect asynchronous behavior for races, stale results, rejected promises, cancellation, cleanup, and silently lost errors.

### Functional core, imperative shell (FCIS)

- Keep core decisions and transformations as deterministic, side-effect-free functions where practical. Pass inputs explicitly and return outputs or explicit error results.
- Keep I/O and effects—network, storage, clocks, randomness, logging, UI/framework calls, and process state—in a thin imperative shell. Let the shell gather inputs, call the core, and apply outputs.
- Check that core logic does not read hidden mutable globals or invoke effects indirectly, and that the shell does not duplicate business rules.
- Do not force purity where it obscures a simple operation or adds unnecessary indirection. Report a finding only when effect coupling concretely harms predictability, testability, or correctness.

### Security

- Identify trust boundaries. Validate and normalize external, persisted, imported, and user-controlled data before use; prefer allowlists and context-aware encoding.
- Check authorization on every sensitive operation and object access. Do not rely only on client-side checks or authentication as a substitute for authorization.
- Look for injection and unsafe interpretation of input (including SQL/command/template/HTML/path/URL contexts), unsafe deserialization, path traversal, and server-side request forgery where relevant.
- Check authentication and session/token handling, secret exposure, cryptographic choices, sensitive data storage/transmission, and overly broad permissions.
- Review dependency and build integrity, insecure defaults/configuration, error handling that fails open or leaks sensitive details, and security logging/alerting for important events.
- Consider resource exhaustion and abuse controls on expensive or externally reachable operations. Tie each concern to a plausible path and impact; do not report generic checklist gaps as defects.
- Use the current OWASP Top 10 as an awareness checklist for web applications, while recognizing it is not a substitute for a threat model or a complete security audit.

### Maintainability and Fowler code smells

Check for concrete instances of Fowler's code smells, including duplicated code, long method, large class, long parameter list, divergent change, shotgun surgery, feature envy, data clumps, primitive obsession, switch statements that indicate missing polymorphism or explicit state modeling, parallel inheritance hierarchies, lazy class, speculative generality, temporary field, message chains, middle man, inappropriate intimacy, alternative classes with inconsistent interfaces, incomplete library class, data class, and refused bequest. Apply judgment: a smell is a prompt to investigate, not proof of a defect.

Also look for hidden coupling, unclear responsibilities, dead code, and abstractions that add more concepts than they remove. Explain the concrete maintenance or correctness impact; do not report stylistic preference alone. Prefer focused modules, clear names, small predictable functions, and abstractions that encode a real domain rule.

### Tests and change scope

- Check coverage for changed behavior, important edge cases, state transitions, and bug fixes. Mention missing tests when they create meaningful regression risk.
- Check that changes stay within requested scope and update relevant documentation when behavior, architecture, or developer workflow changes.
- Do not report missing tests as a defect when no practical test setup exists or behavior is not meaningfully testable in isolation; state the limitation instead.

## Findings format

For each actionable finding, include:

- **[P1/P2/P3] Short problem statement**
- `path/to/file.ts:line`
- The triggering scenario, its impact, and why the code causes it.
- A focused fix direction when clear.

Use P1 for severe issues that block core use or risk major data loss or security failure; P2 for normal-priority defects with user-visible or substantial maintainability impact; P3 for lower-impact, localized issues. Do not invent P0/P4 labels. Keep findings independently actionable and cite the narrowest relevant location.

Do not report preferences, unsupported hypothetical risks, or issues already prevented by a validated boundary. If no findings remain, state “No actionable findings.” Then summarize review scope and checks run or omitted.
