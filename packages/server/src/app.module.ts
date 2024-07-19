import { ApolloServerErrorCode } from '@apollo/server/errors';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import {
  BadRequestException,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import type { GraphQLFormattedError } from 'graphql';
import { AuthModule } from './auth/auth.module';
import { HealthCheckController } from './handlers/controllers/health-check.controller';
import { HandlerModule } from './handlers/handler-module';
import { PrismaClientProvider } from './infrastructures/prisma-provider';
import { ComplexityPlugin } from './plugins/apollo-complexity-plugin';
import { LoggerService, asyncLocalStorage } from './utils/logger/logger.module';

const GRAPHQL_SCHEMA_PATH =
  process.env.GRAPHQL_SCHEMA_PATH ?? '../../schema.graphql';

const DEV_STAGE_NAME = 'dev';
const STAGE_NAME = process.env.STAGE_NAME ?? DEV_STAGE_NAME;

const logger = new LoggerService();

@Module({
  controllers: [HealthCheckController],
  providers: [ComplexityPlugin, PrismaClientProvider],
  imports: [
    AuthModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: STAGE_NAME === DEV_STAGE_NAME,
      introspection: STAGE_NAME === DEV_STAGE_NAME, // playgroundの補完が効くどうか
      typePaths: [GRAPHQL_SCHEMA_PATH],
      persistedQueries: false,
      formatError: (formattedError: GraphQLFormattedError) => {
        logger.log(`CatchException`, formattedError);

        if (
          formattedError.extensions?.code ===
          ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED
        ) {
          return new BadRequestException();
        }

        // stacktraceやpathなど不要な情報は除外
        const extensions: {
          code?: string;
          response?: object;
        } = {};

        if (
          formattedError.extensions?.code != null &&
          typeof formattedError.extensions?.code === 'string'
        ) {
          extensions.code = formattedError.extensions.code;
        }

        if (
          formattedError.extensions?.originalError != null &&
          typeof formattedError.extensions?.originalError === 'object'
        ) {
          extensions.response = formattedError.extensions.originalError;
        }

        return {
          message: formattedError.message,
          extensions: extensions,
        };
      },
    }),
    HandlerModule,
  ],
})
export class AppModule implements NestModule {
  constructor() {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, _res: any, next: any) => {
        const requestId = req.headers['x-amzn-trace-id'];
        const store = asyncLocalStorage.getStore();

        asyncLocalStorage.run(
          {
            ...store,
            requestId,
          },
          next
        );
      })
      .forRoutes('*');
  }
}
