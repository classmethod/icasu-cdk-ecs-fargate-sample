import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, GraphqlAuthGuard } from 'src/auth/graphql.guard';
import type { Claim } from 'src/auth/jwt.strategy';
// biome-ignore lint/style/useImportType: Nestが依存関係を解決できなくなるため
import { TaskUseCase } from 'src/domains/use-cases/task-use-case';
import { Task } from 'src/graphql';
import * as zod from 'zod';
import {
  TaskResolverExceptionFilter,
  TaskResolverInvalidRequestError,
  TaskResolverNotFoundError,
  TaskResolverUnknownError,
} from './errors/task-resolver-error';

const eventSchema = zod.object({
  id: zod.string(),
});

@Resolver()
export class TaskResolver {
  private readonly logger = new Logger(TaskResolver.name);

  constructor(private taskUseCase: TaskUseCase) {}

  @UseGuards(GraphqlAuthGuard)
  @Query(() => Task)
  @UseFilters(TaskResolverExceptionFilter)
  async task(
    @CurrentUser() user: Claim,
    @Args() option?: unknown
  ): Promise<Task> {
    try {
      this.logger.log('CalledTaskResolver', { option, user });
      const parseResult = eventSchema.safeParse(option);

      if (parseResult.success) {
        const res = await this.taskUseCase.getTask(
          user.sub,
          parseResult.data.id
        );
        if (res == null) {
          throw new TaskResolverNotFoundError({ option, user });
        }

        return {
          taskId: res.taskId,
        };
      } else {
        throw new TaskResolverInvalidRequestError({ option, user });
      }
    } catch (e) {
      throw new TaskResolverUnknownError({ option, user }, e);
    }
  }
}
