export class TaskUseCaseError extends Error {
  option: object;

  public constructor(option: object) {
    super();
    this.option = option;
  }
}

export class TaskUseCaseUnknownError extends TaskUseCaseError {
  error: unknown;

  public constructor(option: object, error: unknown) {
    super(option);

    this.name = this.constructor.name;
    this.error = error;
  }
}
