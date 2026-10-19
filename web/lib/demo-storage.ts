import { parseStore, type DemoRecord } from './demo-records';

export const KEY = 'ewise-demo-v1';

export async function mutateStore(update: ((records: readonly DemoRecord[]) => readonly DemoRecord[]) | null) {
  if (!navigator.locks) throw new Error('Browser tidak mendukung penguncian catatan. Gunakan browser terbaru; data tidak diubah.');
  return navigator.locks.request(KEY, () => {
    const raw = localStorage.getItem(KEY);
    const next = update === null ? null : update(raw ? parseStore(raw).records : []);
    if (next === null) localStorage.removeItem(KEY);
    else {
      const value = JSON.stringify({ version: 1, records: next });
      parseStore(value);
      localStorage.setItem(KEY, value);
    }
    return next ?? [];
  });
}
