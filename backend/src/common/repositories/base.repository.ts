import { PrismaService } from '../../prisma/prisma.service';

export abstract class BaseRepository<T, CreateDto, UpdateDto> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string,
  ) {}

  async findAll(options?: { skip?: number; take?: number; where?: any; orderBy?: any }): Promise<T[]> {
    return (this.prisma as any)[this.modelName].findMany(options);
  }

  async findById(id: string): Promise<T | null> {
    return (this.prisma as any)[this.modelName].findUnique({ where: { id } });
  }

  async findOne(where: any): Promise<T | null> {
    return (this.prisma as any)[this.modelName].findFirst({ where });
  }

  async create(data: CreateDto): Promise<T> {
    return (this.prisma as any)[this.modelName].create({ data });
  }

  async update(id: string, data: UpdateDto): Promise<T> {
    return (this.prisma as any)[this.modelName].update({ where: { id }, data });
  }

  async delete(id: string): Promise<T> {
    return (this.prisma as any)[this.modelName].delete({ where: { id } });
  }

  async count(where?: any): Promise<number> {
    return (this.prisma as any)[this.modelName].count({ where });
  }

  async transaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
    return this.prisma.$transaction(fn);
  }
}
