# Feature: certificate-hires

**Goal**: clicking a certificate card image opens a lightbox with the
HIGH-RESOLUTION original; every certificate carries two images — the card
`cover.webp` (resized) and `hires.webp` (original size) — planned and produced
automatically by the scripts on every new certificate.

**Branch**: feat/frontend-migration · **Started**: 2026-10-09

## Human decisions

- Backfill of the 7 existing certificates INCLUDED, using visual matching
  (jpg from /home/stark/Downloads/certificados ↔ current covers); the proposed
  mapping is shown to the human for approval BEFORE writing anything.
- add-content must not need a new flag: the `--image` original IS the hires
  source; cover is produced resized from the same file.

## Design (approved plan)

- Outputs per certificate: `media/cover.webp` (~1600w, q82) + `media/hires.webp`
  (ORIGINAL dimensions, q95), per-entry magick args in the ingest plan
  (today magick runs with no args at scripts/add-content.js:470-479).
- New optional frontmatter key `imageHires: /certificates/<slug>/media/hires.webp`
  (auto-set when planned, same style as `image`). Absent → lightbox falls back
  to `image` (old certificates keep working).
- Orphan rule learns the key: tests/media.test.ts collectContentRefs must
  count `imageHires:` (else hires.webp trips "no orphans"); same for the
  content-edit mirror (lib/content-edit.js + tests/content-edit.test.ts).
- UI: CertificationsScreen card image gets onClick → lightbox reusing the
  MarkdownRenderer zoom pattern (createPortal, ESC, backdrop, object-contain)
  showing `imageHires ?? image`; card keeps the cover. toUiCertification maps
  `imageHires`; Certification type + Frontmatter declare it.
- Scripts: add-content certificate summary marks both files; edit-content
  cover replacement regenerates BOTH (magick at scripts/edit-content.js:711).
- Backfill: similarity-match jpgs vs covers (ImageMagick compare), present the
  mapping, then generate hires + set imageHires in the 7 .md + regenerate
  index (public/index.json) after approval.

## Tasks

- [x] B1 Ingest dual-image plan + magick args + imageHires + content-ingest
      pins (RED 5 → GREEN; writeup/project plans byte-identical).
- [x] B2 Orphan rules learn imageHires (RED 5 → GREEN; media collector +
      content-edit coherence: non-orphan, preserved, rename-refresh).
- [x] B3 Lightbox UI + adapter/types + styling pins (RED 4 → GREEN 66/66;
      real ESC handler added — the mirrored pattern only labeled it).
- [x] B4 Scripts: add-content summary marks (hires) + convertImagePlan in
      BOTH CLIs (magickArgs order -resize <w>x -quality <q>); cover change
      regenerates cover+hires and sets/refreshes imageHires (B2 deferral
      resolved; its pin revised). edit-content finished inline by the
      orchestrator after a worker stall (RED 3 → GREEN 103/103 focused).
- [x] B5 Gate: tsc clean; npm test 670/673 = the 3 human-deferred stale pins;
      add-content certificate dry-run plans cover+hires with both markers.
- [x] B6 Backfill: matching → human-approved mapping → hires + imageHires +
      index regeneration.
- [x] B7 Evidence + work-unit commits (code slices first; backfill content
      committed per human decision).

## Evidence

- B1: RED 5 (certificate pins) → GREEN 46/46 content-ingest; writeup/project
  pins untouched = unchanged-behavior proof.
- B2: RED 5 → GREEN 50 (media + content-edit).
- B3: RED 4 → GREEN 66/66; fallback chain `cert.imageHires ?? cert.image`
  source-pinned.
- B4: RED 3 in edit-content (left by a stalled worker, completed inline by
  the orchestrator) → GREEN 103/103 focused; spawn argv assertions prove
  exact magick args for cover/hires and byte-identical project invocation.
- Full gate: tsc clean; 670/673 = the three human-deferred stale pins.
- Smoke (dry-run, nothing written): certificate plan lists
  `media/cover.webp   (cover)` + `media/hires.webp   (hires)` from the same
  source and writes imageHires in the planned frontmatter.
- B6: visual matching (RMSE over 256px grayscale) mapped all 6 jpgs
  unambiguously (best ~155-165 vs next-best ~15000+); human approved the
  table; hires.webp (q95, 1800x1200 originals) generated for arch_cero,
  hack_web, in_linux, certificado, per_entorno, pythonofe; imageHires set in
  those 6 .md files; index regenerated (16 writeups / 1 project /
  7 certificates). hacker_mentor has NO original in Downloads/certificados →
  stays on the cover fallback until the human supplies one.
- Code commit: 355b531 (16 files, +952/−65). Backfill content (hires.webp ×6,
  6 .md edits, index.json) stays uncommitted for the human, consistent with
  every prior round. Full suite after backfill: 670/673 = the three
  human-deferred stale pins.
