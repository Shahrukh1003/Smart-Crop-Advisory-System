"""Train pest detection model using MobileNetV2 transfer learning."""
import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, TensorBoard

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "processed" / "pest_detection"
MODELS_DIR = BASE_DIR / "models"

# Training configuration
CONFIG = {
    "image_size": (224, 224),
    "batch_size": 32,
    "epochs": 50,
    "learning_rate": 0.001,
    "fine_tune_learning_rate": 0.0001,
    "fine_tune_epochs": 20,
    "validation_split": 0.2,
    "early_stopping_patience": 10,
    "reduce_lr_patience": 5
}


def create_data_generators():
    """Create training and validation data generators with augmentation."""
    logger.info("Creating data generators...")
    
    # Training data augmentation
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        vertical_flip=True,
        fill_mode='nearest'
    )
    
    # Validation data - only rescaling
    val_datagen = ImageDataGenerator(rescale=1./255)
    
    # Test data - only rescaling
    test_datagen = ImageDataGenerator(rescale=1./255)
    
    train_generator = train_datagen.flow_from_directory(
        DATA_DIR / "train",
        target_size=CONFIG["image_size"],
        batch_size=CONFIG["batch_size"],
        class_mode='categorical',
        shuffle=True
    )
    
    val_generator = val_datagen.flow_from_directory(
        DATA_DIR / "val",
        target_size=CONFIG["image_size"],
        batch_size=CONFIG["batch_size"],
        class_mode='categorical',
        shuffle=False
    )
    
    test_generator = test_datagen.flow_from_directory(
        DATA_DIR / "test",
        target_size=CONFIG["image_size"],
        batch_size=CONFIG["batch_size"],
        class_mode='categorical',
        shuffle=False
    )
    
    logger.info(f"Training samples: {train_generator.samples}")
    logger.info(f"Validation samples: {val_generator.samples}")
    logger.info(f"Test samples: {test_generator.samples}")
    logger.info(f"Classes: {train_generator.class_indices}")
    
    return train_generator, val_generator, test_generator


def create_model(num_classes: int) -> Model:
    """Create MobileNetV2-based pest detection model."""
    logger.info(f"Creating MobileNetV2 model for {num_classes} classes...")
    
    # Load pre-trained MobileNetV2
    base_model = MobileNetV2(
        weights='imagenet',
        include_top=False,
        input_shape=(*CONFIG["image_size"], 3)
    )
    
    # Freeze base model layers initially
    base_model.trainable = False
    
    # Build classification head
    inputs = keras.Input(shape=(*CONFIG["image_size"], 3))
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)
    
    model = Model(inputs, outputs)
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["learning_rate"]),
        loss='categorical_crossentropy',
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_accuracy')]
    )
    
    logger.info(f"Model created with {model.count_params():,} parameters")
    return model, base_model


def get_callbacks(model_path: Path):
    """Create training callbacks."""
    callbacks = [
        ModelCheckpoint(
            str(model_path),
            monitor='val_accuracy',
            save_best_only=True,
            mode='max',
            verbose=1
        ),
        EarlyStopping(
            monitor='val_accuracy',
            patience=CONFIG["early_stopping_patience"],
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=CONFIG["reduce_lr_patience"],
            min_lr=1e-7,
            verbose=1
        ),
        TensorBoard(
            log_dir=str(BASE_DIR / "logs" / f"pest_detection_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            histogram_freq=1
        )
    ]
    return callbacks


def fine_tune_model(model: Model, base_model: Model, train_gen, val_gen, model_path: Path):
    """Fine-tune the model by unfreezing some base layers."""
    logger.info("Starting fine-tuning phase...")
    
    # Unfreeze the last 30 layers of base model
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False
    
    # Recompile with lower learning rate
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["fine_tune_learning_rate"]),
        loss='categorical_crossentropy',
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_accuracy')]
    )
    
    logger.info(f"Fine-tuning with {sum(1 for l in model.layers if l.trainable)} trainable layers")
    
    # Continue training
    history = model.fit(
        train_gen,
        epochs=CONFIG["fine_tune_epochs"],
        validation_data=val_gen,
        callbacks=get_callbacks(model_path),
        verbose=1
    )
    
    return history


