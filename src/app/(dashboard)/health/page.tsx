"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import type {
  AdminQueueStats,
  AdminRealtimeStats,
  AdminSystemStats,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Stat, StatRowGroup } from "@/components/stat-row";
import { formatBytes, formatDuration } from "@/lib/format";

// Realtime polls every 10s but openSockets/socketNodes are cached ≥30s
// SERVER-SIDE regardless — see the backend's OpsService. Queues/system poll
// at the same 10s cadence; none of these are expensive reads (job counts and
// process stats), unlike fetchSockets(), which is why only that one field is
// specially cached upstream.
const POLL_MS = 10_000;

export default function HealthPage() {
  const realtime = useQuery({
    queryKey: ["ops", "realtime"],
    queryFn: () => api.get<AdminRealtimeStats>("/admin/ops/realtime"),
    refetchInterval: POLL_MS,
  });

  const queues = useQuery({
    queryKey: ["ops", "queues"],
    queryFn: () => api.get<AdminQueueStats[]>("/admin/ops/queues"),
    refetchInterval: POLL_MS,
  });

  const system = useQuery({
    queryKey: ["ops", "system"],
    queryFn: () => api.get<AdminSystemStats>("/admin/ops/system"),
    refetchInterval: POLL_MS,
  });

  function forceRefreshSockets() {
    void api
      .get<AdminRealtimeStats>("/admin/ops/realtime", { refresh: true })
      .then(() => realtime.refetch());
  }

  const leakGap =
    realtime.data && realtime.data.onlineUsers > realtime.data.openSockets + 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Server Health</h1>
        <p className="text-sm text-muted-foreground">
          Live counts from whichever worker answered this request — see each
          stat for scope
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Realtime
        </h2>
        <div className="relative">
          <StatRowGroup>
            <Stat
              label="Online users"
              value={realtime.data?.onlineUsers}
              hint="Redis presence — independent of open sockets"
            />
            <Stat
              label="Open sockets"
              value={realtime.data?.openSockets}
              hint={
                realtime.data?.socketStatsCached
                  ? "Cached (≥30s), cluster-wide"
                  : "Fresh, cluster-wide"
              }
            />
            <Stat
              label="Socket nodes"
              value={realtime.data?.socketNodes}
              hint="Live adapter subs — not the PM2 worker count"
            />
          </StatRowGroup>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 size-6"
            onClick={forceRefreshSockets}
            title="Force a fresh read (expensive — asks every cluster node)"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        {leakGap && (
          <p className="rounded-md border border-status-pending/30 bg-status-pending/5 p-2 text-xs text-status-pending">
            Online users exceeds open sockets by more than a handful — this
            can indicate the presence-counter leak documented for a process
            that dies without a graceful disconnect.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Queues
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {queues.data?.map((q) => (
            <div key={q.name} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-medium">{q.name}</span>
                {q.counts.failed > 0 && (
                  <span className="font-mono text-xs text-status-danger">
                    {q.counts.failed} failed
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {["waiting", "active", "completed", "delayed"].map((key) => (
                  <div key={key}>
                    <p className="font-mono text-base font-semibold tabular-nums">
                      {q.counts[key] ?? 0}
                    </p>
                    <p className="text-muted-foreground capitalize">{key}</p>
                  </div>
                ))}
              </div>
              {q.recentFailures.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-border pt-2">
                  {q.recentFailures.slice(0, 3).map((f) => (
                    <p key={f.id} className="truncate text-xs text-status-danger">
                      {f.failedReason ?? "Unknown error"}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          System{" "}
          {system.data && (
            <span className="font-mono normal-case">(pid {system.data.pid})</span>
          )}
        </h2>
        <StatRowGroup>
          <Stat
            label="Uptime"
            value={system.data ? formatDuration(system.data.uptimeSeconds) : undefined}
          />
          <Stat
            label="Heap used"
            value={system.data ? formatBytes(system.data.memory.heapUsedBytes) : undefined}
          />
          <Stat
            label="DB pool"
            value={
              system.data
                ? `${system.data.db.totalCount - system.data.db.idleCount}/${system.data.db.totalCount}`
                : undefined
            }
            hint="active/total connections"
          />
          <Stat
            label="Redis memory"
            value={system.data ? formatBytes(system.data.redis.usedMemoryBytes) : undefined}
            hint="cluster-wide"
          />
        </StatRowGroup>
      </section>
    </div>
  );
}
