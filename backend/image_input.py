"""Bound image decoding before allocating RGB pixels or resized tensors."""
import io
import warnings
from PIL import Image


def decode_image(data: bytes) -> Image.Image:
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as image:
            w, h = image.size
            # ponytail: 24 MP and 20:1 cover item photos; change only with memory tests.
            if min(w, h) < 1 or w * h > 24_000_000 or max(w, h) > 20 * min(w, h):
                raise ValueError("Dimensi citra terlalu besar atau terlalu memanjang.")
            return image.convert("RGB")
