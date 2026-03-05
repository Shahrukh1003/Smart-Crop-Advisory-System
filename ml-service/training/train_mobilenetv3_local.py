"""Train MobileNetV3Large on local pest dataset, bypassing tensorflow_datasets."""
import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV3Large
import joblib

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "processed" / "pest_detection"
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Config
CONFIG = {
    "image_size": (128, 128),
    "batch_size": 16,     # Reduced for 4GB VRAM
    "epochs_phase1": 5,
    "epochs_phase2": 5,
    "learning_rate1": 1e-3,
    "learning_rate2": 1e-5,
}

def load_datasets():
    """Load train and validation datasets from local directory."""
    logger.info(f"Loading datasets from {DATA_DIR}")
    
    train_dir = DATA_DIR / "train"
    val_dir = DATA_DIR / "val"
    test_dir = DATA_DIR / "test"
    
    if not train_dir.exists():
        logger.error(f"Training directory not found: {train_dir}")
        sys.exit(1)
        
    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        seed=42,
        image_size=CONFIG["image_size"],
        batch_size=CONFIG["batch_size"],
        label_mode='categorical'
    )
    
    val_ds = tf.keras.utils.image_dataset_from_directory(
        val_dir,
        seed=42,
        image_size=CONFIG["image_size"],
        batch_size=CONFIG["batch_size"],
        label_mode='categorical'
    )
    
    test_ds = tf.keras.utils.image_dataset_from_directory(
        test_dir,
        seed=42,
        image_size=CONFIG["image_size"],
        batch_size=CONFIG["batch_size"],
        label_mode='categorical'
    )
    
    class_names = train_ds.class_names
    logger.info(f"Loaded {len(class_names)} classes: {class_names}")
    
    # Optimize for performance
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)
    test_ds = test_ds.cache().prefetch(buffer_size=AUTOTUNE)
    
    return train_ds, val_ds, test_ds, class_names

def build_model(num_classes):
    """Build MobileNetV3Large model."""
    logger.info("Building MobileNetV3Large model...")
    base = MobileNetV3Large(
        weights="imagenet",
        include_top=False,
        input_shape=(*CONFIG["image_size"], 3),
        include_preprocessing=True,
        minimalistic=False
    )
    base.trainable = False
    
    inputs = keras.Input(shape=(*CONFIG["image_size"], 3))
    
    # Data augmentation
    data_augmentation = keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.2),
        layers.RandomZoom(0.2),
    ], name="data_augmentation")
    
    x = data_augmentation(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    
    model = keras.Model(inputs, outputs)
    return model, base

def main():
    logger.info("=" * 60)
    logger.info("Training MobileNetV3Large (Local Data)")
    logger.info("=" * 60)
    
    # 1. Load data
    train_ds, val_ds, test_ds, class_names = load_datasets()
    num_classes = len(class_names)
    
    # 2. Build model
    model, base_model = build_model(num_classes)
    
    # Phase 1: Train top layers
    logger.info("--- Phase 1: Training top layers ---")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["learning_rate1"]),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    
    early_stopping = keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=3, restore_best_weights=True
    )
    
    history1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=CONFIG["epochs_phase1"],
        callbacks=[early_stopping]
    )
    
    # Phase 2: Fine-tuning
    logger.info("--- Phase 2: Fine-tuning ---")
    base_model.trainable = True
    
    # Keep early layers frozen
    for layer in base_model.layers[:100]:
        layer.trainable = False
        
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["learning_rate2"]),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    
    history2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=CONFIG["epochs_phase2"],
        callbacks=[early_stopping]
    )
    
    # 3. Evaluate on test set
    logger.info("Evaluating on test set...")
    loss, accuracy = model.evaluate(test_ds)
    logger.info(f"Test accuracy: {accuracy:.4f}")
    
    # 4. Save artifacts
    logger.info("Saving model and artifacts...")
    h5_path = MODELS_DIR / "pest_detection_model.h5"
    model.save(str(h5_path))
    
    # Wrapper (.pkl)
    wrapper = {
        "model_type": "keras",
        "model_path": str(h5_path),
        "classes": class_names,
        "feature_extractor": "mobilenetv3large",
        "image_size": CONFIG["image_size"],
    }
    joblib.dump(wrapper, MODELS_DIR / "pest_detection_model.pkl")
    
    # Labels
    labels_data = {
        "class_indices": {name: i for i, name in enumerate(class_names)},
        "index_to_class": {i: name for i, name in enumerate(class_names)},
        "num_classes": num_classes
    }
    with open(MODELS_DIR / "pest_detection_labels.json", "w") as f:
        json.dump(labels_data, f, indent=2)
        
    # Metrics
    metrics_data = {
        "test_metrics": {"accuracy": float(accuracy), "loss": float(loss)},
        "training_config": CONFIG,
        "trained_at": datetime.now().isoformat(),
        "model_type": "MobileNetV3Large_TransferLearning",
        "dataset": "Local Synthesis Dataset",
        "num_classes": num_classes,
    }
    with open(MODELS_DIR / "pest_detection_metrics.json", "w") as f:
        json.dump(metrics_data, f, indent=2)
        
    logger.info("=" * 60)
    logger.info("Training Complete!")
    logger.info("=" * 60)

if __name__ == "__main__":
    main()
