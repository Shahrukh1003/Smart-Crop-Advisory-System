"""Quick inference test for pest detection API."""
import requests
import io
import numpy as np
from PIL import Image, ImageDraw

# Create a synthetic green leaf image with brown blight spots
np.random.seed(1)
img = Image.new('RGB', (128, 128), color=(34, 139, 34))
draw = ImageDraw.Draw(img)
for _ in range(8):
    x, y = np.random.randint(10, 110), np.random.randint(10, 110)
    draw.ellipse([x-8, y-8, x+8, y+8], fill=(101, 67, 33))

buf = io.BytesIO()
img.save(buf, 'JPEG')
buf.seek(0)

resp = requests.post(
    "http://localhost:8000/api/v1/pest-detection/analyze",
    files={"image": ("test_leaf.jpg", buf, "image/jpeg")}
)
print("Status:", resp.status_code)
import json
print(json.dumps(resp.json(), indent=2))
