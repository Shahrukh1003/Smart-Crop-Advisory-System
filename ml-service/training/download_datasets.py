"""Download and prepare datasets for model training."""
import os
import sys
import zipfile
import tarfile
import shutil
import logging
from pathlib import Path
import urllib.request
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Base directories
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

# Dataset URLs
DATASETS = {
    "plantvillage": {
        "url": "https://data.mendeley.com/public-files/datasets/tywbtsjrjv/files/d5652a28-c1d8-4b76-97f3-72fb80f94efc/file_downloaded",
        "filename": "plantvillage.zip",
        "description": "PlantVillage Dataset - 54,305 images of plant leaves"
    },
    "crop_recommendation": {
        "url": "https://raw.githubusercontent.com/Gladiator07/Crop-Recommendation-System/main/Crop_recommendation.csv",
        "filename": "crop_recommendation.csv",
        "description": "Crop Recommendation Dataset - Soil and climate data"
    }
}


def create_directories():
    """Create necessary directories."""
    dirs = [DATA_DIR, MODELS_DIR, DATA_DIR / "raw", DATA_DIR / "processed"]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created directory: {d}")


def download_file(url: str, dest_path: Path, description: str = ""):
    """Download a file with progress indicator."""
    logger.info(f"Downloading {description}...")
    logger.info(f"URL: {url}")
    logger.info(f"Destination: {dest_path}")
    
    try:
        def progress_hook(count, block_size, total_size):
            percent = int(count * block_size * 100 / total_size) if total_size > 0 else 0
            sys.stdout.write(f"\rProgress: {percent}%")
            sys.stdout.flush()
        
        urllib.request.urlretrieve(url, dest_path, progress_hook)
        print()  # New line after progress
        logger.info(f"Downloaded successfully: {dest_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to download: {e}")
        return False


def extract_archive(archive_path: Path, extract_to: Path):
    """Extract zip or tar archive."""
    logger.info(f"Extracting {archive_path}...")
    
    try:
        if archive_path.suffix == '.zip':
            with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                zip_ref.extractall(extract_to)
        elif archive_path.suffix in ['.tar', '.gz', '.tgz']:
            with tarfile.open(archive_path, 'r:*') as tar_ref:
                tar_ref.extractall(extract_to)
        logger.info(f"Extracted to: {extract_to}")
        return True
    except Exception as e:
        logger.error(f"Failed to extract: {e}")
        return False


def create_synthetic_pest_dataset():
    """Create a synthetic pest detection dataset for training."""
    import random
    
    logger.info("Creating synthetic pest detection dataset...")
    
    pest_classes = [
        "aphids", "leaf_blight", "powdery_mildew", "stem_borer", 
        "bacterial_spot", "early_blight", "late_blight", "leaf_curl",
        "mosaic_virus", "rust", "healthy"
    ]
    
    dataset_dir = DATA_DIR / "processed" / "pest_detection"
    
    for split in ["train", "val", "test"]:
        for pest_class in pest_classes:
            class_dir = dataset_dir / split / pest_class
            class_dir.mkdir(parents=True, exist_ok=True)
            
            # Number of images per class per split
            n_images = {"train": 100, "val": 20, "test": 20}[split]
            
            for i in range(n_images):
                # Create synthetic image with class-specific characteristics
                img = create_synthetic_leaf_image(pest_class)
                img_path = class_dir / f"{pest_class}_{split}_{i:04d}.jpg"
                img.save(img_path, "JPEG", quality=90)
        
        logger.info(f"Created {split} split with {len(pest_classes)} classes")
    
    # Save class labels
    labels_path = dataset_dir / "class_labels.json"
    with open(labels_path, 'w') as f:
        json.dump({"classes": pest_classes, "num_classes": len(pest_classes)}, f, indent=2)
    
    logger.info(f"Synthetic pest dataset created at: {dataset_dir}")
    return dataset_dir


def create_synthetic_leaf_image(pest_class: str, size: tuple = (224, 224)):
    """Create a synthetic leaf image with pest-specific characteristics."""
    
    # Base colors for different conditions
    color_profiles = {
        "healthy": {"base": (34, 139, 34), "variation": 20},
        "aphids": {"base": (85, 107, 47), "variation": 30},
        "leaf_blight": {"base": (139, 90, 43), "variation": 40},
        "powdery_mildew": {"base": (169, 169, 169), "variation": 25},
        "stem_borer": {"base": (107, 142, 35), "variation": 35},
        "bacterial_spot": {"base": (85, 85, 0), "variation": 30},
        "early_blight": {"base": (139, 69, 19), "variation": 35},
        "late_blight": {"base": (47, 79, 79), "variation": 30},
        "leaf_curl": {"base": (154, 205, 50), "variation": 25},
        "mosaic_virus": {"base": (124, 252, 0), "variation": 40},
        "rust": {"base": (205, 92, 0), "variation": 30}
    }
    
    profile = color_profiles.get(pest_class, color_profiles["healthy"])
    base_color = profile["base"]
    variation = profile["variation"]
    
    # Create base image with noise
    np.random.seed()
    img_array = np.zeros((size[0], size[1], 3), dtype=np.uint8)
    
    for c in range(3):
        channel = np.random.normal(base_color[c], variation, size)
        img_array[:, :, c] = np.clip(channel, 0, 255).astype(np.uint8)
    
    img = Image.fromarray(img_array)
    
    # Add leaf-like texture
    draw = ImageDraw.Draw(img)
    
    # Add veins
    for _ in range(5):
        x1, y1 = size[0] // 2, size[1] // 2
        x2 = np.random.randint(0, size[0])
        y2 = np.random.randint(0, size[1])
        vein_color = tuple(max(0, c - 30) for c in base_color)
        draw.line([(x1, y1), (x2, y2)], fill=vein_color, width=2)
    
    # Add pest-specific features
    if pest_class != "healthy":
        add_pest_features(img, draw, pest_class, size)
    
    # Apply slight blur for realism
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    
    return img


