"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AdminCall,
  AdminCallDetail,
  AdminCallSignal,
  AdminCallTopCaller,
  AdminCallsBreakdown,
  AdminCallsListResponse,
  AdminCallsOverview,
  AdminCallsPoint,
  CallState,
  CallTimeseriesMetric,
} from "@/lib/types";
import { Stat, StatRowGroup } from "@/components/stat-row";
import { TimeseriesChart } from "@/components/dashboard/timeseries-chart";
import { Panel, ShareBars } from "@/components/dashboard/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { UserDrawer } from "@/components/users/user-drawer";
import { formatBytes, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const METRIC_OPTIONS: {
  value: CallTimeseriesMetric;
  label: string;
  format: (v: number) => string;
}[] = [
  { value: "calls", label: "Call attempts", format: (v) => v.toLocaleString() },
  { value: "connected", label: "Connected calls", format: (v) => v.toLocaleString() },
  { value: "failed", label: "Failed calls", format: (v) => v.toLocaleString() },
  { value: "minutes", label: "Call minutes", format: (v) => `${Math.round(v)}m` },
  { value: "relay_pct", label: "TURN relay share", format: (v) => `${Math.round(v)}%` },
  { value: "avg_rtt", label: "Avg round-trip", format: (v) => `${Math.round(v)} ms` },
  { value: "turn_gb", label: "TURN egress", format: (v) => `${v.toFixed(1)} GB` },
];

const STATE_DOT: Record<CallState, string> = {
  ringing: "bg-status-info",
  accepted: "bg-status-info",
  connected: "bg-status-active",
  ended: "bg-status-neutral",
  rejected: "bg-status-pending",
  missed: "bg-status-pending",
  cancelled: "bg-status-neutral",
  failed: "bg-status-danger",
};

const SIGNAL_STYLE: Record<AdminCallSignal["level"], string> = {
  ok: "border-status-active/40",
  info: "border-status-info/40",
  warning: "border-status-pending/60",
  critical: "border-status-danger/70",
};
const SIGNAL_DOT: Record<AdminCallSignal["level"], string> = {
  ok: "bg-status-active",
  info: "bg-status-info",
  warning: "bg-status-pending",
  critical: "bg-status-danger",
};

const CONNECTION_LABEL: Record<string, string> = {
  direct_host: "Direct (same network)",
  direct_srflx: "Direct (via STUN)",
  relay: "TURN relay",
  unknown: "Never connected",
};

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v}%`;
const ms = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v} ms`;

