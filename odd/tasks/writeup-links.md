# Feature: writeup-links

**Goal**: writeups carry their sidebar link sections (`machineLinks` /
`toolLinks`) from the writeup's own frontmatter — human-controlled, validated
fail-loud by the pipeline, asked for by add-content. Nothing is auto-populated.

**Branch**: feat/frontend-migration · **Started**: 2026-10-09

## Human decisions

- NO automatic content: the 15 writeups without links stay empty until the
  human writes their frontmatter.
- Precedence: frontmatter wins when present; the curated hmv-wave template
  remains as FALLBACK (migration to wave.md is a later human action).

## Design (approved plan)

- Frontmatter keys (camelCase, js-yaml round-trip like `tags`):
  `machineLinks: [{title*, url*, badge?, type?}]` (type ∈ platform|download|
  ip|cve), `toolLinks: [{name*, url*, description?, developedByAuthor?,
  githubStars?, badge?}]`. Absent keys = valid (sections stay empty).
- `assertValidWriteupLinks` in lib/content-kinds.js (writeup contract home),
  wired into scripts/generate-index.js writeup branch (filePath-verbatim
  errors, same family as level/tags) and exercised by content-ingest /
  add-content round-trip (ingest preserves keys via `{...data}` already —
  pinned by test, not rewritten).
- UI: `toUiWriteup` maps both keys (conditional-omit); `buildWriteupView`
  precedence `frontmatter → curated template → []`. No markup change
  (WriteupPage already renders both sections when non-empty).
- add-content writeup gains an optional TTY links step (askText/askChoice,
  bounded retries, skip allowed) that VALIDATES before writing; dry-run prints
  what would be written.
- Template-only pins that today assert machineLinks/toolLinks never arrive
  mapped must be revised (ui-content-adapter, terminal-data,
  directory-model) — they pin the old contract.

## Tasks

- [x] A1 Validator + generator wiring + round-trip pins (RED 15 → GREEN
      103/103 focused; generator passthrough + ingest round-trip pinned).
- [x] A2 Adapter + view precedence + pin revisions (RED 7 → GREEN; explicit
      [] wins over template; per-key independence; 3 template-only lists
      revised; types.ts structural MachineLinkFm/ToolLinkFm; stale comments
      in src/types/index.ts + WriteupPage updated).
- [x] A3 add-content links prompts + validation (RED 4 → GREEN 30/30; pure
      buildWriteupLinks helper; validator problems join plan.problems
      verbatim; non-TTY/dry-run unchanged).
- [x] A4 Gate: tsc clean; npm test 644/647 — only the 3 human-deferred stale
      pins; writeup dry-run smoke unchanged (no prompts/keys).
- [x] A5 Evidence + work-unit commit.

## Evidence

- A1: RED 15 → GREEN 103/103 (generate-index + content-ingest); smoke proved
  deep-equal passthrough of both nested keys into the index entry.
- A2: RED 7 → GREEN (4 focused files 91/91 minus the deferred pin); one
  documented boundary cast (toolLinks githubStars string|number verbatim).
- A3: RED 4 → GREEN 30/30 (add-content); non-TTY output has no links
  prompts/keys; invalid hand-written links now fail before writing (superset,
  validator no-op for valid sources).
- Full gate: tsc clean; `npm test` 644 passed / 3 failed = exactly the
  human-deferred stale pins.
- Human decisions honored: no .md written by us (sections stay empty until the
  human writes them); wave keeps the curated fallback (writeup-view pin (c)).
