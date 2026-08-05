"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Check, Loader2, ShieldOff, UserX } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { AdminReportDetail, AdminReportListResponse } from "@/lib/types";
import { ReportStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelative } from "@/lib/format";
import { SuspendBanDialog } from "@/components/users/suspend-ban-dialog";
import { cn } from "@/lib/utils";

export default function ModerationPage() {
  const [status, setStatus] = useState<string>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<"suspend" | "ban" | null>(null);
  const queryClient = useQueryClient();

  const { data: queue, isLoading } = useQuery({
    queryKey: ["reports", { status }],
    queryFn: () =>
      api.get<AdminReportListResponse>("/admin/reports", { status }),
  });

  // Memoized so a fresh [] on every render (when queue is still undefined)
  // doesn't change identity every render and cascade into the useMemo below.
  const reports = useMemo(() => queue?.reports ?? [], [queue]);

  // Derived, not synced via an effect: "nothing explicitly selected yet"
  // just falls back to the first row on every render. selectedId only ever
  // holds an explicit user choice (a click, j/k, or the auto-advance after
  // an action) — there is no separate "sync it to the first item" state to
  // keep consistent, so there's nothing for an effect to do here.
  const effectiveSelectedId = selectedId ?? reports[0]?.id ?? null;

  const { data: detail } = useQuery({
    queryKey: ["reports", "detail", effectiveSelectedId],
    queryFn: () => api.get<AdminReportDetail>(`/admin/reports/${effectiveSelectedId}`),
    enabled: !!effectiveSelectedId,
  });

  const reviewMutation = useMutation({
    mutationFn: (args: { status: string; resolutionNote?: string }) =>
      api.patch(`/admin/reports/${effectiveSelectedId}`, args),
    onSuccess: () => {
      toast.success("Report updated");
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      selectNext();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    },
  });

  function selectNext() {
    const idx = reports.findIndex((r) => r.id === effectiveSelectedId);
    const next = reports[idx + 1] ?? reports[idx - 1] ?? null;
    setSelectedId(next?.id ?? null);
  }

  function moveSelection(delta: 1 | -1) {
    const idx = reports.findIndex((r) => r.id === effectiveSelectedId);
    const next = reports[idx + delta];
    if (next) setSelectedId(next.id);
  }

  // J/K navigate, D dismisses the selected report — matches the plan's
  // "throughput matters more than any visual choice" call for this screen.
  // Ban (B) opens the confirm dialog rather than firing immediately: it's
  // irreversible-feeling enough (and requires a typed reason server-side
  // anyway) that a bare keystroke shouldn't fire it directly.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "j") moveSelection(1);
      else if (e.key === "k") moveSelection(-1);
      else if (e.key === "d" && effectiveSelectedId)
        reviewMutation.mutate({ status: "dismissed" });
      else if (e.key === "b" && effectiveSelectedId) setDialogAction("ban");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSelectedId, reports]);

  const selected = useMemo(
    () => reports.find((r) => r.id === effectiveSelectedId) ?? null,
    [reports, effectiveSelectedId],
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left pane: queue */}
      <div className="flex w-80 shrink-0 flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="action_taken">Action taken</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          )}
          {!isLoading && reports.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No reports here.</p>
          )}
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "flex w-full items-center gap-2 border-b border-border/50 px-3 py-2.5 text-left text-sm hover:bg-accent",
                effectiveSelectedId === r.id && "bg-primary/10",
              )}
            >
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={r.reportedProfilePictureSmallUrl ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(r.reportedName ?? "?")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.reportedName ?? "Unknown"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.reason.replace(/_/g, " ")} · {formatRelative(r.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-2 text-center text-xs text-muted-foreground">
          J/K to navigate · D to dismiss · B to ban
        </div>
      </div>

      {/* Right pane: detail */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card">
        {!selected && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a report
          </div>
        )}
        {selected && detail && (
          <div className="space-y-6 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold capitalize">
                  {detail.reason.replace(/_/g, " ")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Reported {formatRelative(detail.createdAt)}
                </p>
              </div>
              <ReportStatusPill status={detail.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reporter
                </p>
                <p className="font-medium">{detail.reporterName ?? "Unknown"}</p>
              </div>
              <div className="rounded-md border border-status-danger/30 bg-status-danger/5 p-3">
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reported user{" "}
                  {detail.reportsAgainstCount > 1 && (
                    <span className="text-status-danger">
                      · {detail.reportsAgainstCount} reports total
                    </span>
                  )}
                </p>
                <p className="font-medium">{detail.reportedName ?? "Unknown"}</p>
              </div>
            </div>

            {detail.details && (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reporter&apos;s details
                </p>
                <p className="text-sm">{detail.details}</p>
              </div>
            )}

            {detail.conversationId && (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                This report references a conversation, but its content is
                unavailable — chat is end-to-end encrypted and the server
                holds no key that can read it.
              </div>
            )}

            {detail.resolutionNote && (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Resolution note
                </p>
                <p className="text-sm">{detail.resolutionNote}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ status: "dismissed" })}
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Dismiss
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({ status: "reviewed" })
                }
              >
                <ShieldOff className="size-4" />
                Mark reviewed
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-status-pending/40 text-status-pending hover:bg-status-pending/10"
                onClick={() => setDialogAction("suspend")}
              >
                <UserX className="size-4" />
                Suspend user
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDialogAction("ban")}
              >
                <Ban className="size-4" />
                Ban user
              </Button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <SuspendBanDialog
          userId={selected.reportedId}
          userName={selected.reportedName}
          action={dialogAction}
          onOpenChange={(open) => !open && setDialogAction(null)}
          onDone={() => {
            reviewMutation.mutate({
              status: "action_taken",
              resolutionNote: `${dialogAction === "ban" ? "Banned" : "Suspended"} via moderation queue`,
            });
          }}
        />
      )}
    </div>
  );
}