def add_pest_features(img, draw, pest_class: str, size: tuple):
    """Add pest-specific visual features to the image."""
    
    if pest_class == "aphids":
        # Small dots representing aphids
        for _ in range(np.random.randint(20, 50)):
            x, y = np.random.randint(0, size[0]), np.random.randint(0, size[1])
            draw.ellipse([x-2, y-2, x+2, y+2], fill=(50, 50, 50))
    
    elif pest_class in ["leaf_blight", "bacterial_spot", "early_blight"]:
        # Brown/dark spots
        for _ in range(np.random.randint(5, 15)):
            x, y = np.random.randint(20, size[0]-20), np.random.randint(20, size[1]-20)
            r = np.random.randint(5, 20)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=(101, 67, 33))
    
    elif pest_class == "powdery_mildew":
        # White powdery patches
        for _ in range(np.random.randint(3, 8)):
            x, y = np.random.randint(20, size[0]-20), np.random.randint(20, size[1]-20)
            r = np.random.randint(15, 40)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=(220, 220, 220, 128))
    
    elif pest_class == "rust":
        # Orange/rust colored spots
        for _ in range(np.random.randint(10, 30)):
            x, y = np.random.randint(10, size[0]-10), np.random.randint(10, size[1]-10)
            r = np.random.randint(3, 8)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=(205, 92, 0))
    
    elif pest_class == "mosaic_virus":
        # Mottled pattern
        for _ in range(np.random.randint(20, 40)):
            x, y = np.random.randint(0, size[0]), np.random.randint(0, size[1])
            r = np.random.randint(5, 15)
            color = (np.random.randint(100, 200), np.random.randint(150, 255), np.random.randint(0, 100))
            draw.ellipse([x-r, y-r, x+r, y+r], fill=color)


def create_crop_recommendation_dataset():
    """Create or download crop recommendation dataset."""
    
    logger.info("Creating crop recommendation dataset...")
    
    dataset_dir = DATA_DIR / "processed" / "crop_recommendation"
    dataset_dir.mkdir(parents=True, exist_ok=True)
    
    # Try to download real dataset first
    csv_path = DATA_DIR / "raw" / "crop_recommendation.csv"
    
    if not csv_path.exists():
        success = download_file(
            DATASETS["crop_recommendation"]["url"],
            csv_path,
            "Crop Recommendation Dataset"
        )
        
        if not success:
            logger.info("Creating synthetic crop recommendation dataset...")
            df = create_synthetic_crop_data()
        else:
            df = pd.read_csv(csv_path)
    else:
        df = pd.read_csv(csv_path)
    
    # Process and save
    processed_path = dataset_dir / "crop_data.csv"
    df.to_csv(processed_path, index=False)
    
    # Create train/val/test splits
    from sklearn.model_selection import train_test_split
    
    train_df, temp_df = train_test_split(df, test_size=0.3, random_state=42, stratify=df['label'] if 'label' in df.columns else None)
    val_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=42)
    
    train_df.to_csv(dataset_dir / "train.csv", index=False)
    val_df.to_csv(dataset_dir / "val.csv", index=False)
    test_df.to_csv(dataset_dir / "test.csv", index=False)
    
    logger.info(f"Dataset splits - Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")
    logger.info(f"Crop recommendation dataset saved to: {dataset_dir}")
    
    return dataset_dir


