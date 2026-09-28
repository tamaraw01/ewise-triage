"""Uji E2E mesin inference dengan citra dataset nyata dari beberapa kelas."""
import glob, os, json, random
import engine

st = engine.get_state()
print("DEVICE", st["device"], "| THRESHOLD", st["threshold"])
print("CENTROIDS", st["centroids"].shape)

roots = glob.glob(os.path.expanduser("~/.cache/kagglehub/**/*.jpg"), recursive=True)
if not roots:
    roots = glob.glob("/tmp/kag/**/*.jpg", recursive=True)
print("CANDIDATE IMAGES FOUND:", len(roots))

random.seed(7)
sample = random.sample(roots, min(8, len(roots))) if roots else []
for p in sample:
    with open(p, "rb") as f:
        out = engine.predict_bytes(f.read())
    print("---")
    print("file    ", os.path.basename(p)[:50])
    print("cluster ", out["cluster_id"], out["label"], "| route", out["route"])
    print("margin  ", round(out["margin"], 4), "| review", out["needs_review"])
    print("top3    ", [(t["cluster_id"], round(t["similarity"], 3)) for t in out["ranking"][:3]])
