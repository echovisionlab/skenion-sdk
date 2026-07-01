# Codex Agent Context

This repository is one part of the Skenion workspace. Do not treat local code
momentum as the source of truth: before committing, pushing, opening a PR, or
writing PR close keywords, check the relevant GitHub milestone and issue with
`/opt/homebrew/bin/gh`.

Use the bundled Codex pnpm when needed:
`/Users/state303/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm`.

## Generated Dependency Metadata

Lockfiles and package manifests are repo-owned dependency metadata. This
includes `package.json`, `pnpm-lock.yaml`, generated package version constants,
and comparable dependency outputs.

If a build, test, generator, or package manager in this repo updates those files
for a legitimate reason, include and commit that churn with the SDK slice. Do
not revert dependency metadata merely because it is generated. If the change is
in another repo or outside the assigned write-set, leave it alone and report it
only if it blocks verification.

## Strict v0 SDK Policy

Skenion v0 does not support legacy, deprecated, or import-only compatibility
paths. SDK helpers must generate and validate the current product surface only.
Unsupported schema, protocol, graph, project, package, manifest, extension, or
ABI versions must be rejected with structured issues rather than migrated,
imported, shimmed, or kept behind deprecated aliases.

The forward graph/project contract label is `0.1`. SDK should follow Contracts
after v0.2 is merged into the 0.1 label. Do not preserve the old v0.1 meaning as
legacy compatibility, and do not keep v0.2 as a parallel SDK surface. If a
version field remains, SDK helpers should accept only exact current `0.1` for
that surface and reject all others.

## Repository Role

This repo should make first-party and third-party authoring convenient without
becoming a separate contract source of truth. Prefer helpers that consume
`@skenion/contracts` exports and produce current-version packages, patch
libraries, manifests, and extension scaffolds.

## Local Contracts Integration

Keep committed dependency manifests registry-first. Do not commit `file:`,
`link:`, workspace, path, or GitHub URL dependencies for `@skenion/contracts`.
Use `pnpm run check:local-contracts -- --contracts-path <packages/ts path>` for
explicit local source integration. The script may use the sibling checkout
defaults, verifies local package metadata and git evidence, temporarily
overrides `node_modules/@skenion/contracts`, runs SDK `ci`, and restores the
registry install without modifying `package.json` or `pnpm-lock.yaml`. Release
jobs must not use this path; `SKENION_RELEASE_MODE=1` fails closed.

## Component Releases And Compatibility Matrices

Release Please owns natural component releases for this repository. The hub
verifies and promotes compatibility matrices; it does not conduct component
releases or require SDK, Contracts, Runtime, Studio, docs, and examples to
publish the same product version. SDK release work must declare the Contracts
compatibility line it supports: supporting Contracts `0.49` means supporting
`>=0.49.0 <0.50.0`, while SDK may release at its own component version.
Publishing must happen only through GitHub Actions release workflows and Release
Please, not local npm publishing.

All release-state writes must happen inside GitHub Actions as well. Do not
create, edit, delete, promote, demote, or repair GitHub Releases, release
assets, tags, prerelease/draft flags, release notes, compatibility matrices,
npm packages, or crates from a local shell. This includes `gh release edit`,
`gh release upload`, `gh release delete`, manual tag mutation, local registry
publish, or ad hoc release metadata patches with a locally exported token.
Local commands may inspect state, run dry-run checks, create normal code PRs,
or trigger approved `workflow_dispatch` jobs; the actual release mutation must
run in CI with reviewed workflow code and auditable logs.

Workflows that need cross-repository or release automation credentials must use
the organization Actions secret `GH_TOKEN`. Do not add `RELEASE_PLEASE_TOKEN`,
`SKENION_RELEASE_TRAIN_TOKEN`, or default Actions-token fallbacks for release,
compatibility-matrix, artifact-verification, or promotion workflows.

## Manager, Worker, And Review Gate Defaults

Codex should operate as a manager/orchestrator on Skenion work. The manager owns
sequencing, milestone and issue hygiene, PR title/body/close-keyword control,
worker assignment, integration, and final reporting. Except for trivial
documentation, context, issue, or status edits, the manager should not directly
modify code. Implementation work and follow-up fixes should be delegated to
focused worker agents, then integrated by the manager. Workers must receive a
clear ownership scope, usually specific files, modules, or repository slices,
and must be told that other agents may be editing nearby code.

Follow-up work is not an exception: if review, CI, or user feedback requires
non-trivial code changes, the manager must assign that work to a worker and send
the completed slice through a separate review gate again. The manager may run
verification and status commands, but should not directly patch non-trivial
implementation code.

Every completed worker slice needs a separate review gate before it is treated
as done. The gate should be a different expert agent from the worker. A gate
review should prioritize correctness, API cleanliness, responsibility
boundaries, readability, test coverage, CI risk, and milestone acceptance
criteria. If the gate fails, the manager must send concrete fixes back to a
worker, then run the gate again until the slice passes or a real blocker is
recorded in the issue. The manager may only make trivial documentation,
context, issue, or status corrections directly.

Worker and reviewer reports must be brief by default. Routine PASS reports,
progress summaries, and commit-readiness notes should use only: PASS/FAIL,
blocking findings, non-blocking follow-ups that change the next action,
verification summary, and next action. Do not include long code-line tours,
exhaustive source references, or repeated evidence in ordinary reports.
File/line references are required for bugs, FAIL reviews, CI failures, security
or data-loss risks, and explicit audit requests; otherwise keep them minimal.
The goal is fast decision-making, not transcript-sized reports.

Default code quality requirements:

- Write code that is easy to read before it is clever.
- Follow clean-code principles: clear names, small responsibilities, explicit
  data flow, predictable control flow, and low incidental coupling.
- Do not introduce interface-based abstraction lightly. Public APIs, traits,
  generated clients, schemas, and extension points must earn their existence and
  remain small, stable, and understandable.
- Keep responsibility ownership clear. Runtime, Studio, Contracts, SDK,
  Examples, and Docs must not duplicate each other's source-of-truth roles.
- UI/UX work must be reviewed for actual workflow quality, not merely rendered
  components.

Issues and milestones are the operating ledger. When work discovers new debt,
missing scope, or a design risk, record it on the relevant GitHub issue or open
a properly milestoned issue before burying it in local context. Close issues
only when the repository-specific acceptance criteria are genuinely complete.
Use `Refs` for partial or cross-repo work and `Closes` only for finished scope.
