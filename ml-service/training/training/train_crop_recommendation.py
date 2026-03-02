"""Train crop recommendation ensemble model (Random Forest + Gradient Boosting)."""
import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.pipeline import Pipeline

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "processed" / "crop_recommendation"
MODELS_DIR = BASE_DIR / "models"

# Training configuration
CONFIG = {
    "random_forest": {
        "n_estimators": 100,
        "max_depth": 15,
        "min_samples_split": 5,
        "min_samples_leaf": 2,
        "random_state": 42,
        "n_jobs": -1
    },
    "gradient_boosting": {
        "n_estimators": 100,
        "max_depth": 8,
        "learning_rate": 0.1,
        "min_samples_split": 5,
        "min_samples_leaf": 2,
        "random_state": 42
    },
    "cv_folds": 5,
    "test_size": 0.2
}


def load_data():
    """Load and prepare the crop recommendation dataset."""
    logger.info("Loading dataset...")
    
    # Try to load from processed directory
    train_path = DATA_DIR / "train.csv"
    
    if train_path.exists():
        train_df = pd.read_csv(train_path)
        val_df = pd.read_csv(DATA_DIR / "val.csv")
        test_df = pd.read_csv(DATA_DIR / "test.csv")
        df = pd.concat([train_df, val_df, test_df], ignore_index=True)
    else:
        # Load from single file
        df = pd.read_csv(DATA_DIR / "crop_data.csv")
    
    logger.info(f"Dataset shape: {df.shape}")
    logger.info(f"Columns: {df.columns.tolist()}")
    logger.info(f"Crops: {df['label'].unique().tolist()}")
    
    return df


def prepare_features(df: pd.DataFrame):
    """Prepare features and labels for training."""
    logger.info("Preparing features...")
    
    # Feature columns
    feature_cols = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
    
    # Check if all columns exist
    missing_cols = [col for col in feature_cols if col not in df.columns]
    if missing_cols:
        logger.warning(f"Missing columns: {missing_cols}")
        # Try alternative column names
        alt_names = {'N': 'nitrogen', 'P': 'phosphorus', 'K': 'potassium'}
        for col in missing_cols:
            if alt_names.get(col) in df.columns:
                df[col] = df[alt_names[col]]
    
    X = df[feature_cols].values
    y = df['label'].values
    
    # Encode labels
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    logger.info(f"Features shape: {X.shape}")
    logger.info(f"Labels shape: {y_encoded.shape}")
    logger.info(f"Number of classes: {len(label_encoder.classes_)}")
    
    return X, y_encoded, label_encoder, feature_cols


def create_ensemble_model():
    """Create the ensemble model with Random Forest and Gradient Boosting."""
    logger.info("Creating ensemble model...")
    
    # Random Forest
    rf_model = RandomForestClassifier(**CONFIG["random_forest"])
    
    # Gradient Boosting
    gb_model = GradientBoostingClassifier(**CONFIG["gradient_boosting"])
    
    # Voting Classifier (soft voting for probability outputs)
    ensemble = VotingClassifier(
        estimators=[
            ('random_forest', rf_model),
            ('gradient_boosting', gb_model)
        ],
        voting='soft',
        weights=[0.6, 0.4]  # Slightly favor Random Forest
    )
    
    return ensemble, rf_model, gb_model