def create_synthetic_crop_data():
    """Create synthetic crop recommendation data."""
    
    np.random.seed(42)
    
    crops = ['rice', 'wheat', 'maize', 'cotton', 'sugarcane', 'groundnut', 'soybean', 'tomato',
             'potato', 'onion', 'chickpea', 'lentil', 'mustard', 'sunflower', 'millet']
    
    # Crop-specific parameter ranges
    crop_params = {
        'rice': {'N': (80, 120), 'P': (40, 60), 'K': (40, 60), 'temp': (20, 35), 'humidity': (70, 90), 'ph': (5.5, 7.0), 'rainfall': (150, 300)},
        'wheat': {'N': (100, 140), 'P': (50, 70), 'K': (30, 50), 'temp': (15, 25), 'humidity': (50, 70), 'ph': (6.0, 7.5), 'rainfall': (50, 100)},
        'maize': {'N': (60, 100), 'P': (35, 55), 'K': (35, 55), 'temp': (20, 32), 'humidity': (55, 75), 'ph': (5.5, 7.5), 'rainfall': (80, 150)},
        'cotton': {'N': (80, 120), 'P': (40, 60), 'K': (50, 70), 'temp': (25, 35), 'humidity': (60, 80), 'ph': (6.0, 8.0), 'rainfall': (60, 120)},
        'sugarcane': {'N': (100, 150), 'P': (50, 80), 'K': (60, 90), 'temp': (25, 38), 'humidity': (70, 90), 'ph': (6.0, 8.0), 'rainfall': (150, 250)},
        'groundnut': {'N': (20, 40), 'P': (40, 60), 'K': (30, 50), 'temp': (25, 35), 'humidity': (50, 70), 'ph': (6.0, 7.0), 'rainfall': (50, 100)},
        'soybean': {'N': (20, 40), 'P': (50, 70), 'K': (40, 60), 'temp': (20, 30), 'humidity': (60, 80), 'ph': (6.0, 7.5), 'rainfall': (60, 120)},
        'tomato': {'N': (80, 120), 'P': (60, 80), 'K': (70, 90), 'temp': (20, 30), 'humidity': (60, 80), 'ph': (6.0, 7.0), 'rainfall': (50, 100)},
        'potato': {'N': (100, 140), 'P': (60, 80), 'K': (80, 100), 'temp': (15, 25), 'humidity': (70, 90), 'ph': (5.5, 6.5), 'rainfall': (80, 150)},
        'onion': {'N': (60, 80), 'P': (40, 60), 'K': (50, 70), 'temp': (15, 25), 'humidity': (60, 80), 'ph': (6.0, 7.0), 'rainfall': (50, 80)},
        'chickpea': {'N': (20, 40), 'P': (40, 60), 'K': (30, 50), 'temp': (20, 30), 'humidity': (40, 60), 'ph': (6.0, 8.0), 'rainfall': (40, 80)},
        'lentil': {'N': (20, 40), 'P': (40, 60), 'K': (30, 50), 'temp': (15, 25), 'humidity': (40, 60), 'ph': (6.0, 8.0), 'rainfall': (40, 80)},
        'mustard': {'N': (60, 80), 'P': (30, 50), 'K': (30, 50), 'temp': (15, 25), 'humidity': (50, 70), 'ph': (6.0, 7.5), 'rainfall': (40, 80)},
        'sunflower': {'N': (60, 80), 'P': (40, 60), 'K': (40, 60), 'temp': (20, 30), 'humidity': (50, 70), 'ph': (6.0, 7.5), 'rainfall': (50, 100)},
        'millet': {'N': (40, 60), 'P': (20, 40), 'K': (20, 40), 'temp': (25, 35), 'humidity': (40, 60), 'ph': (5.5, 7.5), 'rainfall': (30, 80)}
    }
    
    data = []
    samples_per_crop = 200
    
    for crop in crops:
        params = crop_params[crop]
        for _ in range(samples_per_crop):
            row = {
                'N': np.random.uniform(*params['N']),
                'P': np.random.uniform(*params['P']),
                'K': np.random.uniform(*params['K']),
                'temperature': np.random.uniform(*params['temp']),
                'humidity': np.random.uniform(*params['humidity']),
                'ph': np.random.uniform(*params['ph']),
                'rainfall': np.random.uniform(*params['rainfall']),
                'label': crop
            }
            # Add some noise
            for key in ['N', 'P', 'K', 'temperature', 'humidity', 'rainfall']:
                row[key] += np.random.normal(0, row[key] * 0.1)
            data.append(row)
    
    df = pd.DataFrame(data)
    logger.info(f"Created synthetic dataset with {len(df)} samples for {len(crops)} crops")
    return df


def main():
    """Main function to download and prepare all datasets."""
    logger.info("=" * 60)
    logger.info("Smart Crop Advisory - Dataset Preparation")
    logger.info("=" * 60)
    
    # Create directories
    create_directories()
    
    # Create pest detection dataset
    logger.info("\n" + "=" * 40)
    logger.info("Preparing Pest Detection Dataset")
    logger.info("=" * 40)
    pest_dir = create_synthetic_pest_dataset()
    
    # Create crop recommendation dataset
    logger.info("\n" + "=" * 40)
    logger.info("Preparing Crop Recommendation Dataset")
    logger.info("=" * 40)
    crop_dir = create_crop_recommendation_dataset()
    
    logger.info("\n" + "=" * 60)
    logger.info("Dataset preparation complete!")
    logger.info(f"Pest detection data: {pest_dir}")
    logger.info(f"Crop recommendation data: {crop_dir}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
