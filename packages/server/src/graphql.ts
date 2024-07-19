/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export class Task {
  taskId: string;
}

export abstract class IQuery {
  abstract task(id: string): Task | Promise<Task>;
}

type Nullable<T> = T | null;
