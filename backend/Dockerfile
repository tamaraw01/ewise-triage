FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install torch CPU terlebih dahulu (lebih kecil, cukup untuk inference)
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py engine.py engine_onnx.py image_input.py prep_text_emb.py ./
COPY artifacts/ ./artifacts/

# HF Space menjalankan di port 7860
EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
