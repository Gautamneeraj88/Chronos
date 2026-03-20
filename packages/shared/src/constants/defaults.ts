/* NOTE:
 * How many times an activity retries before giving up
 * Used in WorkflowStep when no explicit retries value is provided
 */
export const DEFAULT_RETERIES = 3;

/* NOTE:
 * How long (ms) as activity is allowed to run before timeout
 */
export const DEFAULT_TIMEOUT_MS = 5000;

/* NOTE:
 * How long (ms) the Redis lock is held before auto-expiry
 * This is the crash-recovery window - if the process dies,
 * the lock expires and RecoveryEngine can take over
 */
export const LOCK_TTL_MS = 30000;

/* NOTE:
 * How often (ms) to renew a lock while an execution is still running
 * Must be less than LOCK_TTL_MS - renew before it expires
 */
export const LOCK_RENEWAL_INTERVAL_MS = 10000;

/* NOTE:
 * Maximum number of steps a workflow can have
 * Prevents runaway workflow definitions
*/
export const MAX_STEPS = 50;
