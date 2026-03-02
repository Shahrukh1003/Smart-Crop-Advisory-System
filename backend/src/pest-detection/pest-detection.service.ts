import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PestDetectionRequestDto,
  PestDetectionResponseDto,
  DetectedPestDto,
  TreatmentDto,
} from './dto/pest-detection.dto';

// Treatment database for common pests and diseases
const TREATMENT_DATABASE: Record<string, TreatmentDto[]> = {
  'Aphids': [
    { type: 'organic', name: 'Neem Oil Spray', dosage: '5ml per liter', applicationMethod: 'Foliar spray early morning', cost: 150, effectiveness: 75 },
    { type: 'organic', name: 'Soap Solution', dosage: '10g per liter', applicationMethod: 'Spray on affected areas', cost: 50, effectiveness: 65 },
    { type: 'chemical', name: 'Imidacloprid', dosage: '0.5ml per liter', applicationMethod: 'Foliar spray', cost: 300, effectiveness: 90 },
  ],
  'Rice Blast': [
    { type: 'organic', name: 'Trichoderma', dosage: '5g per liter', applicationMethod: 'Soil drench and foliar', cost: 200, effectiveness: 70 },
    { type: 'chemical', name: 'Tricyclazole', dosage: '0.6g per liter', applicationMethod: 'Foliar spray', cost: 350, effectiveness: 85 },
    { type: 'chemical', name: 'Carbendazim', dosage: '1g per liter', applicationMethod: 'Foliar spray', cost: 250, effectiveness: 80 },
  ],
  'Bacterial Leaf Blight': [
    { type: 'organic', name: 'Copper Hydroxide', dosage: '2g per liter', applicationMethod: 'Foliar spray', cost: 180, effectiveness: 65 },
    { type: 'chemical', name: 'Streptomycin', dosage: '0.5g per liter', applicationMethod: 'Foliar spray', cost: 400, effectiveness: 75 },
  ],
  'Brown Plant Hopper': [
    { type: 'organic', name: 'Neem Seed Kernel Extract', dosage: '50g per liter', applicationMethod: 'Spray at base', cost: 100, effectiveness: 60 },
    { type: 'chemical', name: 'Buprofezin', dosage: '1.5ml per liter', applicationMethod: 'Spray at plant base', cost: 450, effectiveness: 88 },
  ],
  'Stem Borer': [
    { type: 'organic', name: 'Trichogramma Cards', dosage: '50000 eggs per acre', applicationMethod: 'Release in field', cost: 300, effectiveness: 70 },
    { type: 'chemical', name: 'Chlorantraniliprole', dosage: '0.4ml per liter', applicationMethod: 'Foliar spray', cost: 500, effectiveness: 92 },
  ],
  'Powdery Mildew': [
    { type: 'organic', name: 'Sulfur Dust', dosage: '3g per liter', applicationMethod: 'Dusting or spray', cost: 120, effectiveness: 75 },
    { type: 'chemical', name: 'Hexaconazole', dosage: '1ml per liter', applicationMethod: 'Foliar spray', cost: 280, effectiveness: 85 },
  ],
  'Late Blight': [
    { type: 'organic', name: 'Bordeaux Mixture', dosage: '1% solution', applicationMethod: 'Foliar spray', cost: 150, effectiveness: 70 },
    { type: 'chemical', name: 'Mancozeb', dosage: '2.5g per liter', applicationMethod: 'Foliar spray', cost: 200, effectiveness: 80 },
    { type: 'chemical', name: 'Metalaxyl', dosage: '2g per liter', applicationMethod: 'Foliar spray', cost: 350, effectiveness: 88 },
  ],
  'Fruit Fly': [
    { type: 'organic', name: 'Pheromone Traps', dosage: '5 traps per acre', applicationMethod: 'Hang in field', cost: 400, effectiveness: 65 },
    { type: 'chemical', name: 'Spinosad', dosage: '0.3ml per liter', applicationMethod: 'Bait spray', cost: 550, effectiveness: 85 },
  ],
};

// Simulated pest detection model classes
const PEST_CLASSES = [
  'Aphids', 'Rice Blast', 'Bacterial Leaf Blight', 'Brown Plant Hopper',
  'Stem Borer', 'Powdery Mildew', 'Late Blight', 'Fruit Fly', 'Healthy',
];

@Injectable()
export class PestDetectionService {
  private readonly logger = new Logger(PestDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}


