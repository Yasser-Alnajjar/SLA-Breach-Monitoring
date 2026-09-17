import pg from "pg";

/**
 * Advisory-lock key the worker holds while it runs cycles (roadmap step 42).
 * Arbitrary but fixed: every worker instance against the same database must
 * agree on it, and nothing else in this schema takes advisory locks.
 */
export const WORKER_ADVISORY_LOCK_KEY = 4_242_001n;

/**
 * One dedicated Postgres connection for a session-level advisory lock.
 *
 * Deliberately not `prisma.$queryRaw`: Prisma's driver adapter runs queries
 * on a `pg` pool, and a session-level lock belongs to whichever pooled
 * connection happened to run `pg_try_advisory_lock` — it could be released
 * by that connection being recycled, and `pg_advisory_unlock` could land on
 * a different connection that doesn't hold it. Holding it on a connection
 * nothing else uses keeps "this connection is alive" and "this process
 * holds the lock" the same fact.
 */
export interface AdvisoryLockConnection {
  /** `pg_try_advisory_lock`: true if this connection now holds the lock. */
  tryLock(key: bigint): Promise<boolean>;
  /** Round-trips a trivial query, so a dead TCP connection surfaces as `onLost`. */
  ping(): Promise<void>;
  /** Called at most once, when the connection errors or ends — any lock it held is gone. */
  onLost(listener: (error: Error) => void): void;
  close(): Promise<void>;
}

export async function connectAdvisoryLockConnection(
  connectionString: string = process.env.DATABASE_URL!,
): Promise<AdvisoryLockConnection> {
  const client = new pg.Client({ connectionString, keepAlive: true });
  let lost = false;
  let closing = false;
  const listeners: ((error: Error) => void)[] = [];

  const markLost = (error: Error) => {
    if (lost || closing) return;
    lost = true;
    for (const listener of listeners) listener(error);
  };

  client.on("error", markLost);
  client.on("end", () => markLost(new Error("advisory lock connection ended")));

  await client.connect();

  return {
    async tryLock(key) {
      const result = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1::bigint) AS locked", [
        key.toString(),
      ]);
      return result.rows[0]?.locked === true;
    },
    async ping() {
      await client.query("SELECT 1");
    },
    onLost(listener) {
      listeners.push(listener);
    },
    async close() {
      closing = true;
      // Ending the session releases every session-level lock it held; no
      // explicit `pg_advisory_unlock` needed.
      await client.end();
    },
  };
}
