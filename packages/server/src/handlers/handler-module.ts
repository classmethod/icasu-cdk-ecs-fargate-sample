import { Module } from '@nestjs/common';
import { TaskUseCase } from 'src/domains/use-cases/task-use-case';
import { TaskRepository } from 'src/infrastructures/task-repository';
import { PrismaClientProvider } from '../infrastructures/prisma-provider';
import { TaskResolver } from './resolvers/task-resolver';

@Module({
  imports: [],
  providers: [PrismaClientProvider, TaskResolver, TaskUseCase, TaskRepository],
})
export class HandlerModule {}
