import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { LandParcelsService } from './land-parcels.service';
import { CreateLandParcelDto, UpdateLandParcelDto, CreateSoilTestDto } from './dto/land-parcel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('land-parcels')
@Controller('land-parcels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LandParcelsController {
  constructor(private readonly service: LandParcelsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all land parcels for current user' })
  async findAll(@CurrentUser('userId') userId: string) {
    return this.service.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get land parcel by ID' })
  async findById(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.findById(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new land parcel' })
  @ApiResponse({ status: 201, description: 'Land parcel created' })
  async create(@Body() dto: CreateLandParcelDto, @CurrentUser('userId') userId: string) {
    return this.service.create(userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update land parcel' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLandParcelDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete land parcel' })
  async delete(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.delete(id, userId);
  }

  @Post(':id/soil-tests')
  @ApiOperation({ summary: 'Add soil test result' })
  async addSoilTest(
    @Param('id') id: string,
    @Body() dto: CreateSoilTestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.addSoilTest(id, userId, dto);
  }

  @Get(':id/soil-tests')
  @ApiOperation({ summary: 'Get soil test history' })
  async getSoilTests(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.getSoilTests(id, userId);
  }
}
