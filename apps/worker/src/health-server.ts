import http from "node:http";
import { deriveWorkerStatus, getOrCreateWorkerSettings, type PrismaClient } from "@sla/db";

export interface WorkerHealthServer {
  close(): Promise<void>;
}

/**
 * The worker had no HTTP surface at all before this (roadmap step 29) — a
 * bare `setTimeout` loop with only stdout logs. This is deliberately just a
 * liveness probe for Docker/an orchestrator to restart on, not a general
 * API: no auth (nothing sensitive is returned — timestamps and counts, no
 * credentials), no routing library, just `node:http`, matching this
 * package's zero-framework style.
 */
export function startHealthServer(prisma: PrismaClient, port: number): WorkerHealthServer {
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" || (req.url !== "/health" && req.url !== "/healthz")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }

    void handleHealthRequest(prisma, res);
  });

  server.listen(port, () => {
    console.log(JSON.stringify({ event: "health_server_listening", port }));
  });

  server.on("error", (error) => {
    console.error(JSON.stringify({ event: "health_server_error", error: error.message }));
  });

  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function handleHealthRequest(prisma: PrismaClient, res: http.ServerResponse): Promise<void> {
  try {
    const settings = await getOrCreateWorkerSettings(prisma);
    const status = deriveWorkerStatus(settings);

    // "Successful" means the most recently *completed* run of that kind
    // recorded zero per-organization failures — a cycle that ran but hit
    // failures still advances the heartbeat (see `deriveWorkerStatus`'s doc
    // comment in @sla/db) but doesn't count as a success here.
    const lastSuccessfulActivePollAt = settings.lastActivePollFailures === 0 ? settings.lastActivePollAt : null;
    const lastSuccessfulReconciliationAt =
      settings.lastReconciliationFailures === 0 ? settings.lastReconciliationAt : null;
    const lastSuccessfulCycleAt =
      [lastSuccessfulActivePollAt, lastSuccessfulReconciliationAt]
        .filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    // Per-integration sync health (roadmap step 17's `lastSyncAt`/
    // `lastSyncError`), aggregated platform-wide — "surface an aggregate
    // 'last successful cycle' timestamp too" from this step's scope.
    const [integrationHealth, integrationsWithErrors] = await Promise.all([
      prisma.integration.aggregate({
        _max: { lastSyncAt: true },
        where: { status: { not: "disconnected" } },
      }),
      prisma.integration.count({
        where: { status: { not: "disconnected" }, lastSyncError: { not: null } },
      }),
    ]);

    const body = {
      status,
      lastHeartbeatAt: settings.lastHeartbeatAt?.toISOString() ?? null,
      lastActivePollAt: settings.lastActivePollAt?.toISOString() ?? null,
      lastReconciliationAt: settings.lastReconciliationAt?.toISOString() ?? null,
      lastSuccessfulCycleAt: lastSuccessfulCycleAt?.toISOString() ?? null,
      integrations: {
        mostRecentSyncAt: integrationHealth._max.lastSyncAt?.toISOString() ?? null,
        withErrors: integrationsWithErrors,
      },
    };

    // "stopped" (no heartbeat at all, i.e. the process itself looks wedged)
    // is the only case worth an orchestrator restarting the container over
    // — "degraded" means the process is alive and cycling but a downstream
    // integration is failing, which a restart can't fix.
    res.writeHead(status === "stopped" ? 503 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  } catch (error) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }));
  }
}
