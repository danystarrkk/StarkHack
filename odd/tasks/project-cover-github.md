# Feature: project-cover-github

**Goal**: a real project's cover image renders on its `/projects` card, and the
real `githubUrl` flows to the detail page as the GITHUB REPO link.

**Branch**: feat/frontend-migration · **Started**: 2026-10-09

## Diagnosis (evidence, this session)

- Pipeline OK: `public/projects/convertmachines.md` frontmatter carries
  `image: /projects/convertmachines/media/cover.webp` and
  `githubUrl: https://github.com/danystarrkk/virtualbox-to-vmware`; both are
  present in `public/index.json` and the webp files exist.
- Gap 1 (cover): `src/components/ProjectsScreen.tsx` never renders
  `project.image` — both card banners only render the group icon
  (`renderBannerCenterIcon`, lines ~342 and ~542). `ProjectPage` (detail)
  renders no image either. Writeup cards DO render `node.image`
  (WriteupsScreen.tsx:427-435) — that is the house pattern to mirror.
- Gap 2 (github link): `toUiProject` (src/lib/contentAdapter.ts) maps
  description/tags/image/date but NOT `githubUrl` → the detail route
  (detailRoutes.tsx:406) never receives it → `projectView.ts`
  (`isPresent(project.githubUrl)`) emits no repoUrl / no GITHUB REPO link.
  The UI type `Project.githubUrl?` (src/types/index.ts:110) and
  `projectView` consumption already exist — only the adapter is missing.

## Human decision

- Follow the writeup-card house pattern for covers: real cover image fills the
  card banner (object-cover + hover zoom) when the entry has `image`; the
  dotted-grid + icon banner stays as the fallback when it does not. No detail
  hero (writeup detail has none either — parity).

## Tasks

- [x] T1 RED: `toUiProject` maps `githubUrl` (omit when absent) — pin in
      tests/ui-content-adapter.test.ts; `Frontmatter.githubUrl?: string` added
      to root types.ts (it was absent); `githubUrl` reclassified out of the
      template-only fields list (the pipeline really supplies it).
- [x] T2 RED: ProjectsScreen renders `project.image` as banner cover in BOTH
      cards (featured + archive), icon fallback; source-contract pins in
      tests/styling.test.ts ("project card cover contract").
- [x] T3 Gate: tsc clean; focused suites 53/53; media.test 6/6 after deleting
      the user's 4 orphan webps (human decision: keep only cover.webp).
      Full `npm test` stands at 611/613: the 2 remaining failures are the
      stale "zero project entries" pins in projects-model/terminal-data —
      HUMAN DEFERRED ("déjalo para después"), documented in Engram.
- [x] T4 Evidence + work-unit commit (code+tests+doc only; the user's
      `public/projects/**` content stays theirs).

## Evidence

- RED observed: 3 failing pins (githubUrl map ×2, project card cover ×2) →
  GREEN 53/53 focused; `npx tsc --noEmit` clean.
- media.test 6/6 after deleting `public/projects/convertmachines/media/01–04.webp`
  (human decision; the body never referenced them).
- Deferred by the human: 2 stale "zero project entries" pins
  (tests/projects-model.test.ts, tests/terminal-data.test.ts) remain RED until
  a later session; plus tests/registry.test.ts's hardcoded 11-tag prefix.
- Visual verification (`npm run dev`) left to the human.
