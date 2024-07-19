import {
  Catch,
  type HttpException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLUnknownError } from './common-error';

export class TaskResolverError extends Error {
  option: object;

  public constructor(option: object) {
    super();
    this.option = option;
  }
}

export class TaskResolverNotFoundError extends TaskResolverError {
  error: unknown;

  public constructor(option: object) {
    super(option);

    this.name = this.constructor.name;
  }
}

export class TaskResolverInvalidRequestError extends TaskResolverError {
  error: unknown;

  public constructor(option: object) {
    super(option);

    this.name = this.constructor.name;
  }
}

export class TaskResolverUnknownError extends TaskResolverError {
  error: unknown;

  public constructor(option: object, error: unknown) {
    super(option);

    this.name = this.constructor.name;
    this.error = error;
  }
}

@Catch()
export class TaskResolverExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(TaskResolverExceptionFilter.name);

  catch(exception: HttpException) {
    this.logger.log(exception.name, exception);

    if (exception instanceof UnauthorizedException) {
      return exception;
    } else {
      this.logger.error(exception.name, exception);
    }

    return new GraphQLUnknownError();
  }
}
