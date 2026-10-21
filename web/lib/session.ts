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
export const MAX_FILE_BYTES = 3_000_000;
export function validateFile(file: Pick<File, 'size' | 'type'>): string {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Format harus JPG, PNG, atau WebP.';
  if (!file.size) return 'Berkas kosong.';
  if (file.size > MAX_FILE_BYTES) return 'Ukuran melebihi 3 MB. Perkecil citra lalu pilih ulang.';
  return '';
}
export const MAX_PREDICTION_BYTES = 131_072;
function invalidPrediction(): never { throw new Error('Respons backend tidak valid. Coba ulang berkas ini.'); }
function copyPrediction(value: unknown): unknown {
  let nodes = 0;
  const copy = (value: unknown, depth: number): unknown => {
    if (++nodes > 10_000 || depth > 16) invalidPrediction();
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object') invalidPrediction();
    const array = Array.isArray(value);
    if (array ? value.length > 1000 : ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalidPrediction();
    const entries = Reflect.ownKeys(value).filter(key => !(array && key === 'length')).map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) ||
          !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
          (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) invalidPrediction();
      return [key, copy(descriptor.value, depth + 1)] as const;
    });
    if (array && entries.length !== value.length) invalidPrediction();
    return Object.freeze(array ? entries.map(entry => entry[1]) : Object.fromEntries(entries));
  };
  const result = copy(value, 0);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_PREDICTION_BYTES) invalidPrediction();
  return result;
}
export function parsePrediction(value: unknown): Prediction {
  const p = copyPrediction(value) as Prediction | null;
  if (!p || !['classified', 'review'].includes(p.status) || !Number.isFinite(p.margin) || !Number.isFinite(p.threshold) ||
      !p.cluster || !Number.isInteger(p.cluster.id) || typeof p.cluster.contested !== 'boolean' ||
      !(p.cluster.label === null || typeof p.cluster.label === 'string') ||
      typeof p.cluster.route !== 'string' || typeof p.cluster.handling !== 'string') {
    throw new Error('Respons backend tidak valid. Coba ulang berkas ini.');
  }
  if (p.ranking !== undefined && (!Array.isArray(p.ranking) || p.ranking.some(r =>
    !r || !Number.isInteger(r.cluster) || !(r.label === null || typeof r.label === 'string') ||
    !Number.isFinite(r.similarity) || r.similarity < -1 || r.similarity > 1))) {
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
export const NAMING_FAILURE_REASON = 'Jenis perangkat belum dapat dipastikan. Periksa barang secara manual sebelum menentukan jalur penanganan.';
export function manualExplanation(clusterId: number) {
  if (clusterId === 9) return {
    title: 'Foto perlu diperiksa ulang',
    body: 'Hasil cocok dengan kelompok referensi yang memuat foto berkualitas rendah atau warna yang berubah. Coba foto ulang dengan pencahayaan merata dan tanpa filter.',
  };
  if (clusterId === 11) return {
    title: 'Kategori pemutar musik perlu dikonfirmasi',
    body: 'Hasil cocok dengan kelompok referensi pemutar musik yang memiliki ketidaksesuaian label. Periksa jenis perangkat sebelum menentukan penanganan.',
  };
  return null;
}
export function manualReason(result: Prediction) {
  return manualExplanation(result.cluster.id)?.body ?? '';
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
