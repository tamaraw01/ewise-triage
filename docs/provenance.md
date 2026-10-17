# Data provenance and operational limits

This record separates saved research observations, local audit results, and
operational reference copy. It is not evidence of field validation or regulatory
approval. Copy audit inspected existing local sources; no model, centroid,
threshold, partition, or projection was regenerated.

## Source chain

- Notebook source recorded by the project:
  <https://www.kaggle.com/code/arimakaori/cluster-14>.
- Dataset source recorded by the project:
  <https://www.kaggle.com/datasets/samuelfrans/bdc2026-dataset>.
- Local research evidence: `research/source/cluster-14.ipynb`, saved CSV/JSON/NPY
  files under `research/artifacts/`, and `research/image_manifest.csv`.
  `research/` is ignored by Git and need not be available in another checkout.
- `scripts/build_analytics.py` audits saved outputs and local image headers/bytes;
  it does not rerun CLIP, UMAP, or bootstrap. `web/data/analytics.json` records
  source hashes, notebook hash, manifest hash, and paper hash.
- Paper interpretation is recorded separately in `analytics.paperReported`.
  Subtypes and standalone comparator metrics are not per-image measurements
  verified from EXP14 outputs.

The existing retrieval record says Kaggle output was fetched as saved latest,
not pinned to an ordinal version. Recorded hashes identify local evidence, not
a newly verified upstream version. The local 3,961 filename set was matched to
saved retained/excluded manifests. This establishes local population membership
and local assignment correspondence, not byte identity with an upstream Kaggle
image download. Upstream image bytes were not downloaded again for this audit.
Filename-prefix labels are evaluation proxies, not independent expert labels.

## Current artifacts

| File | Meaning and boundary |
|---|---|
| `web/data/analysis-flow.json` | 2,660 rows: saved 2D coordinates, K-Means, Ward, GMM, and consensus IDs. Source column order and CSV hash are embedded. |
| `web/lib/data.ts` `scatter` | Maps each row to x, y, consensus ID. Used by Explorer; no new embedding or clustering. |
| `web/data/analytics.json` | Full-population counts, label evaluation, clustering audit, saved bootstrap summaries, and explicit paper-only results. |
| `web/data/clusters.json`, `backend/artifacts/clusters.json` | Saved naming similarities, counts, reference mixtures, purity, and broad route metadata. Not photo-level subtype or chemical detection. |
| `web/data/meta.json`, `backend/artifacts/meta.json` | Experiment and inference-validation summaries, including image-centroid review threshold 0.0297. |
| `web/data/scatter.json` | Legacy 1,400-point sample, not current full-population map input. |
| `web/lib/data.ts` `CLUSTERS_META` | Local presentation/reference copy. Rounded metrics and handling types are not a new experiment or verbatim upstream records. |

Local checks performed during this copy audit:

- All 13 saved artifact SHA256 values match `analytics.provenance.artifactHashes`.
- Local image-manifest SHA256 matches its recorded value.
- All 2,660 `analysis-flow` rows match the local source CSV's two coordinates
  and four partition IDs in row order. This verifies local saved assignments,
  not upstream image bytes or independent model replication.
- Cluster populations C0 to C13 are 277, 286, 202, 232, 132, 93, 237, 266,
  133, 31, 80, 243, 174, 274, totaling 2,660.
- Frontend/backend cluster JSON copies match byte-for-byte locally; metadata
  JSON copies also match locally. This is a local copy check, not an upstream
  provenance claim. No artifact files were modified.

The map keeps its existing perspective, pointer tilt, independent display-axis
fit, and selection lift. Stored data remain 2D. Screen distances and display
height must not be described as a third experimental dimension.

## Metrics are different measurements

| Metric | What it measures |
|---|---|
| Photo-centroid similarity | Cosine similarity of a new image embedding to a stored centroid; not probability. |
| Photo margin | Top-two centroid similarities' difference. Review threshold 0.0297 belongs to this quantity. |
| Naming similarity / margin | Mean image-text similarity for a cluster name / difference between its top two names. Different from photo margin. |
| Purity | Share of a cluster occupied by its largest filename-prefix reference class; a pure cluster can still have a wrong assigned name. |
| Label accuracy / F1 | Named predictions against filename-prefix proxy labels. |
| Bootstrap ARI | Agreement of refitted partitions with the reference on shared sampled observations, holding CLIP, UMAP50D, and selected K fixed. Not accuracy or full-pipeline uncertainty. |
| Leave-one-out agreement / accuracy | Saved image-centroid validation summaries; separate from bootstrap and naming evaluation. |

The retrospective naming-margin illustration uses 0.03 and reviews C9/C11:
274 reference images reviewed, 2,386 accepted of 2,660 (89.7% coverage),
97.57% label accuracy among accepted references. It does not validate live
photo review rates or calibrate probability. C9 is mixed (largest class Keyboard
25.8%); C11 is named Mobile despite dominant Player 99.6%. Both retain manual
review independent of a new photo's margin.

## Handling copy and safety sources

P1/P2/P3 are local handling types, not urgency, sequence, or a complete hazard
classification. P3 can still involve high voltage, mercury, or toner. MR is a
review requirement, not a claim that a device is safe. Staff determine category,
condition, chemistry, and final handling by physical inspection and facility SOP.

Copy audit inspected local source texts and the existing
`research/cluster_sources.md` claim audit before changing guidance:

- Directive 2012/19/EU, Annex VII (`research/src/weee.txt`): separate batteries,
  mobile-phone PCBs, qualifying other PCBs, toner cartridges, mercury-bearing
  parts, and specified displays. This is technical reference, not a claim of
  Indonesian compliance or a rule that every small PCB meets the size criterion.
  <https://eur-lex.europa.eu/eli/dir/2012/19/oj>
- US EPA, Used Lithium-Ion Batteries (`research/src/epa_used_liion.txt`): keep
  Li-ion batteries out of general recycling and protect terminals against short
  circuits. Operational copy does not prescribe an unsupported fireproof vessel
  or imply all batteries are Li-ion.
  <https://www.epa.gov/recycle/used-lithium-ion-batteries>
- US CPSC Publication 5061 (`research/src/cpsc_micro.txt`): microwave shock risk
  persists after unplugging; professional handling is recommended. Copy removes
  instructions to discharge capacitors yourself and retains high-voltage warning.
- US EPA, Frequent Questions About CRTs (`research/src/epa_crt.txt`): lead risk
  differs between CRT funnel/frit and panel glass. Copy retains intact handling
  and specialist separation after confirming CRT construction.
- Basel Convention MPPI recovery guidance (`research/src/mppi_recovery.txt`):
  device/material recovery context, not measured metal content in a submitted
  photo. Named materials remain possible category references only.

Concrete washing-machine ballast and keyboard membrane composition were not
supported by the existing source audit; copy no longer asserts those materials.
C4/C10 chemistry and paper subtype interpretations require physical confirmation.
Only confirmed lead-acid batteries are directed to lead recovery. No photo-based
chemistry identification, metal assay, or facility-specific safe-work procedure
is claimed.