function formatSeconds(s: number | null): string {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function StateLabel({ state, endReason }: { state: CallState; endReason: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-1.5 rounded-full", STATE_DOT[state])} />
      <span className="capitalize">{state}</span>
      {endReason && endReason !== state && (
        <span className="text-xs text-muted-foreground">· {endReason.replace(/_/g, " ")}</span>
      )}
    </span>
  );
}

function TurnUsageCard({ turn }: { turn: AdminCallsOverview["turn"] }) {
  const projectedPct =
    turn.freeTierGb > 0 ? (100 * turn.projectedMonthEgressGb) / turn.freeTierGb : 0;
  const danger = projectedPct >= 80;
  return (
    <Panel title="Cloudflare TURN — this month">
      {!turn.usageSyncEnabled ? (
        <p className="text-sm text-muted-foreground">
          Usage sync is not configured. Set <code>CLOUDFLARE_ACCOUNT_ID</code> and{" "}
          <code>CLOUDFLARE_ANALYTICS_API_TOKEN</code> on the backend.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl tabular-nums">
              {turn.monthEgressGb.toLocaleString()} GB
            </span>
            <span className="text-xs text-muted-foreground">
              of {turn.freeTierGb.toLocaleString()} GB free
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-muted">
            <div
              className="absolute h-2 rounded-full"
              style={{
                width: `${Math.min(100, turn.freeTierUsedPct)}%`,
                background: danger ? "var(--status-danger)" : "var(--chart-1)",
              }}
            />
            {/* Projected month-end marker */}
            <div
              className="absolute -top-1 h-4 w-px bg-foreground/60"
              style={{ left: `${Math.min(100, projectedPct)}%` }}
              title="Projected by month end"
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Projected month end</dt>
            <dd className={cn("text-right font-mono tabular-nums", danger && "text-status-danger")}>
              {turn.projectedMonthEgressGb.toLocaleString()} GB
            </dd>
            <dt className="text-muted-foreground">Est. overage cost</dt>
            <dd className="text-right font-mono tabular-nums">
              ${turn.estimatedMonthCostUsd.toFixed(2)}
            </dd>
            <dt className="text-muted-foreground">Price after free tier</dt>
            <dd className="text-right font-mono tabular-nums">${turn.pricePerGbUsd}/GB</dd>
            <dt className="text-muted-foreground">Last synced</dt>
            <dd className="text-right">{formatRelative(turn.lastSyncedAt)}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Only relayed calls use TURN. Cloudflare bills egress; STUN is free.
          </p>
        </div>
      )}
    </Panel>
  );
}

function CallDetailSheet({ callId, onClose }: { callId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["calls", "detail", callId],
    queryFn: () => api.get<AdminCallDetail>(`/admin/calls/${callId}`),
    enabled: !!callId,
  });

  return (
    <Sheet open={!!callId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Call detail</SheetTitle>
        </SheetHeader>
        {isLoading && <p className="px-4 text-sm text-muted-foreground">Loading…</p>}
        {data && (
          <div className="space-y-4 px-4 pb-6">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Caller</dt>
              <dd>{data.call.callerName ?? "Unnamed"}</dd>
              <dt className="text-muted-foreground">Callee</dt>
              <dd>{data.call.calleeName ?? "Unnamed"}</dd>
              <dt className="text-muted-foreground">State</dt>
              <dd><StateLabel state={data.call.state} endReason={data.call.endReason} /></dd>
              <dt className="text-muted-foreground">Started</dt>
              <dd>{formatDate(data.call.createdAt)}</dd>
              <dt className="text-muted-foreground">Duration</dt>
              <dd>{formatSeconds(data.call.durationSeconds)}</dd>
            </dl>

            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Quality reports
            </h3>
            {data.reports.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No client reported stats for this call.
              </p>
            )}
            {data.reports.map((report) => (
              <div key={report.userId} className="rounded-md border border-border p-3">
                <p className="mb-2 text-sm font-medium">
                  {report.userId === data.call.callerId ? "Caller" : "Callee"} ·{" "}
                  {CONNECTION_LABEL[report.connectionType] ?? report.connectionType}
                  {report.relayProtocol && ` (${report.relayProtocol})`}
                </p>
                <dl className="grid grid-cols-2 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Network</dt>
                  <dd className="capitalize">{report.networkType}</dd>
                  <dt className="text-muted-foreground">Round-trip</dt>
                  <dd>{ms(report.avgRttMs)}</dd>
                  <dt className="text-muted-foreground">Packet loss</dt>
                  <dd>{pct(report.packetLossPct)}</dd>
                  <dt className="text-muted-foreground">Bitrate</dt>
                  <dd>{report.avgBitrateKbps === null ? "—" : `${report.avgBitrateKbps} kbps`}</dd>
                  <dt className="text-muted-foreground">Frame rate</dt>
                  <dd>{report.avgFrameRate === null ? "—" : `${report.avgFrameRate} fps`}</dd>
                  <dt className="text-muted-foreground">Freezes</dt>
                  <dd>{report.freezeCount ?? "—"}</dd>
                  <dt className="text-muted-foreground">Setup time</dt>
                  <dd>{ms(report.iceSetupMs)}</dd>
                  <dt className="text-muted-foreground">Sent / received</dt>
                  <dd>{formatBytes(report.bytesSent)} / {formatBytes(report.bytesReceived)}</dd>
                  <dt className="text-muted-foreground">App / OS</dt>
                  <dd>{report.appVersion ?? "—"} · {report.osVersion ?? "—"}</dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function VideoCallsPage() {
  const [rangeDays, setRangeDays] = useState("30");
  const [metric, setMetric] = useState<CallTimeseriesMetric>("calls");
  const [state, setState] = useState("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const range = Number(rangeDays);

  const { data: overview } = useQuery({
    queryKey: ["calls", "overview", range],
    queryFn: () => api.get<AdminCallsOverview>("/admin/calls/overview", { range }),
    refetchInterval: 60_000,
  });
  const { data: series } = useQuery({
    queryKey: ["calls", "timeseries", metric, range],
    queryFn: () =>
      api.get<AdminCallsPoint[]>("/admin/calls/timeseries", { metric, range }),
  });
  const { data: breakdown } = useQuery({
    queryKey: ["calls", "breakdown", range],
    queryFn: () => api.get<AdminCallsBreakdown>("/admin/calls/breakdown", { range }),
  });
  const { data: topCallers } = useQuery({
    queryKey: ["calls", "top-callers", range],
    queryFn: () => api.get<AdminCallTopCaller[]>("/admin/calls/top-callers", { range }),
  });
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["calls", "list", { state, cursor }],
    queryFn: () =>
      api.get<AdminCallsListResponse>("/admin/calls", {
        state: state === "all" ? undefined : state,
        cursor,
      }),
  });

  const metricOption = METRIC_OPTIONS.find((m) => m.value === metric)!;

  // Connection mix: collapse network type so the bars answer "direct or relay?"
  const connectionMix = breakdown
    ? Object.entries(
        breakdown.connectionTypes.reduce<Record<string, number>>((acc, row) => {
          acc[row.connectionType] = (acc[row.connectionType] ?? 0) + row.count;
          return acc;
        }, {}),
      ).map(([type, value]) => ({ label: CONNECTION_LABEL[type] ?? type, value }))
    : [];
  const relayByNetwork = breakdown
    ? (["wifi", "cellular", "unknown"] as const)
        .map((network) => {
          const rows = breakdown.connectionTypes.filter((r) => r.networkType === network);
          const total = rows.reduce((s, r) => s + r.count, 0);
          const relay = rows
            .filter((r) => r.connectionType === "relay")
            .reduce((s, r) => s + r.count, 0);
          return { network, total, relayPct: total ? Math.round((100 * relay) / total) : null };
        })
        .filter((r) => r.total > 0)
    : [];

  function setStateFilter(value: string) {
    setState(value);
    setCursor(undefined);
    setCursorStack([]);
  }

  const o = overview;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Video Calls</h1>
          <p className="text-sm text-muted-foreground">
            Call volume, connection health, direct vs TURN usage and relay cost.
            Media never passes through our servers. Quality figures come from
            each phone&apos;s end-of-call report.
          </p>
        </div>
        <Select value={rangeDays} onValueChange={(v) => v && setRangeDays(v)}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <StatRowGroup>
        <Stat label="Live now" value={o?.calls.liveCalls} />
        <Stat label="Attempts" value={o?.calls.attempts} hint={o ? `${o.calls.uniqueCallers} callers` : undefined} />
        <Stat label="Answer rate" value={o ? pct(o.rates.answerRatePct) : undefined} hint="Answered ÷ attempts (excl. busy)" />
        <Stat label="Connect success" value={o ? pct(o.rates.connectionSuccessPct) : undefined} hint="Connected ÷ answered" />
        <Stat label="Failed" value={o?.calls.failed} tone="danger" />
        <Stat label="Minutes" value={o ? Math.round(o.minutes.total).toLocaleString() : undefined} hint={o ? `avg ${formatSeconds(o.minutes.avgCallSeconds)}` : undefined} />
        <Stat label="Direct" value={o ? pct(o.network.directPct) : undefined} hint="Peer-to-peer, free" />
        <Stat label="Via TURN" value={o ? pct(o.network.relayPct) : undefined} hint={o ? `of ${o.network.reportedCalls} reported` : undefined} />
        <Stat label="RTT avg / p95" value={o ? `${o.network.avgRttMs ?? "—"} / ${o.network.p95RttMs ?? "—"}` : undefined} hint="ms" />
        <Stat label="Packet loss" value={o ? pct(o.network.avgPacketLossPct) : undefined} />
      </StatRowGroup>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Scaling signals" className="lg:col-span-2">
          {!o ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {o.signals.map((signal) => (
                <li
                  key={signal.key}
                  className={cn("rounded-md border-l-2 bg-muted/30 px-3 py-2", SIGNAL_STYLE[signal.level])}
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn("size-1.5 rounded-full", SIGNAL_DOT[signal.level])} />
                    {signal.title}
                    <span className="text-xs font-normal uppercase text-muted-foreground">
                      {signal.level}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{signal.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {o ? (
          <TurnUsageCard turn={o.turn} />
        ) : (
          <Panel title="Cloudflare TURN — this month">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </Panel>
        )}
      </div>

      <Panel
        title={`${metricOption.label} — ${RANGE_OPTIONS.find((r) => r.value === rangeDays)?.label.toLowerCase()}`}
        action={
          <Select value={metric} onValueChange={(v) => v && setMetric(v as CallTimeseriesMetric)}>
            <SelectTrigger size="sm" className="w-44">
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
        }
      >
        {series ? (
          <TimeseriesChart
            data={series.map((p) => ({ date: p.date, count: p.value }))}
            formatValue={metricOption.format}
            yAxisWidth={56}
          />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="How calls connected">
          <ShareBars rows={connectionMix} />
          {relayByNetwork.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              TURN share by network:{" "}
              {relayByNetwork
                .map((r) => `${r.network} ${r.relayPct ?? 0}%`)
                .join(" · ")}
            </p>
          )}
        </Panel>
        <Panel title="How calls ended">
          <ShareBars
            rows={(breakdown?.endReasons ?? []).map((r) => ({
              label: `${r.state}${r.endReason && r.endReason !== r.state ? ` · ${r.endReason.replace(/_/g, " ")}` : ""}`,
              value: r.count,
            }))}
          />
        </Panel>
        <Panel title="Quality by app version">
          {breakdown && breakdown.appVersions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Reports</TableHead>
                  <TableHead className="text-right">TURN</TableHead>
                  <TableHead className="text-right">RTT</TableHead>
                  <TableHead className="text-right">Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.appVersions.map((v) => (
                  <TableRow key={v.appVersion}>
                    <TableCell className="font-mono text-xs">{v.appVersion}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{v.reports}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{v.relayPct}%</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {v.avgRttMs === null ? "—" : Math.round(v.avgRttMs)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {v.avgPacketLossPct === null ? "—" : `${v.avgPacketLossPct.toFixed(1)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No quality reports in this range yet.</p>
          )}
        </Panel>
      </div>

      <Panel title="Top callers (abuse & cost check)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Connected</TableHead>
              <TableHead className="text-right">Rejected / missed</TableHead>
              <TableHead className="text-right">Minutes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topCallers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No calls in this range.
                </TableCell>
              </TableRow>
            )}
            {topCallers?.map((c: AdminCallTopCaller) => (
              <TableRow key={c.userId} className="cursor-pointer" onClick={() => setDrawerUserId(c.userId)}>
                <TableCell className="font-medium">{c.name ?? "Unnamed"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{c.attempts}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{c.connected}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums",
                    c.attempts >= 10 && c.rejectedOrMissed / c.attempts > 0.8 && "text-status-danger",
                  )}
                >
                  {c.rejectedOrMissed}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {Math.round(c.totalSeconds / 60)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Call log
          </h2>
          <Select value={state} onValueChange={(v) => v && setStateFilter(v)}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {(Object.keys(STATE_DOT) as CallState[]).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Caller → Callee</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!listLoading && list?.calls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No calls match.
                  </TableCell>
                </TableRow>
              )}
              {list?.calls.map((call: AdminCall) => (
                <TableRow key={call.id} className="cursor-pointer" onClick={() => setDetailId(call.id)}>
                  <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                    {formatDate(call.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {call.callerName ?? "Unnamed"} → {call.calleeName ?? "Unnamed"}
                  </TableCell>
                  <TableCell>
                    <StateLabel state={call.state} endReason={call.endReason} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {call.relayed === null ? "—" : call.relayed ? "TURN relay" : "Direct"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatSeconds(call.durationSeconds)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cursorStack.length === 0}
            onClick={() => {
              const prev = cursorStack[cursorStack.length - 1];
              setCursorStack((s) => s.slice(0, -1));
              setCursor(prev);
            }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!list?.nextCursor}
            onClick={() => {
              if (!list?.nextCursor) return;
              setCursorStack((s) => [...s, cursor]);
              setCursor(list.nextCursor);
            }}
          >
            Next
          </Button>
        </div>
      </div>

      <CallDetailSheet callId={detailId} onClose={() => setDetailId(null)} />
      <UserDrawer
        userId={drawerUserId}
        onOpenChange={(open) => {
          if (!open) setDrawerUserId(null);
        }}
      />
    </div>
  );
}
