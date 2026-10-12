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
