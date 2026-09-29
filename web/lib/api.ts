const POINTER_URL =
  "https://raw.githubusercontent.com/tamaraw01/ewise-triage/master/api_base.txt";

const BUILD_TIME_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

let cached = "";

/** Alamat backend yang dipakai saat ini. Kosong sebelum resolveApiBase(). */
export function currentApiBase() {
  return cached || BUILD_TIME_BASE;
}

/**
 * Cari alamat backend saat dijalankan, bukan saat build.
 *
 * Tunnel Cloudflare berotasi, jadi URL yang ditanam saat build bisa sudah mati
 * di browser yang masih memegang bundel lama. Penunjuk di GitHub selalu berisi
 * alamat terbaru, dan nilai build dipakai bila penunjuk tidak terjangkau.
 */
export async function resolveApiBase(): Promise<string> {
  try {
    const res = await fetch(`${POINTER_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const url = (await res.text()).trim();
      if (/^https:\/\/[\w.-]+/.test(url)) {
        cached = url.replace(/\/$/, "");
        return cached;
      }
    }
  } catch {
    // Penunjuk tidak terjangkau; nilai build masih bisa dicoba.
  }
  cached = BUILD_TIME_BASE.replace(/\/$/, "");
  return cached;
}

/** True bila backend di alamat itu sudah panas dan siap melayani. */
export async function backendSiap(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const d = await res.json();
    return d?.model_loaded === true;
  } catch {
    return false;
  }
}
