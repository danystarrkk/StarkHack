# Feature: registry-complete-writes

**Goal**: `scripts/registry.js` must write EVERY place where a registered
vocabulary is validated — including test pins and counts — so adding a tag,
group or platform never leaves the suite red and never collides with the
other scripts.

**Branch**: feat/frontend-migration · **Started**: 2026-10-09

## Human decision (this feature)

- "Cuando agregue un tag, un grupo o una plataforma, en todo lado donde esté
  registrada la lista con la que se valida tiene que cambiar" — including
  tests. Passage ("dar paso") is the rule.
- Where a pin is a STRUCTURAL invariant that cannot be updated by insertion
  (the nested `valuesInCommon(groups, tags) → []` loop and the
  group-lists-disjoint pin), the planner REJECTS the colliding value
  fail-loud instead — an approved invariant that registration would break.

## Verified audit (evidence: session of 2026-10-09, obs Engram 42)

| registry | writes today | gap |
| --- | --- | --- |
| platform | `contentAdapter.ts` + `ui-content-adapter.test.ts` pin | NONE — UI derives platforms from the index; other copies are additive-safe fixtures |
| tag | `lib/taxonomy.js` + pin lists in `tests/taxonomy.test.ts` | (1) `expect(TAGS).toHaveLength(20)` (taxonomy.test.ts:79) never updated → any writeup tag = RED. (2) intersection pins (taxonomy.test.ts:267/271/278) never updated → cross-kind overlap accepted by the within-kind duplicate check then breaks RED. (3) no guard vs group slugs (pin line 264 loop) |
| group | vocab + pin + full UI wiring (T5) | (1) cross-kind group duplicate not checked → breaks pin line 252. (2) slug == tag value not checked → breaks pin 264. (3) project `--icon` DEFERRED: `PROJECT_ICON_BY_GROUP` (contentAdapter) + its pin never written |

## Tasks

- [x] T1 RED: contract tests for `planTagAddition` — count-pin rewrite,
      intersection-pin recompute (all 3 pairs), group-slug collision rejection,
      fail-loud when a required pin anchor is missing and must change.
- [x] T2 GREEN: `planTagAddition` in lib/registry.js.
- [x] T3 RED+GREEN: `planGroupAddition` — cross-kind duplicate rejection +
      slug-vs-tag-value rejection (group lists parsed from kinds source, tag
      lists from pin source, both fail-loud when missing).
- [x] T4 RED+GREEN: `planGroupWiring` — project `--icon` actually writes
      `PROJECT_ICON_BY_GROUP` (contentAdapter) + the expect line in
      `ui-content-adapter.test.ts`; no-icon keeps the fallback note; deferred
      note removed. CLI reads `adapterPin` for `group`.
- [x] T5 CLI: wiring sources + plan previews for the new icon files
      (scripts/registry.js: WIRING_SOURCE_KEYS / OP_SOURCE_KEYS / formatPlan).
- [x] T6 Gate: tsc clean, full `npm test`, dry-run smokes of the three
      commands against the REAL repo sources (no writes).
- [x] T7 Evidence in this doc + work-unit commits (Conventional, Spanish
      subject per repo convention).
- [x] T8 (found by worker): `planPlatformAddition` writes map keys unquoted →
      a hyphenated platform (`acme-lab` allowed by the name regex) produces
      invalid TS. Quote with `objectKey` AND teach `findIconMap` to parse
      quoted keys (or duplicate detection silently misses them). RED first.

## Notes / constraints

- Test-first: observe RED before GREEN per task; never fabricate RED.
- Surfaces: lib/registry.js, scripts/registry.js, tests/registry.test.ts,
  tests/registry-cli.test.ts.
- The working tree ALSO holds the uncommitted T5 CLI + the `hacker-mentor`
  registration + the user's certificate content — do not revert any of it;
  commit boundaries resolved at close (ask the human).
- No new dependencies. Pure planner stays pure (no fs in lib/registry.js).

## Evidence

- T1–T5 (worker, test-first): RED observed 20 failed / 98 passed in the two
  focused suites → GREEN 98/98. Deviations documented by the worker and
  accepted: sibling tag vocabularies are required anchors (missing → problem);
  slug-vs-tag match is exact case-sensitive; `previewRows` extended to a line
  LCS diff so multi-region rewrites preview only the changed lines.
- T8 (worker, test-first): RED 2 failed / 98 passed (quoted-key insertion +
  quoted-key duplicate detection) → GREEN 100/100; triangulated identifier vs
  hyphen keys and both quote styles.
- Final gate (independent gentle-ai-verify): `npx tsc --noEmit` 0;
  `npm test` 24 files / 607 tests green; three dry-runs exit 0 with no writes
  — tag previews `+ expect(TAGS).toHaveLength(21);`, platform previews
  `+ 'acme-lab': 'wave',` (quoted), group --icon plans adapter + pin with ZERO
  "deferred" occurrences.
- Human decision at close: ONE commit with registration (hacker-mentor) +
  code + docs; the user's certificate content (public/**) stays uncommitted
  for the human to commit.
- Commit SHA recorded in Engram (topic odd/registry-complete-writes/tasks).
