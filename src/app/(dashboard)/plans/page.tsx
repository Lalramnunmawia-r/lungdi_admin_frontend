"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AdminPlan } from "@/lib/types";
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
import { PlanSheet } from "@/components/plans/plan-sheet";
import { PaymentProvidersCard } from "@/components/plans/payment-providers-card";

export default function PlansPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AdminPlan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<AdminPlan[]>("/admin/plans"),
  });

  function openCreate() {
    setSelectedPlan(null);
    setSheetOpen(true);
  }

  function openEdit(plan: AdminPlan) {
    setSelectedPlan(plan);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Plans</h1>
          <p className="text-sm text-muted-foreground">Pricing and provider identifiers</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          New plan
        </Button>
      </div>

      <PaymentProvidersCard />

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>3-month</TableHead>
              <TableHead>6-month</TableHead>
              <TableHead>12-month</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && plans?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No plans yet.
                </TableCell>
              </TableRow>
            )}
            {plans?.map((plan) => (
              <TableRow
                key={plan.id}
                className="cursor-pointer"
                onClick={() => openEdit(plan)}
              >
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatPaise(plan.price3Month)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatPaise(plan.price6Month)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatPaise(plan.price12Month)}
                </TableCell>
                <TableCell className="font-mono">{plan.currency}</TableCell>
                <TableCell>
                  <StatusDot
                    dotClassName={plan.active ? "bg-status-active" : "bg-status-neutral"}
                    label={plan.active ? "active" : "inactive"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PlanSheet plan={selectedPlan} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
