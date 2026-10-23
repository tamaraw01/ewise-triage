export const PHOTO_DB = 'ewise-photos-v1';
const STORE = 'photos';

async function openPhotos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Penyimpanan foto terhalang tab lain. Tutup tab E-WISE lain lalu coba lagi.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export async function readPhoto(id: string): Promise<Blob | undefined> {
  const db = await openPhotos();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(id);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Foto gagal dibaca.'));
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

// Keep metadata unchanged unless evidence requests succeed; caller holds the shared record lock.
export async function changePhotos(photo: { id: string; file: File } | undefined, removed: string[] | null, commit: () => void = () => {}) {
  const db = await openPhotos();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      let failure: unknown;
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Foto gagal disimpan. Periksa ruang penyimpanan browser.'));
      transaction.onerror = () => { /* onabort reports transaction failure. */ };
      let last: IDBRequest;
      if (removed === null) last = store.clear();
      else {
        for (const id of removed) store.delete(id);
        last = photo ? store.put(photo.file, photo.id) : store.count();
      }
      last.onsuccess = () => {
        try { commit(); } catch (error) { failure = error; transaction.abort(); }
      };
    });
  } finally { db.close(); }
}
