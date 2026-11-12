# india-school-ecosystem-v1 — SYNTHETIC TEST DATA

| | |
|---|---|
| **Version** | `india-school-ecosystem-v1` |
| **Origin** | Synthetic — authored by the EDXSO project team |
| **Dataset date** | 2025-06-30 (all freshness calculations use this date, not "today", so results are reproducible) |
| **Records** | 62 source records → 59 canonical people (3 duplicates merged) |
| **Real people** | **None.** Every name, organisation and biography is fictional. |
| **Profile URLs** | **None, by design.** No URL is fabricated. |

## Why this exists

The MVP is corpus-first and must not depend on LinkedIn. This fixture exercises every mechanic of the
pipeline — retrieval, entity resolution, evidence validation, ranking, explanations, export and
evaluation — without presenting synthetic people as real.

**It does not validate real-world discovery quality.** The assignment's "20+ real, lawfully sourced
professionals" criterion remains unproven until a licensed, public-with-permission, or user-supplied
real dataset is imported through the same pipeline.

## Composition

| Segment | Purpose |
|---|---|
| Direct matches (label 3, 12) | Former principals now advising many schools, school-group heads, trustees, owners |
| Relevant (label 2, 18) | Single-school principals with cross-school activity, vendors and programmes deployed across schools, policy advisors, a stale record, a UAE-based consultant |
| Weak / adjacent (label 1, 10) | Teachers, consumer edtech, coaching, preschool franchise, journalist |
| Hard negatives (label 0, 18) | Corporate executives, university-only academics, generic "Founder"/"Consultant" titles |
| Deliberate edge cases | 3 duplicate source records (merged), 1 same-name/different-person pair (flagged, **not** merged), 3 records of the reference people themselves (self-exclusion) |

## Files

`persons.csv`, `sources.csv`, `evidence.csv`, `labels.csv`, `manifest.json` (counts + SHA-256 checksums).
Regenerate with `npx tsx scripts/export-dataset.ts`. The single source of truth is
`src/data/india-school-ecosystem-v1.ts`.

## Evidence rule

Every evidence excerpt is a **literal substring** of its source biography. The importer quarantines
any record whose excerpt cannot be found in its source text, whose taxonomy values are unknown, or
that has no evidence/provenance.

## Labels

Graded 0–3 against `demo-ref-001` using the rubric below. Single annotator (the fixture author), so
inter-annotator agreement is **not** measured. Every third labelled record is held out
(`split = heldout`); tune only on `train`.

| Grade | Meaning |
|---|---|
| 0 | Not relevant to India's school ecosystem |
| 1 | Weak / adjacent (education-adjacent, no school-sector decision-making or cross-school evidence) |
| 2 | Relevant (school leadership, or documented programme/product across several schools) |
| 3 | Highly relevant (senior school role *and* documented multi-school advisory / group / governance) |

## Limitations

- Small and easy: a 59-person corpus cannot separate good rankers from great ones.
- Labels are author-assigned; no reviewer disagreement was resolved.
- Embedding is a deterministic hashed-concept embedder, not a neural model.
