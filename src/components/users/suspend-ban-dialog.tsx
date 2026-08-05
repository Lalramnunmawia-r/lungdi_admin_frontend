"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

type Action = "suspend" | "ban";

interface SuspendBanDialogProps {
  userId: string;
  userName: string | null;
  action: Action | null;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const DURATIONS = [
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
  { label: "Indefinite", hours: null },
] as const;

/**
 * Shared by the Moderation and Users screens — both take a suspend/ban
 * action against the same two endpoints, and a typed reason is REQUIRED
 * server-side (AdminActionReasonDto), so this is the one place that enforces
 * it in the UI too rather than duplicating the form twice.
 */
export function SuspendBanDialog({
  userId,
  userName,
  action,
  onOpenChange,
  onDone,
}: SuspendBanDialogProps) {
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState<number | null>(24 * 7);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === "suspend") {
        const until = durationHours
          ? new Date(Date.now() + durationHours * 3600_000).toISOString()
          : undefined;
        return api.post(`/admin/users/${userId}/suspend`, { reason, until });
      }
      return api.post(`/admin/users/${userId}/ban`, { reason });
    },
    onSuccess: () => {
      toast.success(action === "suspend" ? "User suspended" : "User banned");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      setReason("");
      onOpenChange(false);
      onDone?.();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Action failed");
    },
  });

  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "suspend" ? "Suspend" : "Ban"} {userName ?? "this user"}
          </DialogTitle>
          <DialogDescription>
            {action === "suspend"
              ? "The account is force-logged-out immediately and cannot log back in until the suspension is lifted or an admin reinstates it."
              : "The account is force-logged-out immediately and permanently blocked. This can be reversed later via Reinstate."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {action === "suspend" && (
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select
                value={String(durationHours)}
                onValueChange={(v) => setDurationHours(v === "null" ? null : Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.label} value={String(d.hours)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (required, shown in the audit log)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={200}
              rows={3}
              autoFocus
              placeholder="Confirmed fake profile — reused photos from a public Instagram account"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {action === "suspend" ? "Suspend" : "Ban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
