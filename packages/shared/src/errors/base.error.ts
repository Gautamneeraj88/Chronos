//TODO: ChronosError base class

export class ChronosError extends Error {
  public readonly code: string;

  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    /*NOTE:
     * This fixes instanceof check in Typescript when targetting ES5/ES6
     * Without this, `err instanceof NotFoundError` can return false
     */
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
