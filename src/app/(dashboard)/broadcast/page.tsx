"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { AccountStatus, AdminBroadcastResult, VerificationStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccountStatusPill, VerificationStatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACCOUNT_STATUSES: AccountStatus[] = [
  "active",
  "deactivated",
  "suspended",
  "banned",
  "deleted",
];
const VERIFICATION_STATUSES: VerificationStatus[] = [
  "not_started",
  "processing",
  "verified",
  "failed",
];

function Toggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {label.replace(/_/g, " ")}
    </button>
  );
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FieldCount({ length, max }: { length: number; max: number }) {
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        length >= max ? "text-status-pending" : "text-muted-foreground",
      )}
    >
      {length}/{max}
    </span>
  );
}

export default function BroadcastPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<AccountStatus[]>([]);
  const [verification, setVerification] = useState<VerificationStatus[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const filter = { status: status.length ? status : undefined, verification: verification.length ? verification : undefined };
  const noFilters = status.length === 0 && verification.length === 0;

  // Keyed on `filter`, so changing any toggle after a preview points this at
  // a cache entry that's never been fetched — `audience` drops back to
  // undefined on its own, no manual staleness tracking needed. That's also
  // why "Send" can safely gate on `audience !== undefined`: it can only be
  // true for the filter combination currently selected.
  const { data: audience, isFetching: isCounting, refetch } = useQuery({
    queryKey: ["broadcast", "audience-count", filter],
    queryFn: () => api.get<{ count: number }>("/admin/broadcast/audience-count", filter),
    enabled: false,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      api.post<AdminBroadcastResult>("/admin/broadcast", { title, body, ...filter }),
    onSuccess: (result) => {
      toast.success(`Sent to ${result.audienceSize} user${result.audienceSize === 1 ? "" : "s"}`);
      void queryClient.invalidateQueries({ queryKey: ["broadcast"] });
      setTitle("");
      setBody("");
      setStatus([]);
      setVerification([]);
      setConfirmOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Send failed");
      setConfirmOpen(false);
    },
  });

  const hasContent = title.trim().length > 0 && body.trim().length > 0;
  const canSend = hasContent && audience !== undefined;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Broadcast</h1>
        <p className="text-sm text-muted-foreground">
          Send a push + in-app announcement to users matching a filter
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_20rem] lg:items-start">
        <div className="space-y-6">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="broadcast-title">Title</Label>
                <FieldCount length={title.length} max={100} />
              </div>
              <Input
                id="broadcast-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Weekend feature: video messages"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="broadcast-body">Body</Label>
                <FieldCount length={body.length} max={500} />
              </div>
              <Textarea
                id="broadcast-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="You can now send short videos in chat — try it out this weekend."
              />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Account status
                </p>
                <p
                  className={cn(
                    "text-xs",
                    status.length === 0 ? "text-status-pending" : "text-muted-foreground",
                  )}
                >
                  {status.length === 0 ? "Every status" : `${status.length} selected`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ACCOUNT_STATUSES.map((s) => (
                  <Toggle
                    key={s}
                    label={s}
                    active={status.includes(s)}
                    onClick={() => setStatus((prev) => toggleValue(prev, s))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Verification
                </p>
                <p
                  className={cn(
                    "text-xs",
                    verification.length === 0 ? "text-status-pending" : "text-muted-foreground",
                  )}
                >
                  {verification.length === 0 ? "Every status" : `${verification.length} selected`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {VERIFICATION_STATUSES.map((v) => (
                  <Toggle
                    key={v}
                    label={v}
                    active={verification.includes(v)}
                    onClick={() => setVerification((prev) => toggleValue(prev, v))}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              Send
            </Button>
            {hasContent && audience === undefined && (
              <p className="mt-2 text-xs text-muted-foreground">
                Preview the audience before sending.
              </p>
            )}
          </div>
        </div>

        {/* Right rail: what recipients see, and who they are. Sticky so it
            stays in view while filters are being tweaked further down. */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Preview
            </p>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-sm font-semibold text-primary">
                L
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {title || <span className="text-muted-foreground">Notification title</span>}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {body || "Notification body will appear here."}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">now</span>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Audience
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void refetch()}
                disabled={isCounting}
              >
                {isCounting && <Loader2 className="size-4 animate-spin" />}
                Preview
              </Button>
            </div>

            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Matches
              </p>
              {audience === undefined ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {isCounting ? "Checking…" : "Not checked yet"}
                </p>
              ) : (
                <p className="font-mono text-lg tabular-nums">{audience.count}</p>
              )}
            </div>

            {noFilters && (
              <p className="text-xs text-status-pending">
                No filters set — this reaches every account.
              </p>
            )}

            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Will reach</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {status.length === 0 ? (
                  <span className="text-xs text-muted-foreground">All account statuses</span>
                ) : (
                  status.map((s) => <AccountStatusPill key={s} status={s} />)
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {verification.length === 0 ? (
                  <span className="text-xs text-muted-foreground">All verification states</span>
                ) : (
                  verification.map((v) => <VerificationStatusPill key={v} status={v} />)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this broadcast?</DialogTitle>
            <DialogDescription>
              This sends a push notification and an in-app announcement immediately —
              it cannot be recalled once sent.
              {audience !== undefined && (
                <>
                  {" "}
                  Last counted audience:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {audience.count}
                  </span>{" "}
                  user{audience.count === 1 ? "" : "s"}. The actual send re-evaluates the
                  filter at send time, so the count could differ slightly.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-muted-foreground">{body}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              {sendMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
