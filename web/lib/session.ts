import { CLUSTERS_META, type LaneCode } from './data';

export type Prediction = {
  status: 'classified' | 'review'; margin: number; threshold: number;
  cluster: { id: number; label: string | null; contested: boolean; route: string; handling: string };
  ranking?: { cluster: number; label: string | null; similarity: number }[];
};
export type SessionItem = {
  id: string; file: File; status: 'queued' | 'loading' | 'done' | 'error' | 'cancelled';
  result?: Prediction; error?: string; review?: { lane: LaneCode; note: string };
};
// ponytail: keep one session at 20 images; persistent queues need server storage.
export const MAX_FILES = 20;
export const MAX_FILE_BYTES = 3_000_000;
export function validateFile(file: Pick<File, 'size' | 'type'>): string {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Format harus JPG, PNG, atau WebP.';
  if (!file.size) return 'Berkas kosong.';
  if (file.size > MAX_FILE_BYTES) return 'Ukuran melebihi 3 MB. Perkecil citra lalu pilih ulang.';
  return '';
}
export function parsePrediction(value: unknown): Prediction {
  const p = value as Prediction | null;
  if (!p || !['classified', 'review'].includes(p.status) || !Number.isFinite(p.margin) || !Number.isFinite(p.threshold) ||
      !p.cluster || !Number.isInteger(p.cluster.id) || typeof p.cluster.contested !== 'boolean' ||
      !(p.cluster.label === null || typeof p.cluster.label === 'string') ||
      typeof p.cluster.route !== 'string' || typeof p.cluster.handling !== 'string') {
    throw new Error('Respons backend tidak valid. Coba ulang berkas ini.');
  }
  return p;
}
export function reviewItem(item: SessionItem, lane: LaneCode, note: string): SessionItem {
  if (item.status !== 'done' || !item.result || !['P1', 'P2', 'P3', 'MR'].includes(lane) || !note.trim()) {
    throw new Error('Hasil dan catatan pemeriksaan wajib diisi.');
  }
  return { ...item, review: { lane, note: note.trim() } };
}
export const NAMING_FAILURES = [9, 11];
export const NAMING_FAILURE_REASON = 'Klaster dengan nama zero-shot bermasalah (paper §3.7)';
export function manualReason(result: Prediction) {
  return NAMING_FAILURES.includes(result.cluster.id) ? NAMING_FAILURE_REASON : '';
}
export function candidateLabel(result: Prediction) {
  return result.cluster.label ?? result.ranking?.[0]?.label ?? null;
}
export function automaticLane(result: Prediction): LaneCode {
  const cluster = CLUSTERS_META[result.cluster.id];
  return result.status === 'classified' && result.cluster.route !== 'MANUAL_REVIEW' && !result.cluster.contested && !manualReason(result) && cluster ? cluster.lane : 'MR';
}
// Research-only figures: dominant-class counts per cluster; never mixed with live session results.
export function researchSubset() {
  const clusters = Object.values(CLUSTERS_META);
  const total = clusters.reduce((sum, c) => sum + c.n, 0);
  const kept = clusters.filter(c => !NAMING_FAILURES.includes(c.id));
  const keptN = kept.reduce((sum, c) => sum + c.n, 0);
  const correct = kept.reduce((sum, c) => sum + (c.name === c.dom ? c.n * c.pur / 100 : 0), 0);
  const purity = clusters.reduce((sum, c) => sum + c.n * c.pur / 100, 0) / total;
  return { total, kept: keptN, coverage: keptN / total, accuracy: correct / keptN, purity };
}
export async function runQueue(rows: SessionItem[], predict: (file: File, signal?: AbortSignal) => Promise<unknown>, update: (id: string, patch: Partial<SessionItem>) => void, stopped: () => boolean, signal?: AbortSignal) {
  for (const row of rows) {
    if (stopped()) { update(row.id, { status: 'cancelled' }); continue; }
    update(row.id, { status: 'loading', error: undefined });
    try {
      const error = validateFile(row.file);
      if (error) throw new Error(error);
      const result = parsePrediction(await predict(row.file, signal));
      update(row.id, { status: 'done', result });
    } catch (error) {
      if (signal?.aborted) { update(row.id, { status: 'cancelled' }); continue; }
      update(row.id, { status: 'error', error: error instanceof Error ? error.message : 'Unggahan gagal. Coba lagi.' });
    }
  }
}
export function summarize(rows: SessionItem[]) {
  const totals = { success: 0, failed: 0, pending: 0, reviewed: 0, unresolved: 0, lanes: { P1: 0, P2: 0, P3: 0, MR: 0 } };
  for (const row of rows) {
    if (row.status === 'done' && row.result) {
      totals.success++;
      const lane = row.review?.lane ?? automaticLane(row.result);
      totals.lanes[lane]++;
      if (row.review) totals.reviewed++;
      if (lane === 'MR') totals.unresolved++;
    } else if (row.status === 'error') totals.failed++;
    else if (row.status === 'queued' || row.status === 'loading') totals.pending++;
  }
  return totals;
}
