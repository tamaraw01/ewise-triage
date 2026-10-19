export type MapMark = { index: number; x: number; y: number };

// Only spatial intersection culls photos. Overlap never changes membership or position.
export function viewportPhotos(marks: MapMark[], width: number, height: number) {
  return marks.filter(p => p.x + 32 >= 0 && p.x - 32 <= width && p.y + 32 >= 0 && p.y - 32 <= height);
}

export function filenameLabels(marks: MapMark[], width: number, height: number, measure: (index: number) => number) {
  const boxes = marks.map(p => ({ ...p, left: p.x + 8, right: p.x + 8 + measure(p.index), top: p.y - 8, bottom: p.y + 8 }));
  return boxes.filter(p => p.left >= 0 && p.right <= width && p.top >= 0 && p.bottom <= height &&
    !boxes.some(q => q.index !== p.index && p.left < q.right + 4 && p.right + 4 > q.left && p.top < q.bottom + 4 && p.bottom + 4 > q.top) &&
    !marks.some(q => q.index !== p.index && q.x + 4 > p.left && q.x - 4 < p.right && q.y + 4 > p.top && q.y - 4 < p.bottom));
}

export function overviewLabels(marks: MapMark[], width: number, height: number) {
  const placed: MapMark[] = [];
  return marks.map(mark => {
    const candidates: { x: number; y: number }[] = [];
    for (let y = 26; y <= height - 26; y += 52)
      for (let x = 26; x <= width - 26; x += 52) candidates.push({ x, y });
    candidates.sort((a, b) => (a.x - mark.x) ** 2 + (a.y - mark.y) ** 2 - (b.x - mark.x) ** 2 - (b.y - mark.y) ** 2);
    const position = candidates.find(p => !placed.some(q => Math.abs(p.x - q.x) < 50 && Math.abs(p.y - q.y) < 50)) ?? candidates[0] ?? { x: 26, y: 26 };
    const label = { ...mark, ...position };
    placed.push(label);
    return { ...label, anchorX: mark.x, anchorY: mark.y };
  });
}
