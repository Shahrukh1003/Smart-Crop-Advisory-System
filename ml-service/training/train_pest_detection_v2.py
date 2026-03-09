"""
Train pest detection model using PlantVillage dataset with MobileNetV2 transfer learning.

Uses tensorflow_datasets to download the PlantVillage dataset (54,303 images, 38 classes)
and trains a production-quality image classifier using transfer learning.

Usage:
    python train_pest_detection_v2.py
"""
import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime
from collections import Counter

import numpy as np
import joblib

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
MODELS_DIR = BASE_DIR / "models"

# Training configuration
CONFIG = {
    "image_size": (128, 128),
    "batch_size": 8,
    "epochs_phase1": 15,
    "epochs_phase2": 10,
    "learning_rate": 0.001,
    "fine_tune_lr": 0.0001,
    "random_state": 42,
    "data_percentage": 1.0, # Use 100% data now that we are using GPU
}


def load_plantvillage():
    """Load PlantVillage dataset via tensorflow_datasets."""
    import tensorflow_datasets as tfds
    import tensorflow as tf

    logger.info("Loading PlantVillage dataset via tensorflow_datasets...")
    logger.info("(This will download ~828 MB on first run)")
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            ds_train, ds_test = tfds.load(
                'plant_village',
                split=['train[:85%]', 'train[85%:]'],
                as_supervised=True,
                with_info=False,
                download=True
            )
            break
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Download attempt {attempt+1} failed: {e}. Retrying in 30s...")
                import time
                time.sleep(30)
            else:
                logger.error("All download attempts failed.")
                raise e

    # Get info for label names
    info = tfds.builder('plant_village').info
    label_names = info.features['label'].names
    num_classes = info.features['label'].num_classes

    logger.info(f"Dataset loaded: {num_classes} classes")
    for i, name in enumerate(label_names):
        logger.info(f"  {i}: {name}")

    return ds_train, ds_test, label_names, num_classes


def preprocess(image, label, image_size):
    """Preprocess a single image-label pair."""
    import tensorflow as tf
    image = tf.image.resize(image, image_size)
    # MobileNetV3 expects pixels in [0, 255] and handles its own scaling internally
    image = tf.cast(image, tf.float32)
    return image, label


def augment(image, label):
    """Apply data augmentation."""
    import tensorflow as tf
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_flip_up_down(image)
    image = tf.image.random_brightness(image, max_delta=0.2)
    image = tf.image.random_contrast(image, lower=0.8, upper=1.2)
    image = tf.image.random_saturation(image, lower=0.8, upper=1.2)
    image = tf.clip_by_value(image, 0.0, 1.0)
    return image, label


def build_model(num_classes):
    """Build MobileNetV3-based classifier."""
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    from tensorflow.keras.applications import MobileNetV3Large

    base = MobileNetV3Large(
        weights="imagenet",
        include_top=False,
        input_shape=(*CONFIG["image_size"], 3),
        include_preprocessing=True,
        minimalistic=False
    )
    base.trainable = False

    inputs = keras.Input(shape=(*CONFIG["image_size"], 3))
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = keras.Model(inputs, outputs)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["learning_rate"]),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    logger.info(f"Model built — {model.count_params():,} params")
    return model, base


def train(ds_train, ds_test, label_names, num_classes):
    """Train the model."""
    import tensorflow as tf
    from tensorflow import keras

    size = CONFIG["image_size"]
    bs = CONFIG["batch_size"]

    # Prepare datasets
    num_train = ds_train.cardinality().numpy()
    if CONFIG["data_percentage"] < 1.0:
        take_train = int(num_train * CONFIG["data_percentage"])
        logger.info(f"Limiting training data to {take_train} examples ({CONFIG['data_percentage']*100}%)")
        ds_train = ds_train.shuffle(2000).take(take_train)

    train_ds = (
        ds_train
        .map(lambda img, lbl: preprocess(img, lbl, size), num_parallel_calls=tf.data.AUTOTUNE)
        .map(augment, num_parallel_calls=tf.data.AUTOTUNE)
        .shuffle(2000)
        .batch(bs)
        .prefetch(tf.data.AUTOTUNE)
    )

    # Split test into val and test
    test_size = ds_test.cardinality().numpy()
    if CONFIG["data_percentage"] < 1.0:
        test_size = int(test_size * CONFIG["data_percentage"])
        ds_test = ds_test.shuffle(1000).take(test_size)
    
    val_size = test_size // 2
    val_ds = (
        ds_test.take(val_size)
        .map(lambda img, lbl: preprocess(img, lbl, size), num_parallel_calls=tf.data.AUTOTUNE)
        .batch(bs)
        .prefetch(tf.data.AUTOTUNE)
    )
    test_ds = (
        ds_test.skip(val_size)
        .map(lambda img, lbl: preprocess(img, lbl, size), num_parallel_calls=tf.data.AUTOTUNE)
        .batch(bs)
        .prefetch(tf.data.AUTOTUNE)
    )

    # Build model
    model, base_model = build_model(num_classes)

    # Phase 1: Train head
    logger.info("=" * 50)
    logger.info("Phase 1: Training classification head")
    logger.info("=" * 50)

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=CONFIG["epochs_phase1"],
        callbacks=[
            keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=5, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7),
        ],
        verbose=1,
    )

    # Phase 2: Fine-tune backbone
    logger.info("=" * 50)
    logger.info("Phase 2: Fine-tuning backbone")
    logger.info("=" * 50)

    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["fine_tune_lr"]),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=CONFIG["epochs_phase2"],
        callbacks=[
            keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=5, restore_best_weights=True),
        ],
        verbose=1,
    )

    # Evaluate
    logger.info("=" * 50)
    logger.info("Evaluating on test set")
    logger.info("=" * 50)

    test_loss, test_acc = model.evaluate(test_ds, verbose=1)
    logger.info(f"Test Accuracy: {test_acc:.4f}")
    logger.info(f"Test Loss:     {test_loss:.4f}")

    # Per-class report
    y_true, y_pred = [], []
    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        y_true.extend(labels.numpy())
        y_pred.extend(np.argmax(preds, axis=1))

    from sklearn.metrics import classification_report
    report = classification_report(y_true, y_pred, target_names=label_names, output_dict=True)
    print("\nClassification Report:")
    print(classification_report(y_true, y_pred, target_names=label_names))

    return model, {
        "test_accuracy": float(test_acc),
        "test_loss": float(test_loss),
        "classification_report": report,
    }


