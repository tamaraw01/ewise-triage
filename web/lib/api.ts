export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://aditams-ewise-backend.hf.space";

export async function submitToBackend(file: File) {
    const url = `${API_BASE}/gradio_api/call/predict`;

    // Gradio via REST expect list of inputs
    // For images or files via API, we usually pass base64 or upload it via /upload endpoint first
    // For simpler approach (avoiding gradio base64 constraints), we use the proper huggingface gradio client

    // Convert to base64
    const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [{ url: base64, meta: { _type: "gradio.FileData" } }] })
    });

    if (!res.ok) throw new Error("Gagal terhubung ke backend HF");

    // Gradio async task yields event ID
    const { event_id } = await res.json();

    // Listen to stream for result
    const responseStream = await fetch(`${API_BASE}/gradio_api/call/predict/${event_id}`);
    const streamText = await responseStream.text();

    // Gradio returns stream of events: event: complete\ndata: [...]
    const matches = streamText.match(/event: complete\ndata: (.*)/);
    if (!matches) throw new Error("Response dari HF backend gagal diparsing");

    const resultJson = JSON.parse(matches[1]);
    return resultJson[0]; // data output adalah element ke-0 dari array hasil
}

export function currentApiBase() { return API_BASE; }
export async function resolveApiBase() { return API_BASE; }
export async function backendSiap(_base?: string) { return true; }
