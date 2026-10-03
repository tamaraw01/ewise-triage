// Proxy server-side ke HF Space Gradio API — menyisipkan HF_TOKEN agar
// kuota ZeroGPU terhitung sebagai pengguna terautentikasi, bukan anonim
// (anonim dibatasi sangat rendah dan sering memicu error di sisi client).
import { NextRequest, NextResponse } from "next/server";

const HF_SPACE_BASE = "https://aditams-ewise-backend.hf.space";
const HF_TOKEN = process.env.HF_TOKEN;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (HF_TOKEN) headers["Authorization"] = `Bearer ${HF_TOKEN}`;

  const postRes = await fetch(`${HF_SPACE_BASE}/gradio_api/call/predict`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!postRes.ok) {
    return NextResponse.json({ error: `HF POST gagal: ${postRes.status}` }, { status: postRes.status });
  }

  const { event_id } = await postRes.json();

  const sseRes = await fetch(`${HF_SPACE_BASE}/gradio_api/call/predict/${event_id}`, {
    headers: HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {},
  });

  const text = await sseRes.text();

  // Parse SSE: cari baris "data: ..." terakhir yang relevan (complete/error)
  const lines = text.split("\n").filter((l) => l.startsWith("data:"));
  const lastData = lines.length ? lines[lines.length - 1].slice(5).trim() : null;

  let parsed: unknown = null;
  try {
    parsed = lastData ? JSON.parse(lastData) : null;
  } catch {
    parsed = lastData;
  }

  if (text.includes("event: error")) {
    return NextResponse.json({ error: parsed }, { status: 502 });
  }

  // Gradio call API membungkus hasil fungsi dalam array: [hasil]
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return NextResponse.json(result);
}
