import {
  type INestApplication,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';
import { LoggerService } from 'src/utils/logger/logger.module';

const logger = new LoggerService();

@Injectable()
export class PrismaClientProvider extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.tryConnect();
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async tryConnect(): Promise<void> {
    while (true) {
      try {
        await this.$connect();
        break;
      } catch (error) {
        logger.error('Failed to connect to the database', error);

        if (error instanceof PrismaClientInitializationError) {
          logger.log('Retrying in 1 second...');

          await this.sleep(1000);
        }
      }
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await this.$disconnect();
      await app.close();
    });
  }
}
