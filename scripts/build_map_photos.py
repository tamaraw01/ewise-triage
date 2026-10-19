"""Build all map photos after exact assignment/manifest/byte verification.

License recorded by existing gallery audit: Kaggle samuelfrans/bdc2026-dataset,
CC0: Public Domain. No remote downloads or invented image matches.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(dataset):
    assignments = ROOT / "research/artifacts/cluster_results_final.csv"
    manifest_path = ROOT / "research/image_manifest.csv"
    rows = list(csv.DictReader(assignments.open()))
    manifest = {row["filename"]: row for row in csv.DictReader(manifest_path.open())}
    flow = json.loads((ROOT / "web/data/analysis-flow.json").read_text())
    gallery = json.loads((ROOT / "web/data/gallery.json").read_text())
    assert gallery["license"] == "CC0: Public Domain"
    assert gallery["sourceSha256"] == digest(assignments) == flow["provenance"]["sha256"]
    assert gallery["manifestSha256"] == digest(manifest_path)
    assert len(rows) == len(flow["points"]) == len({r["filename"] for r in rows}) == 2660
    # Validate whole population before writing any output.
    for row, point in zip(rows, flow["points"]):
        filename = row["filename"]
        entry = manifest[filename]
        source = dataset / filename
        assert Path(filename).name == filename
        assert entry["status"] == "kept" and entry["label"] == row["label_asli"]
        assert [float(row["umap_x"]), float(row["umap_y"]), int(row["cluster"])] == [point[0], point[1], point[5]]
        assert source.stat().st_size == int(entry["bytes"]) and digest(source) == entry["sha256"], filename
    out = ROOT / "web/public/map-photos"
    out.mkdir(parents=True, exist_ok=True)
    photos = []
    for i, row in enumerate(rows):
        target = out / f"{i}.webp"
        with Image.open(dataset / row["filename"]) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((480, 480))
            image.save(target, "WEBP", quality=85, method=6)
            width, height = image.size
        photos.append({"filename": row["filename"], "label": row["label_asli"], "src": f"/map-photos/{i}.webp", "width": width, "height": height, "sourceSha256": manifest[row["filename"]]["sha256"], "thumbnailSha256": digest(target)})
    result = {"population": len(rows), "sourceSha256": digest(assignments), "manifestSha256": digest(manifest_path), "dataset": gallery["dataset"], "license": gallery["license"], "photos": photos}
    (ROOT / "web/data/map-photos.json").write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(f"Verified {len(rows)} coordinates, assignments, filenames and source hashes; wrote {len(photos)} photos ({sum(p.stat().st_size for p in out.glob('*.webp'))} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    build(parser.parse_args().dataset)
