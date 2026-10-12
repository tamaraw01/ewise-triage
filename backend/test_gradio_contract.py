"""Adapter contract check without model weights or Gradio runtime."""
import ast
import io
import json
import sys
import types
from pathlib import Path
from PIL import Image

source = Path(__file__).with_name("app_gradio.py")
tree = ast.parse(source.read_text())
functions = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef)], type_ignores=[])
payload = {"status": "classified", "cluster": {"id": 4}, "margin": 0.12}
seen = []
def classify(data):
    with Image.open(io.BytesIO(data)) as image:
        assert image.mode == "RGB"
    seen.append(data)
    return payload
engine = types.SimpleNamespace(classify=classify)
namespace = {"Image": Image, "io": io, "json": json, "__file__": str(source),
             "gr": types.SimpleNamespace(Error=RuntimeError),
             "engine_onnx": types.SimpleNamespace(tersedia=lambda: True, classify=classify)}
exec(compile(functions, str(source), "exec"), namespace)
assert namespace["predict_image"](Image.new("RGB", (8, 8))) == payload
namespace["engine_onnx"].tersedia = lambda: False
old = sys.modules.get("engine")
sys.modules["engine"] = engine
try:
    assert namespace["predict_image"](Image.new("RGBA", (8, 8))) == payload
finally:
    if old is None:
        del sys.modules["engine"]
    else:
        sys.modules["engine"] = old
assert len(seen) == 2
assert namespace["get_clusters"]() == json.loads(source.with_name("artifacts").joinpath("clusters.json").read_text())
print("PASS: Gradio adapters call byte-based classify; return direct prediction; metadata loads")
