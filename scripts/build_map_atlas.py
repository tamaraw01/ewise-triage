"""Pack verified map derivatives into spatially ordered, bounded 512px atlas pages."""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1] / 'web'
photos = json.loads((ROOT / 'data/map-photos.json').read_text())['photos']
points = json.loads((ROOT / 'data/analysis-flow.json').read_text())['points']
order = sorted(range(len(points)), key=lambda i: (points[i][5], points[i][0], points[i][1]))
out = ROOT / 'public/map-atlas'
out.mkdir(exist_ok=True)
entries = [None] * len(photos)
pages = []
for start in range(0, len(order), 64):
    atlas = Image.new('RGB', (512, 512), '#1a1f18')
    page = len(pages)
    for slot, index in enumerate(order[start:start + 64]):
        x, y = slot % 8 * 64, slot // 8 * 64
        with Image.open(ROOT / 'public' / photos[index]['src'].lstrip('/')) as image:
            image = ImageOps.contain(image.convert('RGB'), (62, 62))
            atlas.paste(image, (x + (64-image.width)//2, y + (64-image.height)//2))
        entries[index] = [page, x, y]
    src = f'/map-atlas/{page}.webp'
    atlas.save(ROOT / 'public' / src.lstrip('/'), 'WEBP', quality=85, method=6)
    pages.append(src)
(ROOT / 'data/map-atlas.json').write_text(json.dumps({'cell':64,'size':512,'pages':pages,'entries':entries}, separators=(',', ':')) + '\n')
assert len(entries) == 2660 and all(entries)
print(f'{len(entries)} exact identities; {len(pages)} pages; {sum(p.stat().st_size for p in out.glob("*.webp"))} bytes; max decoded {len(pages)} MiB')
