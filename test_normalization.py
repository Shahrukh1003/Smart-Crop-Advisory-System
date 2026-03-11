import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'ml-service'))

import numpy as np
import tensorflow as tf
from PIL import Image
from model_loader import get_model_loader

# Suppress TF logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
tf.get_logger().setLevel('ERROR')

def test_inference():
    print("Loading model...")
    loader = get_model_loader()
    model_info = loader.get_model_info("pest_detection")
    
    if not model_info or not model_info.model:
        print("Failed to load model.")
        return
        
    model = model_info.model
    labels = loader.get_pest_labels()
    
    images = [
        r"C:\Users\shahr\.gemini\antigravity\brain\dd79f8a3-bbc6-4480-a861-8fbb2f30c5c3\apple_scab_sample_png_1773208860006.png",
        r"C:\Users\shahr\.gemini\antigravity\brain\dd79f8a3-bbc6-4480-a861-8fbb2f30c5c3\corn_rust_sample_png_1773208878175.png",
        r"C:\Users\shahr\.gemini\antigravity\brain\dd79f8a3-bbc6-4480-a861-8fbb2f30c5c3\potato_late_blight_sample_png_1773208901418.png",
        r"C:\Users\shahr\.gemini\antigravity\brain\dd79f8a3-bbc6-4480-a861-8fbb2f30c5c3\tomato_leaf_curl_sample_png_1773208920097.png",
    ]
    
    for img_path in images:
        if not os.path.exists(img_path):
            print(f"Skipping missing: {img_path}")
            continue
            
        print(f"\n--- Testing: {os.path.basename(img_path)} ---")
        img = Image.open(img_path).convert('RGB')
        img = img.resize((224, 224), Image.Resampling.LANCZOS)
        
        # Test 1: Normalize to [0, 1]
        img_arr1 = np.array(img, dtype=np.float32) / 255.0
        img_arr1 = np.expand_dims(img_arr1, axis=0)
        
        preds1 = model(img_arr1, training=False).numpy()[0]
        top_idx1 = np.argmax(preds1)
        conf1 = preds1[top_idx1]
        print(f"[0,1] normalization -> {labels.get(top_idx1, top_idx1)} ({conf1:.4f})")
        
        # Test 2: Standard MobileNetV2 preprocessing [-1, 1]
        img_arr2 = np.array(img, dtype=np.float32)
        img_arr2 = tf.keras.applications.mobilenet_v2.preprocess_input(img_arr2)
        img_arr2 = np.expand_dims(img_arr2, axis=0)
        
        preds2 = model(img_arr2, training=False).numpy()[0]
        top_idx2 = np.argmax(preds2)
        conf2 = preds2[top_idx2]
        print(f"MobileNet preprocess -> {labels.get(top_idx2, top_idx2)} ({conf2:.4f})")

if __name__ == "__main__":
    test_inference()
