import { Injectable } from '@nestjs/common';
import type { Task } from 'src/graphql';
// biome-ignore lint/style/useImportType: Nestが依存関係を解決できなくなるため
import { TaskRepository } from 'src/infrastructures/task-repository';
import { TaskUseCaseUnknownError } from '../errors/task-use-case-error';

@Injectable()
export class TaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async getTask(userId: string, taskId: string): Promise<Task | null> {
    try {
      const task = await this.taskRepository.getTaskById(userId, taskId);

      return task;
    } catch (e) {
      throw new TaskUseCaseUnknownError(
        {
          userId,
          taskId,
        },
        e
      );
    }
  }
}
