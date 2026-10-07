// Panggilan dari browser diarahkan ke proxy server-side /api/predict
// (bukan langsung ke HF Space) agar:
// 1. HF_TOKEN tidak bocor ke client — disisipkan di server.
// 2. Kuota ZeroGPU terhitung sebagai pengguna terautentikasi, bukan anonim
//    (anonim sangat dibatasi dan memicu "ZeroGPU quota exceeded").
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://aditams-ewise-backend.hf.space";

import { validateFile } from './session';

export async function submitToBackend(file: File, signal?: AbortSignal) {
    const error = validateFile(file);
    if (error) throw new Error(error);
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ data: [{ url: base64, meta: { _type: "gradio.FileData" } }] }),
    });

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.error || errBody?.error || "Gagal terhubung ke backend");
    }

    return await res.json();
}

export function currentApiBase() { return API_BASE; }
export async function resolveApiBase() { return API_BASE; }
export async function backendSiap(base?: string) { return Boolean(base); }
