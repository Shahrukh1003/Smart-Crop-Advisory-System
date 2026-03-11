import os
import glob
import numpy as np
import tensorflow as tf
from PIL import Image

# Suppress TF logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
tf.get_logger().setLevel('ERROR')

def test_raw_model():
    model_path = r"C:\Users\shahr\OneDrive\Desktop\Smart crop advisory\ml-service\models\pest_detection_model.keras"
    if not os.path.exists(model_path):
        print("Model file not found!")
        return
        
    print("Loading raw Keras model...")
    model = tf.keras.models.load_model(model_path, compile=False)
    
    # Load labels to interpret output
    import json
    labels_path = r"C:\Users\shahr\OneDrive\Desktop\Smart crop advisory\ml-service\models\pest_detection_labels.json"
    with open(labels_path, "r") as f:
        labels_data = json.load(f)
    index_to_class = {int(k): v for k, v in labels_data["index_to_class"].items()}
    
    # Load test images
    images = glob.glob(r"C:\Users\shahr\.gemini\antigravity\brain\dd79f8a3-bbc6-4480-a861-8fbb2f30c5c3\*_sample_png_*.png")
    
    for img_path in images:
        print(f"\n--- Testing: {os.path.basename(img_path)} ---")
        img = Image.open(img_path).convert('RGB')
        img = img.resize((128, 128), Image.Resampling.LANCZOS)
        
        # Test 1: [0, 255] Raw
        arr_255 = np.expand_dims(np.array(img, dtype=np.float32), axis=0)
        preds_255 = model(arr_255, training=False).numpy()[0]
        idx1 = np.argmax(preds_255)
        print(f"[0, 255] raw     -> {index_to_class[idx1]} ({preds_255[idx1]:.4f})")
        
        # Test 2: [0, 1] Normalized
        arr_1 = np.expand_dims(np.array(img, dtype=np.float32) / 255.0, axis=0)
        preds_1 = model(arr_1, training=False).numpy()[0]
        idx2 = np.argmax(preds_1)
        print(f"[0, 1] norm      -> {index_to_class[idx2]} ({preds_1[idx2]:.4f})")
        
        # Test 3: [-1, 1] MobileNetV2 style
        arr_neg1 = tf.keras.applications.mobilenet_v2.preprocess_input(np.array(img, dtype=np.float32))
        arr_neg1 = np.expand_dims(arr_neg1, axis=0)
        preds_neg1 = model(arr_neg1, training=False).numpy()[0]
        idx3 = np.argmax(preds_neg1)
        print(f"[-1, 1] mobv2    -> {index_to_class[idx3]} ({preds_neg1[idx3]:.4f})")

if __name__ == "__main__":
    test_raw_model()
