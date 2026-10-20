"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminPaymentsListResponse } from "@/lib/types";
import { PaymentStatusPill } from "@/components/status-pill";
import { formatAmount, formatDate } from "@/lib/format";

const SHOWN = 8;

/** One user's payment history inside the user drawer — newest first, with failure reasons. */
export function UserPayments({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["payments", "user", userId],
    queryFn: () =>
      api.get<AdminPaymentsListResponse>("/admin/payments", { userId }),
  });

  const payments = data?.payments ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Payments
        </p>
        {(data?.nextCursor || payments.length > SHOWN) && (
          <Link
            href={`/payments?userId=${userId}`}
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && payments.length === 0 && (
        <p className="text-sm text-muted-foreground">No payments recorded.</p>
      )}

      {payments.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {payments.slice(0, SHOWN).map((payment) => (
            <li key={payment.id} className="space-y-0.5 p-3">
              <div className="flex items-center justify-between gap-3">
                <PaymentStatusPill status={payment.status} />
                <span className="font-mono tabular-nums">
                  {formatAmount(payment.amount, payment.currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{formatDate(payment.occurredAt)}</span>
                {" · "}
                <span className="capitalize">{payment.provider}</span>
                {payment.environment === "Sandbox" && " (sandbox)"}
              </p>
              {payment.failureReason && (
                <p className="text-xs text-status-danger">
                  {payment.failureCode ? `${payment.failureCode}: ` : ""}
                  {payment.failureReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
