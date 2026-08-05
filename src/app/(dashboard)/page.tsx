"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AdminFunnel,
  AdminOverview,
  AdminTimeseriesPoint,
  TimeseriesMetric,
} from "@/lib/types";
import { Stat, StatRowGroup } from "@/components/stat-row";
import { TimeseriesChart } from "@/components/dashboard/timeseries-chart";
import { FunnelBars } from "@/components/dashboard/funnel-bars";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPaise } from "@/lib/format";

const METRIC_OPTIONS: { value: TimeseriesMetric; label: string }[] = [
  { value: "signups", label: "Signups" },
  { value: "logins", label: "Logins" },
  { value: "messages", label: "Messages" },
  { value: "newSubscriptions", label: "New subscriptions" },
];

export default function DashboardPage() {
  const [metric, setMetric] = useState<TimeseriesMetric>("signups");

  const { data: overview } = useQuery({
    queryKey: ["metrics", "overview"],
    queryFn: () => api.get<AdminOverview>("/admin/metrics/overview", { range: 30 }),
  });

  const { data: series } = useQuery({
    queryKey: ["metrics", "timeseries", metric],
    queryFn: () =>
      api.get<AdminTimeseriesPoint[]>("/admin/metrics/timeseries", {
        metric,
        range: 30,
      }),
  });

  const { data: funnel } = useQuery({
    queryKey: ["metrics", "funnel"],
    queryFn: () => api.get<AdminFunnel>("/admin/metrics/funnel"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>

      <StatRowGroup>
        <Stat label="Total users" value={overview?.totalUsers} />
        <Stat label="New (30d)" value={overview?.newUsersInRange} />
        <Stat label="Active subs" value={overview?.activeSubscriptions} />
        <Stat
          label="Pending reports"
          value={overview?.pendingReports}
          tone="danger"
        />
        <Stat
          label="Verification rate"
          value={
            overview
              ? `${overview.profileCompleteUsers === 0 ? 0 : Math.round((overview.verifiedUsers / overview.profileCompleteUsers) * 100)}%`
              : undefined
          }
        />
        <Stat
          label="Active devices (24h)"
          value={overview?.activeDevices24h}
          hint="Not DAU — see docs"
        />
        <Stat label="Logins (30d)" value={overview?.loginsInRange} />
        <Stat
          label="Est. MRR"
          value={overview ? formatPaise(overview.estimatedMrrPaise) : undefined}
          hint="Estimated, not collected"
        />
      </StatRowGroup>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {METRIC_OPTIONS.find((m) => m.value === metric)?.label} — last 30 days
            </h2>
            <Select value={metric} onValueChange={(v) => setMetric(v as TimeseriesMetric)}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {series ? (
            <TimeseriesChart data={series} />
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Funnel
          </h2>
          {funnel ? (
            <FunnelBars funnel={funnel} />
          ) : (
            <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
