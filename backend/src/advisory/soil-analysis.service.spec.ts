import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { SoilAnalysisService } from './soil-analysis.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {};

describe('SoilAnalysisService', () => {
  let service: SoilAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoilAnalysisService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SoilAnalysisService>(SoilAnalysisService);
  });

  // **Feature: smart-crop-advisory, Property 5: Nutrient deficiencies generate fertilizer recommendations**
  // **Validates: Requirements 2.1**
  describe('Property 5: Nutrient deficiencies generate fertilizer recommendations', () => {
    // Generator for soil data with low nutrients (deficient)
    const deficientSoilArb = fc.record({
      nitrogen: fc.integer({ min: 0, max: 149 }), // Below low threshold (150)
      phosphorus: fc.integer({ min: 0, max: 9 }), // Below low threshold (10)
      potassium: fc.integer({ min: 0, max: 99 }), // Below low threshold (100)
      ph: fc.float({ min: 6.0, max: 7.5, noNaN: true }), // Normal pH
    });

    it('should generate fertilizer recommendations for all deficient nutrients', async () => {
      await fc.assert(
        fc.asyncProperty(
          deficientSoilArb,
          fc.integer({ min: 1, max: 10 }), // land area
          async (soilData, landArea) => {
            const result = service.analyzeSoil(soilData, landArea);

            // Property: All deficient nutrients should have recommendations
            const deficientNutrients = result.deficiencies.filter(d => d.level === 'low');
            
            // For each deficient nutrient (N, P, K), there should be a recommendation
            for (const deficiency of deficientNutrients) {
              if (['Nitrogen', 'Phosphorus', 'Potassium'].includes(deficiency.nutrient)) {
                const hasRecommendation = result.recommendations.some(r => {
                  if (deficiency.nutrient === 'Nitrogen') return r.name === 'Urea' || r.name === 'Ammonium Sulphate';
                  if (deficiency.nutrient === 'Phosphorus') return r.name === 'DAP' || r.name === 'SSP';
                  if (deficiency.nutrient === 'Potassium') return r.name === 'MOP' || r.name === 'SOP';
                  return false;
                });
                expect(hasRecommendation).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 6: Fertilizer recommendation completeness**
  // **Validates: Requirements 2.2**
  describe('Property 6: Fertilizer recommendation completeness', () => {
    const soilDataArb = fc.record({
      nitrogen: fc.integer({ min: 0, max: 500 }),
      phosphorus: fc.integer({ min: 0, max: 500 }),
      potassium: fc.integer({ min: 0, max: 500 }),
      ph: fc.float({ min: 4, max: 9, noNaN: true }),
    });

    it('should include quantity > 0, non-empty timing, and non-empty method for each recommendation', async () => {
      await fc.assert(
        fc.asyncProperty(
          soilDataArb,
          fc.integer({ min: 1, max: 10 }),
          async (soilData, landArea) => {
            const result = service.analyzeSoil(soilData, landArea);

            // Property: Each recommendation must be complete
            for (const rec of result.recommendations) {
              expect(rec.quantity).toBeGreaterThan(0);
              expect(rec.applicationTiming).toBeDefined();
              expect(rec.applicationTiming.length).toBeGreaterThan(0);
              expect(rec.applicationMethod).toBeDefined();
              expect(rec.applicationMethod.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 7: Fertilizer costs are calculated**
  // **Validates: Requirements 2.4**
  describe('Property 7: Fertilizer costs are calculated', () => {
    const deficientSoilArb = fc.record({
      nitrogen: fc.integer({ min: 0, max: 100 }),
      phosphorus: fc.integer({ min: 0, max: 5 }),
      potassium: fc.integer({ min: 0, max: 50 }),
      ph: fc.float({ min: 6.0, max: 7.5, noNaN: true }),
    });

    it('should calculate total cost as sum of individual recommendation costs', async () => {
      await fc.assert(
        fc.asyncProperty(
          deficientSoilArb,
          fc.integer({ min: 1, max: 10 }),
          async (soilData, landArea) => {
            const result = service.analyzeSoil(soilData, landArea);

            // Property: Total cost should equal sum of individual costs
            const calculatedTotal = result.recommendations.reduce(
              (sum, r) => sum + r.estimatedCost,
              0
            );
            expect(result.totalEstimatedCost).toBe(calculatedTotal);

            // Property: Each recommendation should have a cost >= 0
            for (const rec of result.recommendations) {
              expect(rec.estimatedCost).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 8: Treatment application creates follow-up**
  // **Validates: Requirements 2.5**
  describe('Property 8: Treatment application creates follow-up', () => {
    const treatmentNameArb = fc.constantFrom(
      'Urea', 'DAP', 'MOP', 'SSP', 'Agricultural Lime', 'Gypsum', 'Farm Yard Manure (FYM)'
    );

    const dateArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') });

    it('should create follow-up with date after application date', async () => {
      await fc.assert(
        fc.asyncProperty(
          treatmentNameArb,
          dateArb,
          async (treatmentName, applicationDate) => {
            const parcelId = 'test-parcel-id';
            
            const followUp = await service.scheduleFollowUp(
              parcelId,
              treatmentName,
              applicationDate
            );

            // Property: Follow-up date must be after application date
            expect(followUp.followUpDate.getTime()).toBeGreaterThan(applicationDate.getTime());

            // Property: Follow-up must reference the correct parcel
            expect(followUp.parcelId).toBe(parcelId);

            // Property: Follow-up must have pending status
            expect(followUp.status).toBe('pending');

            // Property: Treatment type must be recorded
            expect(followUp.treatmentType).toBe(treatmentName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create follow-ups for all treatments when recording application', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(treatmentNameArb, { minLength: 1, maxLength: 5 }),
          dateArb,
          async (treatmentNames, applicationDate) => {
            const parcelId = 'test-parcel-id';
            const treatments = treatmentNames.map(name => ({
              name,
              quantity: 50,
              applicationDate,
            }));

            const followUps = await service.recordTreatmentApplication(parcelId, treatments);

            // Property: Should create one follow-up per treatment
            expect(followUps.length).toBe(treatments.length);

            // Property: All follow-ups should have dates after application
            for (const followUp of followUps) {
              expect(followUp.followUpDate.getTime()).toBeGreaterThan(applicationDate.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