def train_and_evaluate(X, y, label_encoder, feature_cols):
    """Train the model and evaluate performance."""
    logger.info("Splitting data...")
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=CONFIG["test_size"], random_state=42, stratify=y
    )
    
    logger.info(f"Training samples: {len(X_train)}")
    logger.info(f"Test samples: {len(X_test)}")
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Create models
    ensemble, rf_model, gb_model = create_ensemble_model()
    
    # Cross-validation
    logger.info("\nPerforming cross-validation...")
    cv = StratifiedKFold(n_splits=CONFIG["cv_folds"], shuffle=True, random_state=42)
    
    # Train individual models for comparison
    logger.info("\nTraining Random Forest...")
    rf_model.fit(X_train_scaled, y_train)
    rf_cv_scores = cross_val_score(rf_model, X_train_scaled, y_train, cv=cv, scoring='accuracy')
    logger.info(f"Random Forest CV Accuracy: {rf_cv_scores.mean():.4f} (+/- {rf_cv_scores.std() * 2:.4f})")
    
    logger.info("\nTraining Gradient Boosting...")
    gb_model.fit(X_train_scaled, y_train)
    gb_cv_scores = cross_val_score(gb_model, X_train_scaled, y_train, cv=cv, scoring='accuracy')
    logger.info(f"Gradient Boosting CV Accuracy: {gb_cv_scores.mean():.4f} (+/- {gb_cv_scores.std() * 2:.4f})")
    
    logger.info("\nTraining Ensemble...")
    ensemble.fit(X_train_scaled, y_train)
    ensemble_cv_scores = cross_val_score(ensemble, X_train_scaled, y_train, cv=cv, scoring='accuracy')
    logger.info(f"Ensemble CV Accuracy: {ensemble_cv_scores.mean():.4f} (+/- {ensemble_cv_scores.std() * 2:.4f})")
    
    # Evaluate on test set
    logger.info("\n" + "=" * 40)
    logger.info("Test Set Evaluation")
    logger.info("=" * 40)
    
    y_pred = ensemble.predict(X_test_scaled)
    test_accuracy = accuracy_score(y_test, y_pred)
    
    logger.info(f"\nTest Accuracy: {test_accuracy:.4f}")
    
    # Classification report
    class_names = label_encoder.classes_
    report = classification_report(y_test, y_pred, target_names=class_names, output_dict=True)
    
    logger.info("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=class_names))
    
    # Feature importance (from Random Forest)
    feature_importance = dict(zip(feature_cols, rf_model.feature_importances_))
    logger.info("\nFeature Importance:")
    for feat, imp in sorted(feature_importance.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"  {feat}: {imp:.4f}")
    
    return ensemble, scaler, {
        "test_accuracy": test_accuracy,
        "rf_cv_accuracy": rf_cv_scores.mean(),
        "gb_cv_accuracy": gb_cv_scores.mean(),
        "ensemble_cv_accuracy": ensemble_cv_scores.mean(),
        "classification_report": report,
        "feature_importance": feature_importance
    }


def save_model_artifacts(model, scaler, label_encoder, feature_cols, metrics):
    """Save model and associated artifacts."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save complete model as a dictionary (more portable than class)
    complete_model = {
        'model': model,
        'scaler': scaler,
        'label_encoder': label_encoder,
        'feature_cols': feature_cols,
        'classes': list(label_encoder.classes_)
    }
    
    model_path = MODELS_DIR / "crop_recommendation_model.pkl"
    joblib.dump(complete_model, model_path)
    logger.info(f"Model saved to: {model_path}")
    
    # Save individual components for flexibility
    joblib.dump(model, MODELS_DIR / "crop_ensemble_model.pkl")
    joblib.dump(scaler, MODELS_DIR / "crop_scaler.pkl")
    joblib.dump(label_encoder, MODELS_DIR / "crop_label_encoder.pkl")
    
    # Save metadata
    metadata = {
        "feature_columns": feature_cols,
        "classes": list(label_encoder.classes_),
        "num_classes": len(label_encoder.classes_),
        "model_type": "VotingClassifier(RandomForest + GradientBoosting)",
        "training_config": CONFIG,
        "metrics": {
            "test_accuracy": metrics["test_accuracy"],
            "rf_cv_accuracy": metrics["rf_cv_accuracy"],
            "gb_cv_accuracy": metrics["gb_cv_accuracy"],
            "ensemble_cv_accuracy": metrics["ensemble_cv_accuracy"],
            "feature_importance": metrics["feature_importance"]
        },
        "trained_at": datetime.now().isoformat()
    }
    
    metadata_path = MODELS_DIR / "crop_recommendation_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Metadata saved to: {metadata_path}")
    
    # Save classification report
    report_path = MODELS_DIR / "crop_recommendation_report.json"
    with open(report_path, 'w') as f:
        json.dump(metrics["classification_report"], f, indent=2)
    logger.info(f"Classification report saved to: {report_path}")


def main():
    """Main training function."""
    logger.info("=" * 60)
    logger.info("Crop Recommendation Model Training")
    logger.info("=" * 60)
    
    # Check if data exists
    if not DATA_DIR.exists():
        logger.error(f"Data directory not found: {DATA_DIR}")
        logger.info("Please run download_datasets.py first")
        sys.exit(1)
    
    # Load data
    df = load_data()
    
    # Prepare features
    X, y, label_encoder, feature_cols = prepare_features(df)
    
    # Train and evaluate
    model, scaler, metrics = train_and_evaluate(X, y, label_encoder, feature_cols)
    
    # Save artifacts
    save_model_artifacts(model, scaler, label_encoder, feature_cols, metrics)
    
    logger.info("\n" + "=" * 60)
    logger.info("Training complete!")
    logger.info(f"Model saved to: {MODELS_DIR / 'crop_recommendation_model.pkl'}")
    logger.info(f"Test Accuracy: {metrics['test_accuracy']:.4f}")
    logger.info(f"Ensemble CV Accuracy: {metrics['ensemble_cv_accuracy']:.4f}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
