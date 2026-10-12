"""Real Gradio runtime contract test with a FAKE engine (no model inference).

Needs gradio installed: <venv>/bin/python backend/test_gradio_runtime.py
Boots app_gradio.py in a subprocess; engine_onnx is a stub that only runs the
real image_input.decode_image. PIL load/convert are instrumented to log any
pixel allocation above the 24 MP guard.
"""
import base64, io, json, os, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from PIL import Image

BACKEND = Path(__file__).resolve().parent
work = Path(tempfile.mkdtemp())
log = work / "events.log"
(work / "engine_onnx.py").write_text("""
import os
from image_input import decode_image
def tersedia(): return True
def classify(data):
    open(os.environ["EWISE_LOG"], "a").write("ENGINE\\n")
    img = decode_image(data)
    return {"status": "classified", "cluster": {"id": 4}, "margin": 0.12}
""")
(work / "boot.py").write_text("""
import os, runpy, gradio, PIL.Image, PIL.ImageFile
original_open = PIL.Image.open
def image_open(*a, **k):
    open(os.environ["EWISE_LOG"], "a").write("OPEN\\n")
    return original_open(*a, **k)
PIL.Image.open = image_open
def spy(name, orig):
    def wrapped(self, *a, **k):
        if self.size[0] * self.size[1] > 24_000_000:
            open(os.environ["EWISE_LOG"], "a").write("BIG_%s\\n" % name)
            raise AssertionError("Oversized image reached pixel decode")
        return orig(self, *a, **k)
    return wrapped
PIL.ImageFile.ImageFile.load = spy("LOAD", PIL.ImageFile.ImageFile.load)
PIL.Image.Image.convert = spy("CONVERT", PIL.Image.Image.convert)
launch = gradio.Blocks.launch
gradio.Blocks.launch = lambda self, **k: launch(self, **{**k, "server_name": "127.0.0.1", "server_port": int(os.environ["PORT"])})
runpy.run_path(os.environ["APP"], run_name="__main__")
""")

with socket.socket() as s:
    s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
base = f"http://127.0.0.1:{port}/gradio_api"
env = {**os.environ, "PORT": str(port), "APP": str(BACKEND / "app_gradio.py"), "EWISE_LOG": str(log),
       "PYTHONPATH": os.pathsep.join([str(work), str(BACKEND)]), "GRADIO_ANALYTICS_ENABLED": "False"}
proc = subprocess.Popen([sys.executable, str(work / "boot.py")], cwd=work, env=env,
                        stdout=subprocess.DEVNULL, stderr=open(work / "server.err", "wb"))


def post(path, body, ctype="application/json"):
    req = urllib.request.Request(base + path, data=body, headers={"Content-Type": ctype})
    return urllib.request.urlopen(req, timeout=60).read()


def predict(file_data):
    event = json.loads(post("/call/predict", json.dumps({"data": [file_data]}).encode()))["event_id"]
    text = urllib.request.urlopen(f"{base}/call/predict/{event}", timeout=60).read().decode()
    name = text.split("event: ")[-1].split("\n")[0]
    return name, text


def png(size, mode="L"):
    buf = io.BytesIO(); Image.new(mode, size).save(buf, "PNG"); return buf.getvalue()


def data_url(raw, kind="png"):
    return {"url": f"data:image/{kind};base64," + base64.b64encode(raw).decode(), "meta": {"_type": "gradio.FileData"}}


def check(label, file_data, ok):
    log.write_text("")
    name, text = predict(file_data)
    events = log.read_text().split()
    assert (name == "complete") == ok, (label, name, text[:300])
    if ok:
        result = json.loads(text.split("data: ")[-1].strip())[0]
        assert result == {"status": "classified", "cluster": {"id": 4}, "margin": 0.12}, result
    assert not [e for e in events if e.startswith("BIG_")], (label, events)
    assert ok == any(e == "ENGINE" for e in events), (label, events)
    if "byte cap" in label:
        assert "OPEN" not in events, (label, events)
    print("PASS", label)


try:
    for _ in range(120):
        try: urllib.request.urlopen(f"http://127.0.0.1:{port}/config", timeout=1); break
        except Exception: time.sleep(0.5)
    else:
        raise SystemExit("server did not start:\n" + (work / "server.err").read_text()[-2000:])
    config = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/config", timeout=5).read())
    assert "image" in [c["type"] for c in config["components"]], "UI must still render gr.Image"
    info = json.loads(urllib.request.urlopen(base + "/info", timeout=5).read())
    param = info["named_endpoints"]["/predict"]["parameters"][0]
    assert param["component"] == "Image" and "FileData" in json.dumps(param["type"]), param
    bomb = png((6000, 5000))
    assert len(bomb) < 200_000, len(bomb)  # small encoded file, 30 MP decoded
    check("normal PNG via data URL", data_url(png((32, 32), "RGB")), True)
    check("RGBA PNG via data URL", data_url(png((16, 16), "RGBA")), True)
    for kind in ("jpeg", "webp"):
        buf = io.BytesIO(); Image.new("RGB", (32, 32)).save(buf, kind)
        check(f"normal {kind} via data URL", data_url(buf.getvalue(), kind), True)
    check("invalid base64", {"url": "data:image/png;base64,!!!!", "meta": {"_type": "gradio.FileData"}}, False)
    check("aspect ratio limit", data_url(png((1000, 1))), False)
    check("6000x5000 compressed PNG via data URL", data_url(bomb), False)
    check("malformed bytes via data URL", data_url(b"\x89PNG\r\n\x1a\nnot-an-image"), False)
    check("over byte cap via data URL", data_url(b"\xff\xd8\xff" + bytes(12 * 1024 * 1024), "jpeg"), False)
    normal = png((32, 32))
    check("exact byte limit via data URL", data_url(normal + bytes(12 * 1024 * 1024 - len(normal))), True)
    boundary = "ewiseboundary"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"big.png\"\r\n"
            "Content-Type: image/png\r\n\r\n").encode() + bomb + f"\r\n--{boundary}--\r\n".encode()
    path = json.loads(post("/upload", body, f"multipart/form-data; boundary={boundary}"))[0]
    check("6000x5000 compressed PNG via upload path",
          {"path": path, "orig_name": "big.png", "meta": {"_type": "gradio.FileData"}}, False)
    path = json.loads(post("/upload", body.replace(bomb, png((32, 32))), f"multipart/form-data; boundary={boundary}"))[0]
    check("normal PNG via upload path", {"path": path, "orig_name": "big.png", "meta": {"_type": "gradio.FileData"}}, True)
    # Adapter guards uploaded encoded files independently of transport upload limits.
    huge = b"x" * (12 * 1024 * 1024 + 1)
    huge_body = body.replace(bomb, huge)
    path = json.loads(post("/upload", huge_body, f"multipart/form-data; boundary={boundary}"))[0]
    check("over byte cap via upload path", {"path": path, "orig_name": "big.png", "meta": {"_type": "gradio.FileData"}}, False)
    print("PASS: real Gradio runtime (fake engine) rejects before engine / oversized decode")
finally:
    proc.terminate(); proc.wait(10)
