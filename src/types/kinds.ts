// Content vocabularies DERIVED from the pipeline's single source
// (p2-structure U6, audit H4): lib/content-kinds.js owns the closed group
// lists, and these types are computed from those very arrays — so adding a
// group there flows into the compiler (a Record keyed by ProjectGroup fails
// to compile until its label exists) instead of requiring hand-edited unions
// scattered across the UI.
import { CERTIFICATE_GROUPS, PROJECT_GROUPS } from '../../lib/content-kinds.js';

/** Real pipeline project group — derived from PROJECT_GROUPS, verbatim. */
export type ProjectGroup = (typeof PROJECT_GROUPS)[number];

/** Real pipeline certificate group — derived from CERTIFICATE_GROUPS. */
export type CertificateGroup = (typeof CERTIFICATE_GROUPS)[number];
