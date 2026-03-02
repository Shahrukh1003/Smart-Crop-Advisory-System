import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { PestDetectionService } from './pest-detection.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  pestDetection: {
    create: jest.fn().mockResolvedValue({ id: 'test-detection-id' }),
  },
};

describe('PestDetectionService', () => {
  let service: PestDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PestDetectionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PestDetectionService>(PestDetectionService);
    jest.clearAllMocks();
  });

  // **Feature: smart-crop-advisory, Property 13: Detection results include confidence scores**
  // **Validates: Requirements 4.2**
  describe('Property 13: Detection results include confidence scores', () => {
    // Generator for valid base64-like image strings
    const imageArb = fc.string({ minLength: 200, maxLength: 1000 })
      .map(s => s.replace(/[^A-Za-z0-9+/=]/g, 'A')); // Make it base64-like

    const cropTypeArb = fc.constantFrom(
      'Rice', 'Wheat', 'Maize', 'Cotton', 'Tomato', 'Potato', 'Onion'
    );

    it('should include confidence scores between 0 and 1 for each detection', async () => {
      await fc.assert(
        fc.asyncProperty(
          imageArb,
          fc.option(cropTypeArb),
          async (image, cropType) => {
            const result = await service.detectPests('test-user', {
              image,
              cropType: cropType ?? undefined,
            });

            // Property: Each detection should have a confidence score
            for (const detection of result.detections) {
              expect(detection.confidence).toBeGreaterThanOrEqual(0);
              expect(detection.confidence).toBeLessThanOrEqual(1);
              
              // Property: Reference images should be provided
              expect(detection.referenceImages).toBeDefined();
              expect(Array.isArray(detection.referenceImages)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 14: Pest identification generates ranked treatments**
  // **Validates: Requirements 4.3**
  describe('Property 14: Pest identification generates ranked treatments', () => {
    const pestNameArb = fc.constantFrom(
      'Aphids', 'Rice Blast', 'Bacterial Leaf Blight', 'Brown Plant Hopper',
      'Stem Borer', 'Powdery Mildew', 'Late Blight', 'Fruit Fly'
    );

    it('should return non-empty treatments ordered by effectiveness', async () => {
      await fc.assert(
        fc.asyncProperty(
          pestNameArb,
          async (pestName) => {
            const treatments = service.getTreatments(pestName);

            // Property: Treatments should be non-empty for known pests
            expect(treatments.length).toBeGreaterThan(0);

            // Property: Treatments should be sorted by effectiveness (descending)
            for (let i = 0; i < treatments.length - 1; i++) {
              expect(treatments[i].effectiveness).toBeGreaterThanOrEqual(
                treatments[i + 1].effectiveness
              );
            }

            // Property: Each treatment should have required fields
            for (const treatment of treatments) {
              expect(treatment.name).toBeDefined();
              expect(treatment.name.length).toBeGreaterThan(0);
              expect(treatment.dosage).toBeDefined();
              expect(treatment.applicationMethod).toBeDefined();
              expect(treatment.cost).toBeGreaterThanOrEqual(0);
              expect(treatment.effectiveness).toBeGreaterThanOrEqual(0);
              expect(treatment.effectiveness).toBeLessThanOrEqual(100);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 15: Treatment categorization**
  // **Validates: Requirements 4.4**
  describe('Property 15: Treatment categorization', () => {
    const pestNameArb = fc.constantFrom(
      'Aphids', 'Rice Blast', 'Bacterial Leaf Blight', 'Brown Plant Hopper',
      'Stem Borer', 'Powdery Mildew', 'Late Blight', 'Fruit Fly'
    );

    it('should correctly categorize treatments as organic or chemical', async () => {
      await fc.assert(
        fc.asyncProperty(
          pestNameArb,
          async (pestName) => {
            const categorized = service.getTreatmentsByCategory(pestName);

            // Property: Should have both categories defined
            expect(categorized.organic).toBeDefined();
            expect(categorized.chemical).toBeDefined();
            expect(Array.isArray(categorized.organic)).toBe(true);
            expect(Array.isArray(categorized.chemical)).toBe(true);

            // Property: All organic treatments should have type 'organic'
            for (const treatment of categorized.organic) {
              expect(treatment.type).toBe('organic');
            }

            // Property: All chemical treatments should have type 'chemical'
            for (const treatment of categorized.chemical) {
              expect(treatment.type).toBe('chemical');
            }

            // Property: Total treatments should equal sum of categories
            const allTreatments = service.getTreatments(pestName);
            expect(categorized.organic.length + categorized.chemical.length).toBe(allTreatments.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have at least one option in each category when available', async () => {
      // Test specific pests that we know have both types
      const pestsWithBothTypes = ['Aphids', 'Rice Blast', 'Powdery Mildew', 'Late Blight'];
      
      for (const pestName of pestsWithBothTypes) {
        const categorized = service.getTreatmentsByCategory(pestName);
        
        // Property: Should have at least one organic option
        expect(categorized.organic.length).toBeGreaterThan(0);
        
        // Property: Should have at least one chemical option
        expect(categorized.chemical.length).toBeGreaterThan(0);
      }
    });
  });

  // Unit tests for image validation
  describe('Image validation', () => {
    it('should reject empty images', async () => {
      const result = await service.detectPests('test-user', { image: '' });
      expect(result.requiresBetterImage).toBe(true);
      expect(result.imageQualityMessage).toBeDefined();
    });

    it('should reject very small images', async () => {
      const result = await service.detectPests('test-user', { image: 'abc' });
      expect(result.requiresBetterImage).toBe(true);
    });

    it('should accept valid base64 images', async () => {
      const validBase64 = 'A'.repeat(200);
      const result = await service.detectPests('test-user', { image: validBase64 });
      expect(result.requiresBetterImage).toBe(false);
    });

    it('should accept valid URL images', async () => {
      const result = await service.detectPests('test-user', { 
        image: 'https://example.com/image.jpg' + 'A'.repeat(100)
      });
      expect(result.requiresBetterImage).toBe(false);
    });
  });
});
