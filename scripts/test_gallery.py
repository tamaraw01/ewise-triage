"""Run with ds-sandbox Python; no external test runner required."""
import csv
import json
from pathlib import Path

from PIL import Image
from build_gallery import ROOT, SOURCE, digest, select_members

rows = list(csv.DictReader(SOURCE.open()))
dataset = Path('/home/aditama/Downloads/Dataset BDC 2026/train/1_Electronic')
for cluster in range(14):
    members = [row for row in rows if int(row['cluster']) == cluster]
    selected = select_members(members)
    assert selected == select_members(list(reversed(members)))
    assert len(selected) == 12
    assert {row['label_asli'] for row in selected} == {row['label_asli'] for row in members}
    chunk = json.loads((ROOT / f'web/public/gallery/C{cluster}.json').read_text())
    assert [row['filename'] for row in selected] == [item['filename'] for item in chunk['examples']]
    for item in chunk['examples']:
        assert digest(dataset / item['filename']) == item['sourceSha256']
        with Image.open(ROOT / 'web/public' / item['src'].lstrip('/')) as image:
            image.load()
            assert image.size == (item['width'], item['height'])
            assert max(image.size) <= 150
print('PASS: deterministic stratification, source SHA256 and decoded thumbnail sizes for 168 images')
