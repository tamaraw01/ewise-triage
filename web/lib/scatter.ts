import analysisFlow from "../data/analysis-flow.json";

export type ScatterPoint = {
  x: number;
  y: number;
  c: number;
};

// Same full-population projection and consensus labels used by Statistics.
export const scatter: ScatterPoint[] = analysisFlow.points.map(p => ({ x: p[0], y: p[1], c: p[5] }));
