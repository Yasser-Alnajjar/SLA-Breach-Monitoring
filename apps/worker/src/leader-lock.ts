import type { AdvisoryLockConnection } from "@sla/db";

/**
 * "acquiring": no lock attempt has completed yet (typically the database is
 * unreachable). "standby": another instance holds the lock; this one retries
 * and runs no cycles. "active": this instance holds the lock and runs cycles.
 */
export type WorkerRole = "acquiring" | "standby" | "active";

export interface WorkerLeadershipOptions {
  connect: () => Promise<AdvisoryLockConnection>;
  lockKey: bigint;
  retryMs: number;
  /** How often the active instance round-trips its lock connection, so a silently dead one is noticed. */
  pingMs: number;
  onAcquired: () => void;
  /** The lock is gone (connection died). Cycles must stop: another instance may already hold it. */
  onLost: (error: Error) => void;
}

export interface WorkerLeadership {
  role(): WorkerRole;
  stop(): Promise<void>;
}

/**
 * Roadmap step 42: the worker is only safe as one instance — two would race
 * on `Integration.cursor`. `index.ts`'s `inFlight` flag only serializes
 * cycles within a process; this serializes processes, via a Postgres
 * session-level advisory lock held for the process's whole lifetime. A
 * deploy that briefly overlaps two containers, or `--scale worker=2`, leaves
 * the newcomer in standby until the holder exits and Postgres releases the
 * lock with its session.
 *
 * Not horizontal scaling: a standby does nothing but retry.
 */
export function startWorkerLeadership(options: WorkerLeadershipOptions): WorkerLeadership {
  let role: WorkerRole = "acquiring";
  let connection: AdvisoryLockConnection | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let pingTimer: NodeJS.Timeout | null = null;
  let stopped = false;
  let lost = false;

  const scheduleRetry = () => {
    if (stopped) return;
    retryTimer = setTimeout(() => void attempt(), options.retryMs);
  };

  const dropConnection = () => {
    const stale = connection;
    connection = null;
    if (stale) void stale.close().catch(() => undefined);
  };

  const loseLock = (error: Error) => {
    if (stopped || lost) return;
    lost = true;
    if (pingTimer) clearInterval(pingTimer);
    console.error(JSON.stringify({ event: "worker_lock_lost", error: error.message }));
    options.onLost(error);
  };

  const attempt = async () => {
    if (stopped) return;
    try {
      if (!connection) {
        const fresh = await options.connect();
        if (stopped) {
          await fresh.close();
          return;
        }
        connection = fresh;
        fresh.onLost((error) => {
          if (connection !== fresh) return;
          if (role === "active") {
            loseLock(error);
          } else {
            // A standby losing its connection holds nothing; reconnect on the next retry.
            connection = null;
          }
        });
      }

      const acquired = await connection.tryLock(options.lockKey);
      if (stopped) return;

      if (acquired) {
        role = "active";
        console.log(JSON.stringify({ event: "worker_lock_acquired" }));
        const held = connection;
        pingTimer = setInterval(() => {
          held.ping().catch((error: unknown) => loseLock(error instanceof Error ? error : new Error(String(error))));
        }, options.pingMs);
        options.onAcquired();
        return;
      }

      if (role !== "standby") {
        console.log(JSON.stringify({ event: "worker_standby", reason: "another worker instance holds the lock", retryMs: options.retryMs }));
      }
      role = "standby";
    } catch (error) {
      console.error(
        JSON.stringify({ event: "worker_lock_attempt_failed", error: error instanceof Error ? error.message : String(error) }),
      );
      dropConnection();
    }
    scheduleRetry();
  };

  void attempt();

  return {
    role: () => role,
    async stop() {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      const held = connection;
      connection = null;
      if (held) await held.close().catch(() => undefined);
    },
  };
}
