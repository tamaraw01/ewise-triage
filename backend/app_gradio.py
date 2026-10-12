import gradio as gr
from PIL import Image
import engine_onnx
import json
import io

def predict_image(image):
    if image is None:
        return json.dumps({"error": "No image provided"})
    
    # Gradio sends numpy array or PIL image depending on input type.
    # Force to PIL for the engine
    if not isinstance(image, Image.Image):
        # image is likely a numpy array from Gradio image component
        image = Image.fromarray(image)
        
    try:
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG")
        if engine_onnx.tersedia():
            res = engine_onnx.classify(buffer.getvalue())
        else:
            import engine
            res = engine.classify(buffer.getvalue())
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
        img_input = gr.Image(type="pil", label="Upload E-Waste Image")
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