def clean_label_name(name: str) -> str:
    """Convert PlantVillage TFDS label to our app format."""
    # TFDS labels are like "Tomato___Early_blight" -> "tomato_early_blight"
    name = name.replace("_(including_sour)", "")
    name = name.replace(",_bell", "")
    name = name.replace("_(maize)", "")
    parts = name.split("___")
    if len(parts) == 2:
        crop = parts[0].strip().lower().replace(" ", "_")
        disease = parts[1].strip().lower().replace(" ", "_").replace("-", "_")
        return f"{crop}_{disease}"
    return name.lower().replace(" ", "_")


def save_artifacts(model, label_names, metrics):
    """Save model and metadata."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Clean label names
    clean_names = [clean_label_name(n) for n in label_names]

    # Save Keras model
    h5_path = MODELS_DIR / "pest_detection_model.h5"
    model.save(h5_path)
    logger.info(f"Keras model saved: {h5_path}")

    # Save wrapper .pkl for backward compat
    wrapper = {
        "model_type": "keras",
        "model_path": str(h5_path),
        "classes": clean_names,
        "feature_extractor": "mobilenetv3large",
        "image_size": CONFIG["image_size"],
    }
    pkl_path = MODELS_DIR / "pest_detection_model.pkl"
    joblib.dump(wrapper, pkl_path)
    logger.info(f"Wrapper saved: {pkl_path}")

    # Save labels
    labels = {
        "class_indices": {name: int(i) for i, name in enumerate(clean_names)},
        "index_to_class": {int(i): name for i, name in enumerate(clean_names)},
        "num_classes": len(clean_names),
        "original_names": list(label_names),
    }
    with open(MODELS_DIR / "pest_detection_labels.json", "w") as f:
        json.dump(labels, f, indent=2)

    # Save metrics
    metrics_data = {
        "test_metrics": {"accuracy": metrics["test_accuracy"], "loss": metrics["test_loss"]},
        "classification_report": metrics["classification_report"],
        "training_config": CONFIG,
        "trained_at": datetime.now().isoformat(),
        "model_type": "MobileNetV3Large_TransferLearning",
        "dataset": "PlantVillage (tensorflow_datasets)",
        "num_classes": len(clean_names),
    }
    with open(MODELS_DIR / "pest_detection_metrics.json", "w") as f:
        json.dump(metrics_data, f, indent=2)

    logger.info("All artifacts saved!")


def main():
    logger.info("=" * 60)
    logger.info("Pest Detection — PlantVillage + MobileNetV3Large")
    logger.info("=" * 60)

    # Step 1: Load dataset
    logger.info("\n[Step 1/3] Loading PlantVillage dataset...")
    ds_train, ds_test, label_names, num_classes = load_plantvillage()

    # Step 2: Train
    logger.info("\n[Step 2/3] Training model...")
    model, metrics = train(ds_train, ds_test, label_names, num_classes)

    # Step 3: Save
    logger.info("\n[Step 3/3] Saving artifacts...")
    save_artifacts(model, label_names, metrics)

    logger.info("\n" + "=" * 60)
    logger.info("TRAINING COMPLETE!")
    logger.info(f"  Test Accuracy: {metrics['test_accuracy']:.4f}")
    logger.info(f"  Classes:       {num_classes}")
    logger.info(f"  Model:         {MODELS_DIR / 'pest_detection_model.h5'}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
