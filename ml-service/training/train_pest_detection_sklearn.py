"""Train pest detection model using scikit-learn (no TensorFlow required)."""
import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
from PIL import Image
import joblib
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import classification_report, accuracy_score

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "processed" / "pest_detection"
MODELS_DIR = BASE_DIR / "models"

# Training configuration
CONFIG = {
    "image_size": (64, 64),  # Smaller for feature extraction
    "n_estimators": 100,
    "max_depth": 15,
    "test_size": 0.2,
    "random_state": 42
}


def extract_image_features(image_path: Path) -> np.ndarray:
    """Extract features from an image for classification."""
    img = Image.open(image_path)
    
    # Convert to RGB
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Resize
    img = img.resize(CONFIG["image_size"])
    
    # Convert to numpy array
    img_array = np.array(img, dtype=np.float32) / 255.0
    
    # Extract features
    features = []
    
    # Color histogram features (per channel)
    for c in range(3):
        channel = img_array[:, :, c]
        hist, _ = np.histogram(channel, bins=16, range=(0, 1))
        features.extend(hist / hist.sum())  # Normalized histogram
    
    # Statistical features per channel
    for c in range(3):
        channel = img_array[:, :, c]
        features.extend([
            np.mean(channel),
            np.std(channel),
            np.min(channel),
            np.max(channel),
            np.median(channel)
        ])
    
    # Texture features (simple gradient-based)
    gray = np.mean(img_array, axis=2)
    gx = np.gradient(gray, axis=0)
    gy = np.gradient(gray, axis=1)
    features.extend([
        np.mean(np.abs(gx)),
        np.mean(np.abs(gy)),
        np.std(gx),
        np.std(gy)
    ])
    
    # Color ratios
    r, g, b = img_array[:, :, 0], img_array[:, :, 1], img_array[:, :, 2]
    total = r + g + b + 1e-6
    features.extend([
        np.mean(r / total),  # Red ratio
        np.mean(g / total),  # Green ratio
        np.mean(b / total),  # Blue ratio
    ])
    
    return np.array(features)


def load_dataset():
    """Load and prepare the pest detection dataset."""
    logger.info("Loading dataset...")
    
    X = []
    y = []
    class_names = []
    
    # Load from train, val, test directories
    for split in ["train", "val", "test"]:
        split_dir = DATA_DIR / split
        if not split_dir.exists():
            continue
        
        for class_dir in split_dir.iterdir():
            if not class_dir.is_dir():
                continue
            
            class_name = class_dir.name
            if class_name not in class_names:
                class_names.append(class_name)
            
            for img_path in class_dir.glob("*.jpg"):
                try:
                    features = extract_image_features(img_path)
                    X.append(features)
                    y.append(class_name)
                except Exception as e:
                    logger.warning(f"Failed to process {img_path}: {e}")
    
    X = np.array(X)
    y = np.array(y)
    
    logger.info(f"Dataset shape: {X.shape}")
    logger.info(f"Classes: {class_names}")
    logger.info(f"Samples per class: {dict(zip(*np.unique(y, return_counts=True)))}")
    
    return X, y, class_names


def train_model(X, y, class_names):
    """Train the pest detection model."""
    logger.info("Training model...")
    
    # Encode labels
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=CONFIG["test_size"], 
        random_state=CONFIG["random_state"], stratify=y_encoded
    )
    
    logger.info(f"Training samples: {len(X_train)}")
    logger.info(f"Test samples: {len(X_test)}")
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Random Forest
    logger.info("Training Random Forest classifier...")
    model = RandomForestClassifier(
        n_estimators=CONFIG["n_estimators"],
        max_depth=CONFIG["max_depth"],
        random_state=CONFIG["random_state"],
        n_jobs=-1
    )
    
    model.fit(X_train_scaled, y_train)
    
    # Cross-validation
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='accuracy')
    logger.info(f"CV Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
    
    # Evaluate on test set
    y_pred = model.predict(X_test_scaled)
    test_accuracy = accuracy_score(y_test, y_pred)
    
    logger.info(f"\nTest Accuracy: {test_accuracy:.4f}")
    
    # Classification report
    report = classification_report(
        y_test, y_pred, 
        target_names=label_encoder.classes_,
        output_dict=True
    )
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))
    
    return model, scaler, label_encoder, {
        "test_accuracy": test_accuracy,
        "cv_accuracy": cv_scores.mean(),
        "classification_report": report
    }


def save_model_artifacts(model, scaler, label_encoder, class_names, metrics):
    """Save model and associated artifacts."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save complete model as dictionary
    complete_model = {
        'model': model,
        'scaler': scaler,
        'label_encoder': label_encoder,
        'classes': list(label_encoder.classes_),
        'feature_extractor': 'color_histogram_texture'
    }
    
    model_path = MODELS_DIR / "pest_detection_model.pkl"
    joblib.dump(complete_model, model_path)
    logger.info(f"Model saved to: {model_path}")
    
    # Save labels
    labels_data = {
        "class_indices": {name: i for i, name in enumerate(label_encoder.classes_)},
        "index_to_class": {i: name for i, name in enumerate(label_encoder.classes_)},
        "num_classes": len(label_encoder.classes_)
    }
    
    labels_path = MODELS_DIR / "pest_detection_labels.json"
    with open(labels_path, 'w') as f:
        json.dump(labels_data, f, indent=2)
    logger.info(f"Labels saved to: {labels_path}")
    
    # Save metrics
    metrics_data = {
        "test_metrics": {"accuracy": metrics["test_accuracy"]},
        "cv_accuracy": metrics["cv_accuracy"],
        "classification_report": metrics["classification_report"],
        "training_config": CONFIG,
        "trained_at": datetime.now().isoformat(),
        "model_type": "RandomForest_ColorHistogram"
    }
    
    metrics_path = MODELS_DIR / "pest_detection_metrics.json"
    with open(metrics_path, 'w') as f:
        json.dump(metrics_data, f, indent=2)
    logger.info(f"Metrics saved to: {metrics_path}")


def main():
    """Main training function."""
    logger.info("=" * 60)
    logger.info("Pest Detection Model Training (scikit-learn)")
    logger.info("=" * 60)
    
    # Check if data exists
    if not DATA_DIR.exists():
        logger.error(f"Data directory not found: {DATA_DIR}")
        logger.info("Please run download_datasets.py first")
        sys.exit(1)
    
    # Load dataset
    X, y, class_names = load_dataset()
    
    # Train model
    model, scaler, label_encoder, metrics = train_model(X, y, class_names)
    
    # Save artifacts
    save_model_artifacts(model, scaler, label_encoder, class_names, metrics)
    
    logger.info("\n" + "=" * 60)
    logger.info("Training complete!")
    logger.info(f"Model saved to: {MODELS_DIR / 'pest_detection_model.pkl'}")
    logger.info(f"Test Accuracy: {metrics['test_accuracy']:.4f}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