  async detectPests(
    userId: string,
    dto: PestDetectionRequestDto,
  ): Promise<PestDetectionResponseDto> {
    // Validate image
    const imageValidation = this.validateImage(dto.image);
    if (!imageValidation.valid) {
      return {
        detectionId: `det-${Date.now()}`,
        imageUrl: '',
        detectedAt: new Date(),
        detections: [],
        requiresBetterImage: true,
        imageQualityMessage: imageValidation.message,
      };
    }

    // Simulate ML model inference
    const detections = await this.runInference(dto.image, dto.cropType);

    // Store detection in database
    const detectionId = await this.storeDetection(userId, dto.image, detections);

    this.logger.log(`Pest detection complete for user ${userId}: ${detections.length} pests found`);

    return {
      detectionId,
      imageUrl: dto.image.startsWith('http') ? dto.image : `data:image/jpeg;base64,${dto.image.substring(0, 50)}...`,
      detectedAt: new Date(),
      detections,
      requiresBetterImage: false,
    };
  }

  private validateImage(image: string): { valid: boolean; message?: string } {
    if (!image || image.length < 100) {
      return { valid: false, message: 'Image is too small or empty. Please capture a clearer image.' };
    }

    // Check if it's a valid base64 or URL
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(image.replace(/\s/g, ''));
    const isUrl = image.startsWith('http://') || image.startsWith('https://');

    if (!isBase64 && !isUrl) {
      return { valid: false, message: 'Invalid image format. Please provide a valid image.' };
    }

    return { valid: true };
  }

  private async runInference(image: string, cropType?: string): Promise<DetectedPestDto[]> {
    // Simulate ML model inference with realistic results
    // In production, this would call TensorFlow Lite or a remote ML service
    
    const detections: DetectedPestDto[] = [];
    const numDetections = Math.floor(Math.random() * 3) + 1; // 1-3 detections

    for (let i = 0; i < numDetections; i++) {
      const pestIndex = Math.floor(Math.random() * (PEST_CLASSES.length - 1)); // Exclude 'Healthy'
      const pestName = PEST_CLASSES[pestIndex];
      
      if (pestName === 'Healthy') continue;

      const confidence = 0.6 + Math.random() * 0.35; // 0.6-0.95
      const severity = confidence > 0.85 ? 'high' : confidence > 0.7 ? 'medium' : 'low';

      const treatments = this.getTreatments(pestName);

      detections.push({
        pestOrDisease: pestName,
        confidence: Math.round(confidence * 100) / 100,
        severity,
        affectedCrop: cropType || 'Unknown',
        treatments,
        referenceImages: [
          `https://example.com/pest-images/${pestName.toLowerCase().replace(/\s/g, '-')}-1.jpg`,
          `https://example.com/pest-images/${pestName.toLowerCase().replace(/\s/g, '-')}-2.jpg`,
        ],
      });
    }

    // Sort by confidence descending
    detections.sort((a, b) => b.confidence - a.confidence);

    return detections;
  }

  getTreatments(pestOrDisease: string): TreatmentDto[] {
    const treatments = TREATMENT_DATABASE[pestOrDisease] || [];
    
    // Sort by effectiveness descending
    return [...treatments].sort((a, b) => b.effectiveness - a.effectiveness);
  }

  getTreatmentsByCategory(pestOrDisease: string): { organic: TreatmentDto[]; chemical: TreatmentDto[] } {
    const treatments = this.getTreatments(pestOrDisease);
    
    return {
      organic: treatments.filter(t => t.type === 'organic'),
      chemical: treatments.filter(t => t.type === 'chemical'),
    };
  }

  private async storeDetection(
    userId: string,
    imageUrl: string,
    detections: DetectedPestDto[],
  ): Promise<string> {
    try {
      const result = await this.prisma.pestDetection.create({
        data: {
          user: { connect: { id: userId } },
          imageUrl: imageUrl.substring(0, 500), // Truncate for storage
          detectedPests: {
            create: detections.map(d => ({
              pestOrDisease: d.pestOrDisease,
              confidence: d.confidence,
              severity: d.severity as any,
              affectedCrop: d.affectedCrop,
              treatments: {
                create: d.treatments.map(t => ({
                  type: t.type as any,
                  name: t.name,
                  dosage: t.dosage,
                  applicationMethod: t.applicationMethod,
                  cost: t.cost,
                  effectiveness: t.effectiveness,
                })),
              },
            })),
          },
        },
      });
      return result.id;
    } catch (error) {
      this.logger.error('Failed to store detection', error);
      return `det-${Date.now()}`;
    }
  }
}
