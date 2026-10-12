"""Invalid-upload contract check against running Next server."""
import json
import sys
import urllib.error
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
for body in [b"bad", json.dumps({"data": [{"url": "https://example.org/image.jpg"}]}).encode(),
             json.dumps({"data": [{"url": "data:image/png;base64,YmFk"}]}).encode()]:
    request = urllib.request.Request(base + "/api/predict", data=body,
                                     headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(request, timeout=60)
    except urllib.error.HTTPError as error:
        assert error.code == 400, error.code
        response = json.load(error)
        assert isinstance(response.get("error"), str)
    else:
        raise AssertionError("Invalid upload accepted")
print("PASS: malformed JSON, remote URL, and invalid image signature rejected")