def evaluate_model(model: Model, test_gen):
    """Evaluate model on test set."""
    logger.info("Evaluating model on test set...")
    
    results = model.evaluate(test_gen, verbose=1)
    metrics = dict(zip(model.metrics_names, results))
    
    logger.info("Test Results:")
    for name, value in metrics.items():
        logger.info(f"  {name}: {value:.4f}")
    
    # Get predictions for confusion matrix
    predictions = model.predict(test_gen, verbose=1)
    y_pred = np.argmax(predictions, axis=1)
    y_true = test_gen.classes
    
    # Calculate per-class accuracy
    class_indices = test_gen.class_indices
    class_names = {v: k for k, v in class_indices.items()}
    
    from sklearn.metrics import classification_report, confusion_matrix
    
    report = classification_report(y_true, y_pred, target_names=list(class_indices.keys()), output_dict=True)
    
    logger.info("\nPer-class Performance:")
    for class_name, metrics_dict in report.items():
        if isinstance(metrics_dict, dict):
            logger.info(f"  {class_name}: precision={metrics_dict.get('precision', 0):.3f}, "
                       f"recall={metrics_dict.get('recall', 0):.3f}, f1={metrics_dict.get('f1-score', 0):.3f}")
    
    return metrics, report


def save_model_artifacts(model: Model, class_indices: dict, metrics: dict, report: dict):
    """Save model and associated artifacts."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save Keras model
    model_path = MODELS_DIR / "pest_detection_model.h5"
    model.save(model_path)
    logger.info(f"Model saved to: {model_path}")
    
    # Save TensorFlow Lite model for mobile
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    
    tflite_path = MODELS_DIR / "pest_detection_model.tflite"
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
    logger.info(f"TFLite model saved to: {tflite_path}")
    
    # Save class labels
    labels_path = MODELS_DIR / "pest_detection_labels.json"
    with open(labels_path, 'w') as f:
        json.dump({
            "class_indices": class_indices,
            "index_to_class": {v: k for k, v in class_indices.items()},
            "num_classes": len(class_indices)
        }, f, indent=2)
    logger.info(f"Labels saved to: {labels_path}")
    
    # Save training metrics
    metrics_path = MODELS_DIR / "pest_detection_metrics.json"
    with open(metrics_path, 'w') as f:
        json.dump({
            "test_metrics": metrics,
            "classification_report": report,
            "training_config": CONFIG,
            "trained_at": datetime.now().isoformat()
        }, f, indent=2)
    logger.info(f"Metrics saved to: {metrics_path}")


def main():
    """Main training function."""
    logger.info("=" * 60)
    logger.info("Pest Detection Model Training")
    logger.info("=" * 60)
    
    # Check if data exists
    if not DATA_DIR.exists():
        logger.error(f"Data directory not found: {DATA_DIR}")
        logger.info("Please run download_datasets.py first")
        sys.exit(1)
    
    # Create data generators
    train_gen, val_gen, test_gen = create_data_generators()
    num_classes = len(train_gen.class_indices)
    
    # Create model
    model, base_model = create_model(num_classes)
    model.summary()
    
    # Initial training (frozen base)
    logger.info("\n" + "=" * 40)
    logger.info("Phase 1: Training classification head")
    logger.info("=" * 40)
    
    model_path = MODELS_DIR / "pest_detection_model.h5"
    
    history = model.fit(
        train_gen,
        epochs=CONFIG["epochs"],
        validation_data=val_gen,
        callbacks=get_callbacks(model_path),
        verbose=1
    )
    
    # Fine-tuning
    logger.info("\n" + "=" * 40)
    logger.info("Phase 2: Fine-tuning")
    logger.info("=" * 40)
    
    fine_tune_history = fine_tune_model(model, base_model, train_gen, val_gen, model_path)
    
    # Load best model
    model = keras.models.load_model(str(model_path))
    
    # Evaluate
    logger.info("\n" + "=" * 40)
    logger.info("Evaluation")
    logger.info("=" * 40)
    
    metrics, report = evaluate_model(model, test_gen)
    
    # Save artifacts
    save_model_artifacts(model, train_gen.class_indices, metrics, report)
    
    logger.info("\n" + "=" * 60)
    logger.info("Training complete!")
    logger.info(f"Model saved to: {MODELS_DIR / 'pest_detection_model.h5'}")
    logger.info(f"Test Accuracy: {metrics.get('accuracy', 0):.4f}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
