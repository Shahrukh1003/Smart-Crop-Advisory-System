import { Module } from '@nestjs/common';
import { PestDetectionController } from './pest-detection.controller';
import { PestDetectionService } from './pest-detection.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PestDetectionController],
  providers: [PestDetectionService],
  exports: [PestDetectionService],
})
export class PestDetectionModule {}
