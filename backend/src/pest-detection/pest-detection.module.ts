import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PestDetectionController } from './pest-detection.controller';
import { PestDetectionService } from './pest-detection.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [PestDetectionController],
  providers: [PestDetectionService],
  exports: [PestDetectionService],
})
export class PestDetectionModule { }
