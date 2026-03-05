import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { PerformanceInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Response compression for improved performance
  // Compresses responses > 1KB using gzip
  app.use(compression({
    threshold: 1024, // Only compress responses > 1KB
    level: 6, // Compression level (1-9, 6 is default balance)
    filter: (req, res) => {
      // Don't compress if client doesn't accept gzip
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  }));

  // Security
  app.use(helmet());

  // Enable CORS for mobile app
  const isProduction = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProduction
      ? (process.env.CORS_ORIGINS || '').split(',').filter(Boolean)
      : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Performance monitoring - logs slow requests (> 500ms)
  app.useGlobalInterceptors(new PerformanceInterceptor(500));

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Smart Crop Advisory API')
    .setDescription('API for Smart Crop Advisory System for Small and Marginal Farmers')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('advisory', 'Crop advisory endpoints')
    .addTag('weather', 'Weather service endpoints')
    .addTag('market', 'Market price endpoints')
    .addTag('pest', 'Pest detection endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
