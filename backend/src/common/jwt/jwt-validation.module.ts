import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtValidationService } from './jwt-validation.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [JwtValidationService],
  exports: [JwtValidationService],
})
export class JwtValidationModule {}
