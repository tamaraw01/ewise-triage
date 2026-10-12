"""Run without model weights: python3 backend/test_image_input.py."""
import io
from PIL import Image
from image_input import decode_image

for shape, accepted in [((32, 32), True), ((1000, 1), False), ((6000, 5000), False)]:
    stream = io.BytesIO()
    Image.new("L", shape).save(stream, "PNG")
    try:
        result = decode_image(stream.getvalue())
    except ValueError:
        assert not accepted, shape
    else:
        assert accepted and result.mode == "RGB" and result.size == shape
print("PASS: RGB decode, aspect-ratio limit, and pixel limit")
