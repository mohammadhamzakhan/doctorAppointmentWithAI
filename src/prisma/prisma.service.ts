import {
  Injectable,
  OnModuleInit,
  Logger,
  INestApplication,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { prisma } from 'src/config/prisma.config';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter, log: ['query', 'info', 'warn', 'error'] });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to Docker Postgres successfully!');
  }

  async enableShutdownHooks(app: INestApplication) {
    (prisma as any).$on('beforeExit', async () => {
      await app.close();
    });
  }
}
