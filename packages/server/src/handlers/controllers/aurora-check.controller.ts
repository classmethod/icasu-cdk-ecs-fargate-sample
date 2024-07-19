// 本実装はAurora接続チェックのための実装で、移植しないでください

import { Controller, Get, HttpCode, UseInterceptors } from '@nestjs/common';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next
      .handle()
      .pipe(tap(() => response.removeHeader('Access-Control-Allow-Origin')));
  }
}

@Controller('health-check')
@UseInterceptors(CorsInterceptor)
export class AuroraCheckController {
  @Get()
  @HttpCode(200)
  async findAll(): Promise<void> {
    return;
  }
}
