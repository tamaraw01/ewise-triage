#!/usr/bin/env python3
"""Audit saved EXP14 artifacts and local Electronic images; never run backbone.

Inputs stay local (research/ is gitignored): research/artifacts/ holds the
output files of https://www.kaggle.com/code/arimakaori/cluster-14.
Writes web/data/analytics.json, the only data source of the Statistik tab.
"""
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import (accuracy_score, adjusted_rand_score, confusion_matrix,
                             normalized_mutual_info_score, precision_recall_fscore_support,
                             silhouette_score)

ROOT = Path(__file__).resolve().parents[1]
CLASSES = ['Battery', 'Keyboard', 'Microwave', 'Mobile', 'Mouse', 'PCB', 'Player', 'Printer', 'Television', 'Washing Machine']
PATTERNS = [(c, re.compile('^' + r'[\s_\-]*'.join(map(re.escape, c.split())), re.I)) for c in CLASSES]


def read_csv(path):
    with path.open(newline='') as handle:
        return list(csv.DictReader(handle))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stats(values):
    a = np.asarray(values, dtype=float)
    return {'n': len(a), 'min': float(a.min()), 'p05': float(np.quantile(a, .05)),
            'p25': float(np.quantile(a, .25)), 'median': float(np.median(a)),
            'p75': float(np.quantile(a, .75)), 'p95': float(np.quantile(a, .95)),
            'max': float(a.max()), 'mean': float(a.mean()),
            'stdSample': float(a.std(ddof=1)) if len(a) > 1 else 0.0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--paper', type=Path, help='paper PDF; only its SHA256 is recorded')
    args = parser.parse_args()
    dataset = args.dataset.resolve()
    if dataset.name != '1_Electronic' or not dataset.is_dir():
        parser.error('--dataset must point to existing 1_Electronic directory')
    art = ROOT / 'research/artifacts'
    rows = read_csv(art / 'cluster_results_final.csv')
    dropped = read_csv(art / 'dropped_files.csv')
    cfg = json.loads((art / 'run_config.json').read_text())
    kept_names = {r['filename'] for r in rows}
    drop_names = {r['filename'] for r in dropped}
    assert len(rows) == len(kept_names) == 2660
    assert len(dropped) == len(drop_names) == 1301
    assert not kept_names & drop_names
    paths = sorted(p for p in dataset.iterdir() if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'})
    assert {p.name for p in paths} == kept_names | drop_names
    manifest, errors = [], []
    for path in paths:
        label = next((c for c, pattern in PATTERNS if pattern.match(path.name)), None)
        assert (label is not None) == (path.name in kept_names)
        try:
            with Image.open(path) as image:
                width, height, mode, fmt = *image.size, image.mode, image.format
                image.verify()
            manifest.append({'filename': path.name, 'status': 'kept' if label else 'excluded',
                             'label': label or '', 'width': width, 'height': height,
                             'bytes': path.stat().st_size, 'mode': mode, 'format': fmt,
                             'sha256': digest(path)})
        except Exception as exc:
            errors.append({'filename': path.name, 'error': str(exc)})
    assert not errors, errors
    manifest_path = ROOT / 'research/image_manifest.csv'
    with manifest_path.open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(manifest[0]))
        writer.writeheader()
        writer.writerows(manifest)
    y = [r['label_asli'] for r in rows]
    pred = [r['label_zeroshot'] for r in rows]
    clusters = np.array([int(r['cluster']) for r in rows])
    labels_by_name = {r['filename']: r['label'] for r in read_csv(art / 'labels_ground_truth.csv')}
    assert labels_by_name == {r['filename']: r['label_asli'] for r in rows}
    assert all(labels_by_name[m['filename']] == m['label'] for m in manifest if m['status'] == 'kept')
    cm = confusion_matrix(y, pred, labels=CLASSES)
    precision, recall, f1, support = precision_recall_fscore_support(y, pred, labels=CLASSES, zero_division=0)
    class_rows = [{'label': c, 'count': int(support[i]), 'share': float(support[i] / len(rows)),
                   'predictedCount': pred.count(c), 'precision': float(precision[i]),
                   'recall': float(recall[i]), 'f1': float(f1[i])} for i, c in enumerate(CLASSES)]
    cross = [[sum(int(r['cluster']) == c and r['label_asli'] == label for r in rows) for label in CLASSES] for c in range(14)]
    cluster_labels = read_csv(art / 'zeroshot_cluster_labels.csv')
    similarities = read_csv(art / 'zeroshot_mean_similarity.csv')
    cluster_audit = []
    for c, item in enumerate(cluster_labels):
        assert int(item['cluster']) == c
        total = sum(cross[c])
        assert total == int(item['n_images'])
        majority = CLASSES[int(np.argmax(cross[c]))]
        scores = {label: float(similarities[c][label]) for label in CLASSES}
        ranked = sorted(scores, key=scores.get, reverse=True)
        assert ranked[0] == item['label_zeroshot']
        cluster_audit.append({'id': c, 'count': total, 'label': item['label_zeroshot'],
                              'dominantClass': majority, 'purity': max(cross[c]) / total,
                              'correctNaming': majority == item['label_zeroshot'],
                              'topSimilarity': scores[ranked[0]], 'secondLabel': ranked[1],
                              'namingMargin': scores[ranked[0]] - scores[ranked[1]],
                              'promptSimilarities': scores})
    review_ids = [r['id'] for r in cluster_audit if r['namingMargin'] < .03]
    accepted = [r for r in rows if int(r['cluster']) not in review_ids]
    boot = [{k: int(v) if k in ('bootstrap', 'n_unique') else float(v) for k, v in r.items()} for r in read_csv(art / 'bootstrap_ari.csv')]
    assert len(boot) == 50 and [r['bootstrap'] for r in boot] == list(range(1, 51))
    curves = [{k: int(v) if k == 'K' else float(v) for k, v in r.items()} for r in read_csv(art / 'k_selection.csv')]
    assert [r['K'] for r in curves] == list(range(2, 26))
    parts = {key: np.array([int(r['cluster_' + key]) for r in rows]) for key in ['kmeans', 'ward', 'gmm']}
    co = sum((v[:, None] == v[None, :]).astype(np.float32) for v in parts.values()) / 3
    distance = 1 - co
    np.fill_diagonal(distance, 0)
    umap = np.load(art / 'umap_50d.npy', allow_pickle=False)
    assert umap.shape == (2660, 50) and np.isfinite(umap).all()
    consensus_curves = []
    for k in range(9, 15):
        lab = AgglomerativeClustering(n_clusters=k, metric='precomputed', linkage='average').fit_predict(distance)
        consensus_curves.append({'k': k, 'silhouetteCoassociation': float(silhouette_score(distance, lab, metric='precomputed')),
                                 'silhouetteUmap50d': float(silhouette_score(umap, lab))})
        if k == 14:
            assert adjusted_rand_score(clusters, lab) == 1
    block_means = [[float(co[np.ix_(clusters == a, clusters == b)].mean()) for b in range(14)] for a in range(14)]
    def image_group(status):
        group = [m for m in manifest if m['status'] == status]
        hashes = Counter(m['sha256'] for m in group)
        long_sides = [max(m['width'], m['height']) for m in group]
        bins = [(None, 150, '≤150'), (150, 224, '151–224'), (224, 512, '225–512'), (512, 1024, '513–1024'), (1024, None, '>1024')]
        return {'count': len(group), 'width': stats([m['width'] for m in group]),
                'height': stats([m['height'] for m in group]), 'bytes': stats([m['bytes'] for m in group]),
                'megapixels': stats([m['width'] * m['height'] / 1e6 for m in group]),
                'longSideBins': [{'label': label, 'count': sum((lo is None or x > lo) and (hi is None or x <= hi) for x in long_sides)} for lo, hi, label in bins],
                'topDimensions': [{'width': w, 'height': h, 'count': n} for (w, h), n in Counter((m['width'], m['height']) for m in group).most_common(8)],
                'formats': dict(Counter(m['format'] for m in group)), 'modes': dict(Counter(m['mode'] for m in group)),
                'exactDuplicateGroups': sum(n > 1 for n in hashes.values()), 'exactDuplicateExtraFiles': sum(n - 1 for n in hashes.values())}
    result = {
        'schemaVersion': 1,
        'provenance': {'notebook': 'https://www.kaggle.com/code/arimakaori/cluster-14',
                       'dataset': 'https://www.kaggle.com/datasets/samuelfrans/bdc2026-dataset',
                       'scope': 'BDC2026 train/1_Electronic only; all 3961 local filenames match saved manifests',
                       'computedFrom': 'Saved EXP14 CSV/UMAP50D and local image headers/bytes; no backbone or bootstrap rerun',
                       'artifactHashes': {p.name: digest(p) for p in sorted(art.iterdir()) if p.is_file()},
                       'manifestSha256': digest(manifest_path), 'sourceNotebookSha256': digest(ROOT / 'research/source/cluster-14.ipynb'),
                       'paperSha256': digest(args.paper) if args.paper else None},
        'population': {'total': len(paths), 'kept': len(rows), 'excluded': len(dropped), 'keptShare': len(rows)/len(paths),
                       'classCount': 10, 'clusterCount': 14, 'filterRule': 'case-insensitive filename prefix; spaces, underscores, hyphens interchangeable between class words',
                       'exclusionReason': 'No supported class prefix; not image corruption or model rejection',
                       'labelMeaning': 'Filename-prefix proxy labels, not independently relabeled ground truth', 'seed': cfg['seed']},
        'classDistribution': class_rows,
        'imageAudit': {'source': 'local-images', 'manifest': 'research/image_manifest.csv', 'readErrors': errors,
                       'resolutionDefinition': 'longest side in pixels; dimensions measured before EXIF orientation or CLIP preprocessing',
                       'quantileMethod': 'NumPy linear interpolation', 'kept': image_group('kept'), 'excluded': image_group('excluded')},
        'evaluation': {'source': 'artifact-computed', 'count': len(rows), 'accuracy': float(accuracy_score(y, pred)),
                       'macroF1': float(f1.mean()), 'weightedF1': float(np.average(f1, weights=support)),
                       'ariLabels': float(adjusted_rand_score(y, pred)), 'ariClusters': float(adjusted_rand_score(y, clusters)),
                       'nmiClusters': float(normalized_mutual_info_score(y, clusters)),
                       'purity': sum(max(row) for row in cross) / len(rows), 'representedClasses': len(set(pred)),
                       'confusion': {'rowLabels': CLASSES, 'columnLabels': CLASSES, 'values': cm.tolist()},
                       'triageIllustration': {'marginType': 'cluster-naming cosine similarity top1 minus top2; NOT image-centroid inference margin',
                                             'threshold': .03, 'rule': 'review namingMargin < threshold', 'reviewClusterIds': review_ids,
                                             'reviewCount': len(rows)-len(accepted), 'acceptedCount': len(accepted),
                                             'acceptedAccuracy': sum(r['label_asli'] == r['label_zeroshot'] for r in accepted)/len(accepted),
                                             'limitation': 'Retrospective descriptive threshold, not calibrated confidence or independent deployment validation'}},
        'clusterAudit': {'source': 'artifact-computed', 'clusters': cluster_audit,
                         'crossTab': {'rowClusterIds': list(range(14)), 'columnLabels': CLASSES, 'values': cross},
                         'coassociationBlockMeans': {'rowClusterIds': list(range(14)), 'columnClusterIds': list(range(14)),
                                                     'values': block_means, 'definition': 'Mean pairwise agreement of saved three base partitions within each cluster pair; includes diagonal self-pairs'}},
        'selection': {'source': 'artifact-computed', 'space': 'UMAP 50D; 2D projection is visualization only',
                      'baseCurves': curves, 'selected': {'kmeans': 9, 'ward': 9, 'gmm': 14, 'consensus': 14},
                      'criteria': {'kmeans': 'maximum silhouette', 'ward': 'maximum silhouette', 'gmm': 'minimum BIC', 'consensus': 'maximum silhouette on precomputed D=1-coassociation'},
                      'consensusCurves': consensus_curves,
                      'basePartitionAgreement': [{'method': k, 'clusterCount': len(set(v)), 'ariAgainstConsensus': float(adjusted_rand_score(clusters, v)),
                                                  'ariAgainstPrefix': float(adjusted_rand_score(y, v)), 'silhouetteUmap50d': float(silhouette_score(umap, v))} for k, v in parts.items()]},
        'bootstrap': {'source': 'saved-bootstrap-artifact', 'replicates': 50,
                      'protocol': 'Sample N indices with replacement, keep unique indices; refit base partitions and consensus on fixed saved UMAP50D, fixed selected K, seed 42+b+1; compare same unique observations to full-data reference',
                      'limitation': 'Does not rerun CLIP, UMAP or K-selection; SD is across replicate ARI, not accuracy SE or confidence interval',
                      'rows': boot, 'summary': {k: stats([r['ARI_'+k] for r in boot]) for k in ['ensemble', 'kmeans', 'ward', 'gmm']}},
        'paperReported': {'source': 'paper-reported', 'paper': 'BDC_Semifinalis_SD2026040000497-2.pdf',
                          'references': {'dataset': 'pp.4–6 Tables 1–2', 'metrics': 'pp.10–15 Tables 3–7', 'triage': 'p.15 §3.7; inference differs p.16 §3.8'},
                          'standaloneComparison': [
                              {'method': 'Ensemble EAC', 'k': 14, 'accuracy': .8778, 'macroF1': .8450, 'weightedF1': .8453, 'purity': .9692, 'nmi': .8944, 'bootstrapMean': .9417},
                              {'method': 'K-Means standalone', 'k': 9, 'accuracy': .7883, 'macroF1': .7220, 'weightedF1': .7214, 'purity': .8793, 'nmi': .9021, 'bootstrapMean': .9997},
                              {'method': 'Ward standalone', 'k': 9, 'accuracy': .7910, 'macroF1': .7224, 'weightedF1': .7220, 'purity': .8820, 'nmi': .9080, 'bootstrapMean': .9722},
                              {'method': 'GMM standalone', 'k': 14, 'accuracy': .8767, 'macroF1': .8442, 'weightedF1': .8446, 'purity': .9677, 'nmi': .9138, 'bootstrapMean': .9684}],
                          'standaloneArtifactsAvailable': False,
                          'subtypes': [{'clusterIds': [4, 10], 'labels': ['Li-ion/ponsel/laptop', 'sel silinder & aki']},
                                       {'clusterIds': [8, 12], 'labels': ['layar datar', 'tabung CRT']},
                                       {'clusterIds': [2, 5], 'labels': ['bukaan depan', 'bukaan atas']}],
                          'subtypeCaveat': 'Qualitative paper interpretation; not verified subtype labels for each image'},
        'discrepancies': [
            {'topic': 'Cakupan pembanding bootstrap', 'detail': 'Rata-rata standalone di Tabel 4 paper (KMeans 0,9997, Ward 0,9722, GMM 0,9684) bukan rata-rata replikasi base EXP14. Dua eksperimen ini tidak digabung.'},
            {'topic': 'Silhouette GMM', 'detail': 'GMM base di Tabel 3 paper bernilai 0,7424, sedangkan GMM standalone di Tabel 7 bernilai 0,8172. Label base EXP14 yang tersimpan dicek terpisah di selection.basePartitionAgreement.'},
            {'topic': 'Bin resolusi', 'detail': 'Jumlah citra dikeluarkan di Tabel 2 paper [1, 9, 197, 669, 425] tidak cocok dengan hitungan lokal sisi terpanjang [1, 5, 137, 290, 868], sisi terpendek [6, 24, 273, 659, 339], lebar [1, 8, 141, 478, 673], maupun tinggi [6, 21, 269, 471, 534]. Dashboard memakai bin sisi terpanjang dari berkas asli. Penyebab selisih dengan paper belum diketahui.'},
            {'topic': 'Pembulatan konsensus K9', 'detail': 'Hitung ulang dari partisi tersimpan memberi silhouette(D) 0,898461759 pada K9, jadi 0,898 bila dibulatkan tiga desimal. Paper §3.1 menulis 0,899. Pilihan K14 tidak berubah.'},
            {'topic': 'Cakupan bootstrap', 'detail': 'Notebook menyebutnya pipeline ensemble penuh, tetapi kodenya menahan embedding CLIP, UMAP, dan K tetap. Yang diulang hanya partisi clustering dan konsensus.'},
            {'topic': 'Arti margin', 'detail': 'Margin penamaan klaster berbasis teks (§3.7) berbeda dari margin image-centroid yang dipakai di Konsol (§3.8, ambang 0,0297 di web/data/meta.json). Kalibrasi satu margin tidak berlaku untuk margin lain.'},
            {'topic': 'Bukti standalone', 'detail': 'Hanya notebook cluster-14 yang diambil. Tabel 7 standalone dan tafsir subtipe masih angka paper, belum dicek dari artefak.'}]
    }
    output = ROOT / 'web/data/analytics.json'
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    print(json.dumps({'output': str(output), 'bytes': output.stat().st_size, 'classes': {c['label']: c['count'] for c in class_rows},
                      'evaluation': {k: result['evaluation'][k] for k in ['accuracy', 'macroF1', 'purity']},
                      'bootstrapMeans': {k: v['mean'] for k, v in result['bootstrap']['summary'].items()},
                      'imageBins': {k: result['imageAudit'][k]['longSideBins'] for k in ['kept', 'excluded']}}, indent=2))
    # ponytail: aggregate audit plots only; per-image exploration lives in manifest.
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    figures = ROOT / 'research/figures'
    figures.mkdir(exist_ok=True)
    for name in ['class_distribution', 'resolution_distribution', 'file_bytes']:
        fig, ax = plt.subplots(figsize=(10, 4))
        if name == 'class_distribution':
            ax.bar(CLASSES, support); ax.tick_params(axis='x', rotation=35); ax.set_ylabel('Citra input')
        elif name == 'resolution_distribution':
            for offset, status in [(-.2, 'kept'), (.2, 'excluded')]:
                counts = result['imageAudit'][status]['longSideBins']
                ax.bar(np.arange(5)+offset, [x['count'] for x in counts], width=.4, label=status)
            ax.set_xticks(range(5), [x['label'] for x in counts]); ax.set_xlabel('Sisi terpanjang (px)'); ax.legend()
        else:
            for status in ['kept', 'excluded']:
                ax.hist([np.log10(m['bytes']) for m in manifest if m['status'] == status], bins=30, alpha=.5, label=status)
            ax.set_xlabel('log10 ukuran file (bytes)'); ax.legend()
        fig.tight_layout(); fig.savefig(figures / (name + '.png'), dpi=120); plt.close(fig)


if __name__ == '__main__':
    main()
