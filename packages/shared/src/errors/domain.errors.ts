import { ChronosError } from "./base.error";

/* INFO:
 * Thrown when Redis lock cannot be acquired
 * Maps to 503 - the caller (gateway) sends "try again later"
 */
export class LockError extends ChronosError {
  constructor(executionId: string) {
    super(
      "LOCK_UNAVAILABLE",
      `Execution ${executionId} is already being processed`,
      503,
    );
  }
}

/* INFO:
 * Thrown when the sega engine reaches an impossible state
 * Should never happen in production - means a bug in the sega logic
 */
export class SagaError extends ChronosError {
  constructor(message: string) {
    super("SAGA_ERROR", message, 500);
  }
}

// INFO: Thrown when an activity (step) fails after all retries exhausted
export class ActitityError extends ChronosError {
  public readonly stepName: string;
  public readonly attempt: number;

  constructor(stepName: string, attempt: number, cause: string) {
    super(
      "ACTIVITY_FAILED",
      `Step '${stepName}' failed on attempt ${attempt}: ${cause}`,
      500,
    );
    this.stepName = stepName;
    this.attempt = attempt;
  }
}
