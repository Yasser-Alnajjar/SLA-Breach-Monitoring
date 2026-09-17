import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdvisoryLockConnection } from "@sla/db";
import { startWorkerLeadership, type WorkerLeadership } from "../src/leader-lock";

const LOCK_KEY = 42n;
const RETRY_MS = 1_000;
const PING_MS = 5_000;

/** Stands in for Postgres: one lock, held by whichever open connection took it first. */
function fakePostgres() {
  let holder: FakeConnection | null = null;
  const connections: FakeConnection[] = [];

  class FakeConnection implements AdvisoryLockConnection {
    closed = false;
    pingFails = false;
    private listeners: ((error: Error) => void)[] = [];

    async tryLock() {
      if (this.closed) throw new Error("connection closed");
      if (holder === null || holder.closed) holder = this;
      return holder === this;
    }
    async ping() {
      if (this.pingFails) throw new Error("ping timeout");
    }
    onLost(listener: (error: Error) => void) {
      this.listeners.push(listener);
    }
    async close() {
      this.closed = true;
    }
    /** The server side of the session going away: releases the lock and notifies. */
    kill() {
      this.closed = true;
      for (const listener of this.listeners) listener(new Error("terminated"));
    }
  }

  return {
    connections,
    connect: vi.fn(async () => {
      const connection = new FakeConnection();
      connections.push(connection);
      return connection;
    }),
  };
}

function start(db: ReturnType<typeof fakePostgres>, connect = db.connect) {
  const onAcquired = vi.fn();
  const onLost = vi.fn();
  const leadership = startWorkerLeadership({
    connect,
    lockKey: LOCK_KEY,
    retryMs: RETRY_MS,
    pingMs: PING_MS,
    onAcquired,
    onLost,
  });
  started.push(leadership);
  return { leadership, onAcquired, onLost };
}

const started: WorkerLeadership[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await Promise.all(started.splice(0).map((leadership) => leadership.stop()));
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("startWorkerLeadership", () => {
  it("becomes active and starts cycles when the lock is free", async () => {
    const db = fakePostgres();
    const first = start(db);
    await vi.advanceTimersByTimeAsync(0);

    expect(first.leadership.role()).toBe("active");
    expect(first.onAcquired).toHaveBeenCalledTimes(1);
  });

  it("keeps a second instance in standby, running no cycles, until the holder exits", async () => {
    const db = fakePostgres();
    const first = start(db);
    await vi.advanceTimersByTimeAsync(0);
    const second = start(db);
    await vi.advanceTimersByTimeAsync(RETRY_MS * 3);

    expect(second.leadership.role()).toBe("standby");
    expect(second.onAcquired).not.toHaveBeenCalled();

    // Holder shuts down (deploy overlap ends): its session closes, the lock frees.
    await first.leadership.stop();
    await vi.advanceTimersByTimeAsync(RETRY_MS);

    expect(second.leadership.role()).toBe("active");
    expect(second.onAcquired).toHaveBeenCalledTimes(1);
    expect(first.onLost).not.toHaveBeenCalled();
  });

  it("stays in 'acquiring' and retries while the database is unreachable", async () => {
    const db = fakePostgres();
    let failures = 2;
    const connect = vi.fn(async () => {
      if (failures-- > 0) throw new Error("ECONNREFUSED");
      return db.connect();
    });
    const worker = start(db, connect);
    await vi.advanceTimersByTimeAsync(0);

    expect(worker.leadership.role()).toBe("acquiring");

    await vi.advanceTimersByTimeAsync(RETRY_MS * 2);

    expect(connect).toHaveBeenCalledTimes(3);
    expect(worker.leadership.role()).toBe("active");
  });

  it("reports the lock lost when the holder's connection dies", async () => {
    const db = fakePostgres();
    const worker = start(db);
    await vi.advanceTimersByTimeAsync(0);

    db.connections[0]!.kill();

    expect(worker.onLost).toHaveBeenCalledTimes(1);
  });

  it("reports the lock lost when the holder's keepalive ping fails, only once", async () => {
    const db = fakePostgres();
    const worker = start(db);
    await vi.advanceTimersByTimeAsync(0);

    db.connections[0]!.pingFails = true;
    await vi.advanceTimersByTimeAsync(PING_MS * 3);

    expect(worker.onLost).toHaveBeenCalledTimes(1);
  });

  it("reconnects a standby whose connection dropped, without reporting a lost lock", async () => {
    const db = fakePostgres();
    const first = start(db);
    await vi.advanceTimersByTimeAsync(0);
    const second = start(db);
    await vi.advanceTimersByTimeAsync(0);

    db.connections[1]!.kill();
    await first.leadership.stop();
    await vi.advanceTimersByTimeAsync(RETRY_MS);

    expect(second.onLost).not.toHaveBeenCalled();
    expect(db.connect).toHaveBeenCalledTimes(3);
    expect(second.leadership.role()).toBe("active");
  });
});
