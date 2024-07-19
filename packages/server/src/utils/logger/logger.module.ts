import { AsyncLocalStorage } from 'node:async_hooks';
import * as util from 'node:util';
import { Module } from '@nestjs/common';
import {
  Injectable,
  type LoggerService as NestCommonLoggerService,
} from '@nestjs/common';
import * as winston from 'winston';

export const asyncLocalStorage = new AsyncLocalStorage<{
  requestId?: string;
}>();

const LOG_LEVEL = process.env.LOG_LEVEL;

@Injectable()
export class LoggerService implements NestCommonLoggerService {
  logger: winston.Logger;

  constructor() {
    const logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()],
      level: LOG_LEVEL ?? 'info',
    });

    this.logger = logger;
  }

  debug(message: string) {
    const store = asyncLocalStorage?.getStore();

    this.logger.log({
      level: 'debug',
      requestId: store?.requestId,
      message: message,
    });
  }

  log(message: string, params?: unknown) {
    const store = asyncLocalStorage?.getStore();

    this.logger.log({
      level: 'info',
      requestId: store?.requestId,
      message: message,
      params: params,
    });
  }

  error(message: string, error: unknown, params?: unknown) {
    const store = asyncLocalStorage?.getStore();

    this.logger.log({
      level: 'error',
      requestId: store?.requestId,
      message: message,
      error: util.inspect(error),
      params: params,
    });
  }

  warn(message: string, error: unknown) {
    const store = asyncLocalStorage?.getStore();
    this.logger.log({
      level: 'warn',
      requestId: store?.requestId,
      message: message,
      error: util.inspect(error),
    });
  }
}

@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggingModule {}
