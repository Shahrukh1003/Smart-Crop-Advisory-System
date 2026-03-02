"""Master training script - prepares data and trains all models."""
import os
import sys
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent


def main():
    """Run complete training pipeline."""
    start_time = datetime.now()
    
    logger.info("=" * 70)
    logger.info("SMART CROP ADVISORY - COMPLETE MODEL TRAINING PIPELINE")
    logger.info("=" * 70)
    logger.info(f"Started at: {start_time}")
    logger.info("")
    
    # Step 1: Prepare datasets
    logger.info("=" * 70)
    logger.info("STEP 1: PREPARING DATASETS")
    logger.info("=" * 70)
    
    try:
        from download_datasets import main as prepare_datasets
        prepare_datasets()
        logger.info("✅ Datasets prepared successfully")
    except Exception as e:
        logger.error(f"❌ Dataset preparation failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Step 2: Train Crop Recommendation Model
    logger.info("\n" + "=" * 70)
    logger.info("STEP 2: TRAINING CROP RECOMMENDATION MODEL")
    logger.info("=" * 70)
    
    try:
        from train_crop_recommendation import main as train_crop
        train_crop()
        logger.info("✅ Crop recommendation model trained successfully")
    except Exception as e:
        logger.error(f"❌ Crop recommendation training failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Step 3: Train Pest Detection Model
    logger.info("\n" + "=" * 70)
    logger.info("STEP 3: TRAINING PEST DETECTION MODEL")
    logger.info("=" * 70)
    
    try:
        from train_pest_detection import main as train_pest
        train_pest()
        logger.info("✅ Pest detection model trained successfully")
    except Exception as e:
        logger.error(f"❌ Pest detection training failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    end_time = datetime.now()
    duration = end_time - start_time
    
    logger.info("\n" + "=" * 70)
    logger.info("TRAINING PIPELINE COMPLETE")
    logger.info("=" * 70)
    logger.info(f"Started: {start_time}")
    logger.info(f"Finished: {end_time}")
    logger.info(f"Duration: {duration}")
    logger.info("")
    
    # Check what models were created
    models_dir = BASE_DIR / "models"
    if models_dir.exists():
        logger.info("Created model files:")
        for f in models_dir.iterdir():
            if f.is_file() and f.suffix in ['.h5', '.pkl', '.tflite', '.json']:
                size_mb = f.stat().st_size / (1024 * 1024)
                logger.info(f"  ✅ {f.name} ({size_mb:.2f} MB)")
    
    logger.info("\n" + "=" * 70)
    logger.info("Models are ready for use!")
    logger.info("Restart the ML service to load the trained models.")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
