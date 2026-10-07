import { NextRequest, NextResponse } from 'next/server';
import { MAX_FILE_BYTES, parsePrediction } from '@/lib/session';

const HF_SPACE_BASE = 'https://aditams-ewise-backend.hf.space';
const MAX_DATA_URL = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 30;
export const maxDuration = 100;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length')) > MAX_DATA_URL + 200) return fail('Berkas melebihi 3 MB.', 413);
  let url: unknown;
  try { url = (await req.json())?.data?.[0]?.url; } catch { return fail('Body JSON tidak valid.', 400); }
  if (typeof url !== 'string') return fail('Kirim satu citra data URL.', 400);
  if (url.length > MAX_DATA_URL) return fail('Berkas melebihi 3 MB.', 413);
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!match) return fail('Unggah JPG, PNG, atau WebP.', 400);
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_FILE_BYTES) return fail('Berkas melebihi 3 MB.', 413);
  const signature = { jpeg: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    png: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    webp: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' }[match[1] as 'jpeg' | 'png' | 'webp'];
  if (!signature) return fail('Isi berkas tidak cocok dengan format citra.', 400);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.HF_TOKEN) headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
    const signal = AbortSignal.timeout(90_000);
    const body = JSON.stringify({ data: [{ url: `data:image/${match[1]};base64,${match[2]}`, meta: { _type: 'gradio.FileData' } }] });
    const queued = await fetch(`${HF_SPACE_BASE}/gradio_api/call/predict`, { method: 'POST', headers, signal, body });
    if (!queued.ok) return fail(`Backend menolak antrean (${queued.status}).`, 502);
    const { event_id } = await queued.json();
    if (typeof event_id !== 'string' || !/^[\w-]+$/.test(event_id)) return fail('ID antrean backend tidak valid.', 502);
    const stream = await fetch(`${HF_SPACE_BASE}/gradio_api/call/predict/${event_id}`, { headers, signal });
    if (!stream.ok) return fail(`Backend gagal mengirim hasil (${stream.status}).`, 502);
    for (const event of (await stream.text()).replace(/\r\n/g, '\n').split('\n\n')) {
      const name = /^event: (\w+)$/m.exec(event)?.[1];
      if (name !== 'complete' && name !== 'error') continue;
      const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
      if (name === 'error') return fail('Backend gagal memproses citra.', 502);
      const parsed = JSON.parse(data);
      return NextResponse.json(parsePrediction(Array.isArray(parsed) ? parsed[0] : parsed));
    }
    return fail('Backend tidak mengirim hasil lengkap.', 502);
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === 'TimeoutError';
    return fail(timeout ? 'Backend tidak merespons dalam 90 detik.' : error instanceof Error ? error.message : 'Permintaan backend gagal.', timeout ? 504 : 502);
  }
}
