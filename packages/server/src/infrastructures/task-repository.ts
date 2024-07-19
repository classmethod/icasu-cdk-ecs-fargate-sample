import { Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Task } from 'src/graphql';
import { TaskRepositoryUnknownError } from './errors/task-repository-error';
// biome-ignore lint/style/useImportType: Nestが依存関係を解決できなくなるため
import { PrismaClientProvider } from './prisma-provider';

@Injectable()
export class TaskRepository {
  constructor(private prismaClient: PrismaClientProvider) {}

  async getTaskById(userId: string, taskId: string): Promise<Task | null> {
    try {
      const record = await this.prismaClient.tasks.findUnique({
        select: {
          userId: true,
          taskId: true,
        },
        where: {
          userId_taskId: {
            userId,
            taskId,
          },
        },
      });

      return record;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2025') {
          // 存在しない場合
          return null;
        }
      }

      throw new TaskRepositoryUnknownError(
        {
          userId,
          taskId,
        },
        e
      );
    }
  }
}
