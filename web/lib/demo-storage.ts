import { parseStore, type DemoRecord } from './demo-records';
import { changePhotos } from './demo-photos';
import { validateFile } from './session';

export const KEY = 'ewise-demo-v1';

export async function mutateStore(update: ((records: readonly DemoRecord[]) => readonly DemoRecord[]) | null, photo?: { id: string; file: File }) {
  if (!navigator.locks) throw new Error('Browser tidak mendukung penguncian catatan. Gunakan browser terbaru; data tidak diubah.');
  return navigator.locks.request(KEY, async () => {
    const raw = localStorage.getItem(KEY);
    const previous = raw ? parseStore(raw).records : [];
    const next = update === null ? null : update(previous);
    const value = next === null ? null : JSON.stringify({ version: 1, records: next });
    if (value !== null) parseStore(value);
    if (photo) {
      const error = validateFile(photo.file);
      if (error) throw new Error(error);
      if (previous.some(row => row.id === photo.id) || !next?.some(row => row.id === photo.id)) throw new Error('ID foto tidak sesuai catatan baru.');
      await changePhotos(photo, []);
    }
    const removed = next === null ? null : previous.filter(row => !next.some(item => item.id === row.id)).map(row => row.id);
    try {
      if (value === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch (error) {
      if (photo) await changePhotos(undefined, [photo.id]);
      throw error;
    }
    if (removed === null || removed.length) {
      try { await changePhotos(undefined, removed); }
      catch (error) {
        // Deletion aborts atomically in IndexedDB; restore metadata under the same lock.
        if (raw === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, raw);
        throw error;
      }
    }
    return next ?? [];
  });
}
