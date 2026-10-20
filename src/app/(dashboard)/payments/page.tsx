"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api-client";
import type {
  AdminPaymentsListResponse,
  AdminPaymentsSummary,
} from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentStatusPill } from "@/components/status-pill";
import { Stat, StatRowGroup } from "@/components/stat-row";
import { UserDrawer } from "@/components/users/user-drawer";
import { formatAmount, formatDate, formatPaise } from "@/lib/format";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

const CYCLE_LABEL: Record<string, string> = {
  "3_month": "3-month",
  "6_month": "6-month",
  "12_month": "12-month",
};

/** <input type="date"> gives YYYY-MM-DD in the admin's own timezone. */
function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}
function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function PaymentsContent() {
  const router = useRouter();
  const userId = useSearchParams().get("userId") ?? undefined;

  const [rangeDays, setRangeDays] = useState("30");
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

  // A filter change must start from page one — a cursor from the old result
  // set is meaningless against the new one.
  function setFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setCursor(undefined);
      setCursorStack([]);
    };
  }

  const { data: summary } = useQuery({
    queryKey: ["payments", "summary", rangeDays],
    queryFn: () =>
      api.get<AdminPaymentsSummary>("/admin/payments/summary", {
        range: Number(rangeDays),
      }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["payments", "list", { userId, status, provider, from, to, cursor }],
    queryFn: () =>
      api.get<AdminPaymentsListResponse>("/admin/payments", {
        userId,
        status: status === "all" ? undefined : status,
        provider: provider === "all" ? undefined : provider,
        from: from ? startOfDayIso(from) : undefined,
        to: to ? endOfDayIso(to) : undefined,
        cursor,
      }),
  });

  function goNext() {
    if (!data?.nextCursor) return;
    setCursorStack((s) => [...s, cursor]);
    setCursor(data.nextCursor);
  }

  function goPrev() {
    const prev = cursorStack[cursorStack.length - 1];
    setCursorStack((s) => s.slice(0, -1));
    setCursor(prev);
  }

  // Revenue is shown per currency; INR is the real one, anything else would
  // be an Apple storefront abroad and is listed after it.
  const primary =
    summary?.revenue.find((r) => r.currency === "INR") ?? summary?.revenue[0];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Charges, failed attempts and refunds. History starts from when the
            ledger was deployed. Apple Sandbox is excluded from the figures.
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
        <Stat
          label="Net revenue"
          value={summary ? formatPaise(primary?.net ?? 0, primary?.currency ?? "INR") : undefined}
          hint="Collected minus refunds"
        />
        <Stat
          label="Collected"
          value={summary ? formatPaise(primary?.collected ?? 0, primary?.currency ?? "INR") : undefined}
        />
        <Stat
          label="Refunded"
          value={summary ? formatPaise(primary?.refunded ?? 0, primary?.currency ?? "INR") : undefined}
        />
        <Stat label="Successful" value={summary?.succeededCount} />
        <Stat label="Failed" value={summary?.failedCount} tone="danger" />
        <Stat
          label="Success rate"
          value={
            summary
              ? summary.successRate === null
                ? "—"
                : `${Math.round(summary.successRate * 100)}%`
              : undefined
          }
        />
      </StatRowGroup>

      {summary && summary.byProvider.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {summary.byProvider
            .map(
              (p) =>
                `${p.provider === "razorpay" ? "Razorpay" : "Apple"}: ${formatPaise(p.net, p.currency)} net, ${p.succeeded} paid, ${p.failed} failed`,
            )
            .join("  ·  ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(v) => v && setFilter(setStatus)(v)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={provider} onValueChange={(v) => v && setFilter(setProvider)(v)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            <SelectItem value="razorpay">Razorpay</SelectItem>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="From date"
          className="w-40"
          value={from}
          onChange={(e) => setFilter(setFrom)(e.target.value)}
        />
        <Input
          type="date"
          aria-label="To date"
          className="w-40"
          value={to}
          onChange={(e) => setFilter(setTo)(e.target.value)}
        />
        {userId && (
          <Button variant="secondary" size="sm" onClick={() => router.replace("/payments")}>
            One user only
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No payments match.
                </TableCell>
              </TableRow>
            )}
            {data?.payments.map((payment) => (
              <TableRow
                key={payment.id}
                className={payment.userId ? "cursor-pointer" : undefined}
                onClick={() => payment.userId && setDrawerUserId(payment.userId)}
              >
                <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                  {formatDate(payment.occurredAt)}
                </TableCell>
                <TableCell>
                  {payment.userId ? (
                    <>
                      <div className="font-medium">{payment.userName ?? "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{payment.userPhone}</div>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unknown user</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {payment.planName ?? "—"}
                  {payment.billingCycle && (
                    <span className="block text-xs text-muted-foreground">
                      {CYCLE_LABEL[payment.billingCycle] ?? payment.billingCycle}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {payment.provider}
                  {payment.environment === "Sandbox" && (
                    <span className="block text-xs text-muted-foreground">sandbox</span>
                  )}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatAmount(payment.amount, payment.currency)}
                </TableCell>
                <TableCell>
                  <PaymentStatusPill status={payment.status} />
                </TableCell>
                <TableCell
                  className="max-w-xs truncate text-xs text-muted-foreground"
                  title={payment.failureReason ?? payment.providerPaymentId}
                >
                  {payment.failureReason ? (
                    <>
                      {payment.failureCode && (
                        <span className="font-mono">{payment.failureCode}: </span>
                      )}
                      {payment.failureReason}
                    </>
                  ) : (
                    <span className="font-mono">{payment.providerPaymentId}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={cursorStack.length === 0} onClick={goPrev}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={!data?.nextCursor} onClick={goNext}>
          Next
        </Button>
      </div>

      <UserDrawer
        userId={drawerUserId}
        onOpenChange={(open) => {
          if (!open) setDrawerUserId(null);
        }}
      />
    </div>
  );
}

// useSearchParams() opts the page out of static prerendering unless it sits
// inside a Suspense boundary.
export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsContent />
    </Suspense>
  );
}
