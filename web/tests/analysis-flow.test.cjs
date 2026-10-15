/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const flow=require('../data/analysis-flow.json');
const analytics=require('../data/analytics.json');
test('analysis flow ships all finite observations and valid partitions',()=>{
 assert.equal(flow.points.length,2660);
 const ks=analytics.selection.selected;
 for(const p of flow.points){assert.equal(p.length,6);assert.ok(p.every(Number.isFinite));[ks.kmeans,ks.ward,ks.gmm,ks.consensus].forEach((k,i)=>assert.ok(Number.isInteger(p[i+2])&&p[i+2]>=0&&p[i+2]<k));}
});
test('flow preserves shared geometry and evidence boundaries',()=>{
 const src=fs.readFileSync('components/AnalysisFlow.tsx','utf8');
 assert.match(src,/Math.min\(440 \/ .*300 \//);
 assert.match(src,/UMAP 2D langsung dari embedding L2/);
 assert.match(src,/CLIP, UMAP, dan pemilihan K tidak diulang/);
 assert.match(src,/bukan probabilitas/);
 assert.match(src,/prefers-reduced-motion: reduce/);
 assert.match(src,/revertOnUpdate:true/);
 assert.ok(src.indexOf('["Pilihan K"') < src.indexOf('["Clustering"'));
 assert.ok(src.indexOf('["Bootstrap"') < src.indexOf('["Penamaan"'));
});
