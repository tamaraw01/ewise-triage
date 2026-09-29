# Hugging Face Space Deployment

Untuk mendeploy sebagai Gradio Space di Hugging Face (Tier Gratis, 16GB RAM):

1. Buka https://huggingface.co/spaces dan buat Space baru.
2. Pilih SDK: **Gradio**.
3. Space hardware: **Free (CPU basic - 2 vCPU · 16 GB)**.
4. Clone repo huggingface tersebut ke lokal Anda: `git clone https://huggingface.co/spaces/<username>/<space-name>`
5. Salin isi folder `backend/` dari repo E-WISE ini ke dalam folder repo HF tersebut.
6. Hapus `app.py` lama, lalu *rename* `app_gradio.py` menjadi `app.py`.
7. Hapus `requirements.txt` lama, lalu *rename* `requirements_gradio.txt` menjadi `requirements.txt`.
8. Commit dan Push ke Hugging Face.

**API Calls dari Frontend:**
Gradio membungkus endpoint dalam format khusus. Di frontend Vercel, pemanggilan ke URL Space HF akan terlihat seperti ini:

```javascript
const response = await fetch("https://<username>-<space-name>.hf.space/call/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        data: [
            "data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Base64 dari gambar
        ]
    })
});
const result = await response.json();
const event_id = result.event_id;

// Gradio mengembalikan hasil secara asynchronous, harus di-poll:
const res = await fetch(`https://<username>-<space-name>.hf.space/call/predict/${event_id}`);
const final_data = await res.json(); 
// final_data berisikan array output yang di-JSON-dump dari app_gradio.py
```
*(Atau gunakan package npm resmi `@gradio/client` di frontend Vercel untuk abstraksi yang lebih rapi: `import { client } from "@gradio/client"`)*
