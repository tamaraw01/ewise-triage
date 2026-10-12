import base64
import gradio as gr
import engine_onnx
import json
from image_input import checked_image

MAX_BYTES = 12 * 1024 * 1024  # same cap as app.py


def encoded_bytes(payload):
    """Replaces gr.Image.preprocess, which decodes full pixels (PIL load +
    exif_transpose) before app code runs. Check headers here before engine
    entry; engine.classify -> decode_image checks again before RGB decode."""
    if payload is None:
        return None
    if payload.url and payload.url.startswith("data:"):
        encoded = payload.url.partition(",")[2]
        if len(encoded) > (MAX_BYTES + 2) // 3 * 4:
            raise gr.Error("Berkas melebihi 12 MB.")
        data = base64.b64decode(encoded, validate=True)
    else:
        with open(payload.path, "rb") as file:
            data = file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise gr.Error("Berkas melebihi 12 MB.")
    with checked_image(data):
        pass  # header-only validation before engine entry
    return data


def predict_image(image):
    if image is None:
        return json.dumps({"error": "No image provided"})
    try:
        if engine_onnx.tersedia():
            res = engine_onnx.classify(image)
        else:
            import engine
            res = engine.classify(image)
        return res
    except Exception:
        import logging
        logging.getLogger("ewise").exception("Inferensi gagal")
        raise gr.Error("Gagal memproses citra") from None


def get_health():
    return json.dumps({"status": "ok", "engine": "onnx-int8" if engine_onnx.tersedia() else "torch-fp32"})

def get_clusters():
    try:
        from pathlib import Path
        return json.loads((Path(__file__).parent / "artifacts" / "clusters.json").read_text())
    except Exception:
        # Fallback if engine is completely missing in ONNX only mode
        return json.dumps({"error": "Clusters metadata unavailable in strict ONNX mode"})

with gr.Blocks(title="E-WISE API") as demo:
    gr.Markdown("# E-WISE Headless API\nThis Space is designed to act as an API backend. Use the Gradio API endpoints to communicate with it.")
    
    with gr.Tab("Predict"):
        img_input = gr.Image(label="Upload E-Waste Image")
        img_input.preprocess = encoded_bytes  # API schema unchanged; bytes in
        txt_output = gr.JSON(label="Prediction Result")
        btn = gr.Button("Predict")
        btn.click(fn=predict_image, inputs=img_input, outputs=txt_output, api_name="predict")
        
    with gr.Tab("Health"):
        health_out = gr.JSON()
        btn_health = gr.Button("Check Health")
        btn_health.click(fn=get_health, inputs=[], outputs=health_out, api_name="health")
        
    with gr.Tab("Clusters"):
        cluster_out = gr.JSON()
        btn_clusters = gr.Button("Get Clusters")
        btn_clusters.click(fn=get_clusters, inputs=[], outputs=cluster_out, api_name="clusters")

demo.launch(server_name="0.0.0.0", server_port=7860)
