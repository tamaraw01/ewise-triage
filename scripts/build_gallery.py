"""Build verified member thumbnails; cluster membership comes only from final CSV."""
import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "research/artifacts/cluster_results_final.csv"
MANIFEST = ROOT / "research/image_manifest.csv"
LIMIT = 12


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def select_members(rows, limit=LIMIT):
    """One per filename-label stratum, then proportional deficit allocation.

    Hash ordering avoids picking only consecutively numbered filenames. This is
    a diversity sample, not a random sample or an estimate of cluster purity.
    Labels are filename proxies, never verified subtypes or cluster assignments.
    """
    groups = defaultdict(list)
    for row in rows:
        groups[row["label_asli"]].append(row)
    for group in groups.values():
        group.sort(key=lambda r: (hashlib.sha256(r["filename"].encode()).hexdigest(), r["filename"]))
    labels = sorted(groups)
    if limit < len(labels):
        raise ValueError("Sample limit cannot cover all labels")
    counts = {label: 1 for label in labels}
    target = min(limit, len(rows))
    while sum(counts.values()) < target:
        eligible = [label for label in labels if counts[label] < len(groups[label])]
        label = max(eligible, key=lambda label: (target * len(groups[label]) / len(rows) - counts[label], label))
        counts[label] += 1
    return [row for label in labels for row in groups[label][:counts[label]]]


def build(dataset, metadata):
    license_data = json.loads(metadata.read_text())
    if license_data.get("ref") != "samuelfrans/bdc2026-dataset" or license_data.get("licenseName") != "CC0: Public Domain":
        raise ValueError("Expected Kaggle dataset and CC0 license metadata")
    rows = list(csv.DictReader(SOURCE.open()))
    manifest = {r["filename"]: r for r in csv.DictReader(MANIFEST.open())}
    if len(rows) != 2660 or len({r['filename'] for r in rows}) != 2660:
        raise ValueError("Expected 2,660 unique final assignments")
    grouped = defaultdict(list)
    for row in rows:
        entry = manifest[row["filename"]]
        if entry["status"] != "kept" or entry["label"] != row["label_asli"] or Path(row["filename"]).name != row["filename"]:
            raise ValueError(f"Invalid manifest match: {row['filename']}")
        grouped[int(row["cluster"])].append(row)
    if sorted(grouped) != list(range(14)):
        raise ValueError("Expected clusters C0 through C13")
    out = ROOT / "web/public/gallery"
    out.mkdir(parents=True, exist_ok=True)
    clusters = []
    for cluster, members in sorted(grouped.items()):
        examples = []
        for row in select_members(members):
            filename = row["filename"]
            source = dataset / filename
            entry = manifest[filename]
            if digest(source) != entry["sha256"] or source.stat().st_size != int(entry["bytes"]):
                raise ValueError(f"Image bytes differ from manifest: {filename}")
            target = f"c{cluster}-{Path(filename).stem}.webp"
            with Image.open(source) as image:
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail((150, 150))
                image.save(out / target, "WEBP", quality=85, method=6)
                width, height = image.size
            examples.append({"filename": filename, "label": row["label_asli"], "src": f"/gallery/{target}", "width": width, "height": height, "sourceSha256": entry["sha256"], "thumbnailSha256": digest(out / target)})
        summary = {"id": cluster, "count": len(members), "systemLabel": members[0]["label_zeroshot"], "mix": dict(sorted(Counter(r["label_asli"] for r in members).items())), "sampleCount": len(examples)}
        clusters.append(summary)
        (out / f"C{cluster}.json").write_text(json.dumps({**summary, "examples": examples}, ensure_ascii=False, separators=(",", ":")) + "\n")
    index = {"population": len(rows), "sourceSha256": digest(SOURCE), "manifestSha256": digest(MANIFEST), "dataset": "https://www.kaggle.com/datasets/samuelfrans/bdc2026-dataset", "license": license_data["licenseName"], "selection": "filename-label-stratified; one per label then proportional deficit; SHA256 filename ordering; at most 12 per cluster", "clusters": clusters}
    (ROOT / "web/data/gallery.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n")
    print(f"Verified {len(rows)} assignments; wrote {sum(c['sampleCount'] for c in clusters)} thumbnails across {len(clusters)} clusters")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    args = parser.parse_args()
    build(args.dataset, args.metadata)
