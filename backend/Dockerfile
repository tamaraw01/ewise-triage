FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV HF_HOME=/app/.cache \
    TORCH_HOME=/app/.cache \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.5.1 torchvision==0.20.1 \
      --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements.txt

COPY artifacts ./artifacts
COPY engine.py app.py ./

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
