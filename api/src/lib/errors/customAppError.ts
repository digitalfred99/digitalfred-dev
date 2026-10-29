export class CustomAppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly errorLabel: string;
  public readonly errorKey: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    errorLabel: string,
    errorKey: string
  ) {
    super(message);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errorLabel = errorLabel;
    this.errorKey = errorKey;

    Error.captureStackTrace(this, this.constructor);
  }
}