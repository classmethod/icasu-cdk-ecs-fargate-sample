export class TaskRepositoryError extends Error {
  params: object;

  public constructor(params: object) {
    super();
    this.params = params;
  }
}

export class TaskRepositoryUnknownError extends TaskRepositoryError {
  error: unknown;

  public constructor(params: object, error: unknown) {
    super(params);

    this.name = this.constructor.name;
    this.error = error;
  }
}
