import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(skip?: number, take?: number): Promise<User[]> {
    return this.usersRepository.findAll({ skip, take });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findByPhoneNumber(phoneNumber);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.findById(id); // Ensure user exists
    return this.usersRepository.update(id, data);
  }

  async delete(id: string): Promise<User> {
    await this.findById(id); // Ensure user exists
    return this.usersRepository.delete(id);
  }

  async findWithLandParcels(userId: string) {
    return this.usersRepository.findWithLandParcels(userId);
  }

  async findFarmersInRegion(district: string, state: string): Promise<User[]> {
    return this.usersRepository.findFarmersInRegion(district, state);
  }
}
