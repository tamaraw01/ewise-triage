import { parsePrediction, type Prediction } from './session';
import { CLUSTERS_META, type LaneCode } from './data';

export const UNRESOLVED_CATEGORY = 'Belum dipastikan';
export function categoriesForLane(lane: LaneCode): string[] {
  return [...new Set([
    ...(lane === 'MR' ? [UNRESOLVED_CATEGORY] : []),
    ...Object.values(CLUSTERS_META).filter(cluster => cluster.lane === lane).map(cluster => cluster.id === 9 ? 'Perangkat campuran (perlu pemeriksaan)' : cluster.sub),
  ])];
}

export function deleteRecord(rows: readonly DemoRecord[], expected: DemoRecord): readonly DemoRecord[] {
  const latest = rows.find(row => row.id === expected.id);
  if (!latest || latest.reviews.at(-1)?.id !== expected.reviews.at(-1)?.id) {
    throw new Error('Catatan berubah di tab lain. Muat ulang dan periksa sebelum menghapus.');
  }
  return rows.filter(row => row.id !== expected.id);
}

export const MAX_RECORDS = 100;
export const MAX_REVIEWS = 100;
export const PROVENANCE = 'backend version not supplied';
export const DEMO_ACTOR = 'Sesi demo (tanpa akun)';
export type DemoReview = Readonly<{
  id: string; at: string; category: string; lane: LaneCode; note: string;
  status: 'review' | 'done'; actor: typeof DEMO_ACTOR;
}>;
export type ReviewInput = Pick<DemoReview, 'category' | 'lane' | 'note' | 'status'>;
export type DemoRecord = Readonly<{
  id: string; createdAt: string; fileName: string; inference: Prediction;
  provenance: string | number; status: 'pending' | 'review' | 'done';
  reviews: readonly DemoReview[];
}>;
export type DemoStore = Readonly<{ version: 1; records: readonly DemoRecord[] }>;

function invalid(): never { throw new Error('Data sesi demo tidak valid. Data tersimpan tidak diubah.'); }
function object(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const data = value as Record<string, unknown>;
  if (required.some(key => !Object.hasOwn(data, key)) ||
      Reflect.ownKeys(data).some(key => typeof key !== 'string' || ![...required, ...optional].includes(key))) invalid();
  return data;
}
function text(value: unknown, max: number, empty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid();
}
function id(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid();
}
function timestamp(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid();
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function prediction(value: unknown): Prediction {
  const p = parsePrediction(value);
  if (p.cluster.label !== null) text(p.cluster.label, 200);
  text(p.cluster.route, 200); text(p.cluster.handling, 4000, true);
  if (p.ranking !== undefined) {
    if (p.ranking.length > 100) invalid();
    for (const r of p.ranking) if (r.label !== null) text(r.label, 200);
  }
  return p;
}
function reviewInput(value: unknown): ReviewInput {
  const r = object(value, ['category', 'lane', 'note', 'status']);
  text(r.category, 200); text(r.note, 2000);
  if (!['P1', 'P2', 'P3', 'MR'].includes(r.lane as string) ||
      !['review', 'done'].includes(r.status as string) || (r.lane === 'MR' && r.status === 'done')) invalid();
  return r as ReviewInput;
}
function provenance(inference: Prediction): string | number {
  const fields = inference as Prediction & Record<string, unknown>;
  for (const key of ['model_version', 'backend_version', 'version']) {
    const value = fields[key];
    if ((typeof value === 'string' && value.trim()) || (typeof value === 'number' && Number.isFinite(value))) return value;
  }
  return PROVENANCE;
}
function record(value: unknown): DemoRecord {
  const r = object(value, ['id', 'createdAt', 'fileName', 'inference', 'provenance', 'status', 'reviews']);
  id(r.id); timestamp(r.createdAt); text(r.fileName, 255);
  prediction(r.inference);
  if (r.provenance !== provenance(r.inference as Prediction) || !Array.isArray(r.reviews) || r.reviews.length > MAX_REVIEWS) invalid();
  const ids = new Set([r.id]);
  // Append order is authoritative; device clocks can move backwards.
  for (const value of r.reviews) {
    const review = object(value, ['id', 'at', 'category', 'lane', 'note', 'status', 'actor']);
    id(review.id); timestamp(review.at);
    reviewInput({ category: review.category, lane: review.lane, note: review.note, status: review.status });
    if (review.actor !== DEMO_ACTOR || ids.has(review.id)) invalid();
    ids.add(review.id);
  }
  if (r.status !== (r.reviews.at(-1)?.status ?? 'pending')) invalid();
  return r as DemoRecord;
}

export function createRecord(value: Prediction, fileName: string): DemoRecord {
  const inference = prediction(value);
  return freeze(record({ id: globalThis.crypto.randomUUID(), createdAt: new Date().toISOString(), fileName,
    inference, provenance: provenance(inference), status: 'pending', reviews: [] }));
}
export function appendReview(value: DemoRecord, input: ReviewInput): DemoRecord {
  const original = record(value);
  const fields = reviewInput(input);
  if (!categoriesForLane(fields.lane).includes(fields.category)) {
    throw new Error('Pilih kategori yang sesuai acuan penanganan.');
  }
  if (original.reviews.length >= MAX_REVIEWS) invalid();
  const at = new Date().toISOString();
  const review = { ...fields, id: globalThis.crypto.randomUUID(), at, actor: DEMO_ACTOR };
  return freeze(record({ ...original, status: review.status, reviews: [...original.reviews, review] }));
}
export function parseStore(raw: unknown): DemoStore {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const store = object(value, ['version', 'records']);
  if (store.version !== 1 || !Array.isArray(store.records) || store.records.length > MAX_RECORDS) invalid();
  const ids = new Set<string>();
  for (const value of store.records) {
    const r = record(value);
    for (const key of [r.id, ...r.reviews.map(review => review.id)]) {
      if (ids.has(key)) invalid();
      ids.add(key);
    }
  }
  // Clone before freezing so caller-owned objects remain untouched.
  return freeze(JSON.parse(JSON.stringify(store))) as DemoStore;
}
