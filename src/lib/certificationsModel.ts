// Pure, synchronous model builder for the /certifications screen.
//
// Takes RAW content-pipeline entries (public/index.json items of kind
// 'certificate', typed by the repo-root lib/content.ts API — the
// getCertificates() output, already in canonical ascending `order`) plus the
// screen's filter state and returns exactly what the screen renders: the
// filtered certificate list, the filter categories with real counts and the
// "MOSTRANDO X ... Y TOTALES" values. The screen owns no data logic of its
// own — every derived value (list, counts, category labels, number positions)
// is computed here from the entries, deterministically and without I/O.
//
// Honesty rules (same family as src/lib/projectsModel.ts):
//   - The category filter is driven ONLY by the real pipeline `group`
//     (universidad | hack4u | cisco — the canonical CERTIFICATE_GROUPS
//     vocabulary of lib/content-kinds.js). The screen keeps its uppercase
//     Spanish display labels ('UNIVERSIDAD', 'HACK4U', 'CISCO') but they are
//     pure labels over real groups: the template's category vocabulary
//     ('UDEMY' | 'OFFSEC') is never a filter source — those have no pipeline
//     group at all and are simply gone.
//   - This screen has NO text search control, so the model carries only the
//     category filter the screen really renders. No dead controls live here.
//   - Template-only fields (version, statusBadge, subBadge, statValue, year,
//     issueDate, issuer, badgeId, ...) stay absent on mapped certificates
//     (toUiCertification maps only real fields; the derived `group`/`category`
//     /`number` added here all come from real data — see below).
//   - `number` (#01, #02, ...) derives from the 1-based position in the list
//     the caller loaded (getCertificates' canonical display order) — ordering
//     data the caller really has, preserved across filters.
//   - The category label is a documented deterministic map from the real
//     group: universidad→UNIVERSIDAD, hack4u→HACK4U, cisco→CISCO. Entries with
//     a missing or non-canonical group get NO label — never an invented one.
import type { ContentIndexItem } from '../../types';
import type { Certification } from '../types';
import { toUiCertification } from './contentAdapter';

/** Real pipeline certificate groups (lib/content-kinds.js), verbatim. */
export type CertificateGroup = 'universidad' | 'hack4u' | 'cisco';

/** The category pill label on a card: the group's uppercase label. */
export type CertificationGroupLabel = 'UNIVERSIDAD' | 'HACK4U' | 'CISCO';

/**
 * Screen filter values: 'TODOS' plus the uppercase display labels of the real
 * groups. These are UI labels only — matching always happens on the real
 * `group` field.
 */
export type CertificationFilterId = 'TODOS' | CertificationGroupLabel;

/** Documented deterministic group → label map (screen vocabulary preserved). */
export const CERTIFICATE_GROUP_LABELS: Readonly<Record<CertificateGroup, CertificationGroupLabel>> =
  Object.freeze({
    universidad: 'UNIVERSIDAD',
    hack4u: 'HACK4U',
    cisco: 'CISCO',
  });

/** One filter button: UI id + the real group it selects (null = TODOS). */
export interface CertificationFilterCategory {
  id: CertificationFilterId;
  /** Real pipeline group this filter selects; null = no group filter. */
  group: CertificateGroup | null;
}

/** A filter button with its real entry count (0 stays visible — honest). */
export interface CertificationCategoryStat extends CertificationFilterCategory {
  count: number;
}

/**
 * The filter vocabulary in the screen's button order (TODOS first, then the
 * canonical groups). Closed to the real CERTIFICATE_GROUPS: no template
 * UDEMY/OFFSEC category can appear here.
 */
export const CERTIFICATION_FILTER_CATEGORIES: readonly CertificationFilterCategory[] = Object.freeze([
  Object.freeze({ id: 'TODOS', group: null }),
  Object.freeze({ id: 'UNIVERSIDAD', group: 'universidad' }),
  Object.freeze({ id: 'HACK4U', group: 'hack4u' }),
  Object.freeze({ id: 'CISCO', group: 'cisco' }),
] as CertificationFilterCategory[]);

/** The screen's filter state. Every field backs a real pipeline field. */
export interface CertificationsFilters {
  /** 'TODOS' or one of the real groups' display labels. */
  category: CertificationFilterId;
}

/** No filters at all: every certificate. */
export const EMPTY_CERTIFICATIONS_FILTERS: CertificationsFilters = Object.freeze({
  category: 'TODOS',
});

/** UI certification + the derived real-group data the screen renders. */
export interface CertificationsViewCertification extends Certification {
  /** Real pipeline `group`, normalized to the canonical vocabulary. */
  group?: CertificateGroup;
}

export interface CertificationsModel {
  /** Filter buttons in screen order, each with its real count. */
  filterCategories: CertificationCategoryStat[];
  /** Category-filtered certificates, in the caller's (display) order. */
  certificates: CertificationsViewCertification[];
  /** `certificates.length` — the "MOSTRANDO: X CERTIFICADOS" value. */
  filteredCount: number;
  /** Every entry considered — the "Y TOTALES" value, filters never shrink it. */
  totalCount: number;
}

// Real pipeline group → canonical vocabulary (case-insensitive); anything the
// pipeline does not recognize stays absent — never mapped onto a real group.
const normalizeGroup = (value: string | undefined): CertificateGroup | undefined => {
  const lower = (value ?? '').trim().toLowerCase();
  return lower === 'universidad' || lower === 'hack4u' || lower === 'cisco' ? lower : undefined;
};

// Real pipeline entry → the screen's certification: toUiCertification's honest
// mapping plus the derived real-group display data (position = 1-based index in
// the caller's loaded list).
const toViewCertification = (item: ContentIndexItem, position: number): CertificationsViewCertification => {
  const group = normalizeGroup(item.group);
  return {
    ...toUiCertification(item, position),
    ...(group !== undefined ? { group, category: CERTIFICATE_GROUP_LABELS[group] } : {}),
  };
};

/**
 * Build the /certifications model. Pure and synchronous: same inputs → same
 * output, inputs untouched.
 */
export const buildCertificationsModel = (
  entries: readonly ContentIndexItem[],
  filters: CertificationsFilters
): CertificationsModel => {
  // Positions come from the LOADED list order (the pipeline's canonical
  // display order) and survive every filter.
  const all = entries.map((item, index) => toViewCertification(item, index + 1));

  const category = CERTIFICATION_FILTER_CATEGORIES.find((c) => c.id === filters.category);
  const groupFilter = category?.group ?? null;
  const certificates = all.filter((cert) => groupFilter === null || cert.group === groupFilter);

  return {
    filterCategories: CERTIFICATION_FILTER_CATEGORIES.map((c) => ({
      ...c,
      count: c.group === null ? all.length : all.filter((cert) => cert.group === c.group).length,
    })),
    certificates,
    filteredCount: certificates.length,
    totalCount: all.length,
  };
};
