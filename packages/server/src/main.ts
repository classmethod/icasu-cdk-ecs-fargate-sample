import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { expand } from 'dotenv-expand';
import { AppModule } from './app.module';
import { LoggerService } from './utils/logger/logger.module';

const CORS_DOMAIN = process.env.CORS_DOMAIN as string;
const port = process.env.PORT ?? 3001;

const env = dotenv.config();
expand(env);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new LoggerService(),
  });

  app.enableCors({
    origin: CORS_DOMAIN,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: 'authorization,content-type',
  });
  await app.listen(port);
}

bootstrap();
