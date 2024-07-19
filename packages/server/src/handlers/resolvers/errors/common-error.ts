export class GraphQLUnknownError extends Error {
  message: string;

  public constructor() {
    super();
    this.message = 'unknown error';
  }
}
