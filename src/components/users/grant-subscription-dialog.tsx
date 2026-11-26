"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { AdminCurrentSubscription, AdminPlan } from "@/lib/types";

const CYCLES = [
  { value: "3_month", label: "3 months" },
  { value: "6_month", label: "6 months" },
  { value: "12_month", label: "12 months" },
] as const;

interface GrantSubscriptionDialogProps {
  userId: string;
  userName: string | null;
  open: boolean;
  currentSubscription: AdminCurrentSubscription | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Payment-error recovery: activates the user on any active plan with no
 * charge. The server stacks the term on top of any time they still have and
 * writes an audit entry; the reason is required.
 */
export function GrantSubscriptionDialog({
  userId,
  userName,
  open,
  currentSubscription,
  onOpenChange,
}: GrantSubscriptionDialogProps) {
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("3_month");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<AdminPlan[]>("/admin/plans"),
    enabled: open,
  });
  const activePlans = (plans ?? []).filter((p) => p.active);
  const selectedPlanId = planId || activePlans[0]?.id || "";

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/users/${userId}/subscription/grant`, {
        planId: selectedPlanId,
        billingCycle,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success("Subscription granted");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setReason("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Grant failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant subscription to {userName ?? "this user"}</DialogTitle>
          <DialogDescription>
            Activates the user without a payment. If they still have time left, the new
            term is added after it.
            {currentSubscription &&
              ` Current: ${currentSubscription.planName} (${currentSubscription.status}), expires ${formatDate(currentSubscription.expiryDate)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={selectedPlanId} onValueChange={(v) => setPlanId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {activePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v ?? "3_month")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CYCLES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grant-reason">Reason (required, shown in the audit log)</Label>
            <Textarea
              id="grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Razorpay charged the user but the webhook failed — payment id pay_xxx"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedPlanId || reason.trim().length < 3 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Grant subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
