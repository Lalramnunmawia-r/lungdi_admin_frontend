"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminIapProduct, AdminPlan } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/status-pill";
import { formatPaise } from "@/lib/format";
import { IapProductSheet } from "@/components/plans/iap-product-sheet";
import { CYCLE_LABELS } from "@/components/plans/cycles";

export function IapProductsTab({ plans }: { plans: AdminPlan[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<AdminIapProduct | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["iap-products"],
    queryFn: () => api.get<AdminIapProduct[]>("/admin/iap-products"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Apple in-app subscription products (iOS). Product IDs must match App
          Store Connect. One active product per plan and cycle.
        </p>
        <Button
          size="sm"
          disabled={plans.length === 0}
          onClick={() => {
            setSelected(null);
            setSheetOpen(true);
          }}
        >
          New IAP product
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Apple product ID</TableHead>
              <TableHead>Display price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No IAP products yet.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(row);
                  setSheetOpen(true);
                }}
              >
                <TableCell className="font-medium">{row.planName}</TableCell>
                <TableCell>{CYCLE_LABELS[row.billingCycle]}</TableCell>
                <TableCell className="font-mono text-xs">{row.appleProductId}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatPaise(row.price, row.currency)}
                </TableCell>
                <TableCell>
                  <StatusDot
                    dotClassName={row.active ? "bg-status-active" : "bg-status-neutral"}
                    label={row.active ? "active" : "inactive"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <IapProductSheet
        row={selected}
        plans={plans}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
