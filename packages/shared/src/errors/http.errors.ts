//TODO: NotFoundError, ValidationError, etc.

import { ChronosError } from "./base.error";

export class ValidationError extends ChronosError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class UnauthorizedError extends ChronosError {
  constructor(message = "Insufficient permissions") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends ChronosError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends ChronosError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class InternalError extends ChronosError {
  constructor(message = "An unexpected error occurred") {
    super("INTERNAL_ERROR", message, 500);
  }
}
