"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Loader2, LogOut, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AccountStatusPill,
  VerificationStatusPill,
} from "@/components/status-pill";
import { api, ApiError } from "@/lib/api-client";
import type { AdminUserDetail } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Stat, StatRowGroup } from "@/components/stat-row";
import { SuspendBanDialog } from "./suspend-ban-dialog";

function reasonPrompt(actionLabel: string): string | null {
  const reason = window.prompt(`Reason for ${actionLabel} (required, shown in the audit log):`);
  if (!reason || reason.trim().length < 3) return null;
  return reason.trim();
}

export function UserDrawer({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [dialogAction, setDialogAction] = useState<"suspend" | "ban" | null>(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["users", "detail", userId],
    queryFn: () => api.get<AdminUserDetail>(`/admin/users/${userId}`),
    enabled: !!userId,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  const reinstateMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post(`/admin/users/${userId}/reinstate`, { reason }),
    onSuccess: () => {
      toast.success("User reinstated");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post(`/admin/users/${userId}/sessions/revoke`, { reason }),
    onSuccess: () => toast.success("Sessions revoked"),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const resetVerificationMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post(`/admin/users/${userId}/verification/reset`, { reason }),
    onSuccess: () => {
      toast.success("Verification reset");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => {
      const reason = reasonPrompt("removing this photo");
      if (!reason) throw new Error("cancelled");
      return api.delete(`/admin/users/${userId}/photos/${photoId}`, { reason });
    },
    onSuccess: () => {
      toast.success("Photo removed");
      void queryClient.invalidateQueries({ queryKey: ["users", "detail", userId] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "cancelled") return;
      toast.error(e instanceof ApiError ? e.message : "Failed");
    },
  });

  return (
    <Sheet open={!!userId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>User detail</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {user && (
          <div className="space-y-6 px-4 pb-6">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                <AvatarImage src={user.profilePictureUrl ?? undefined} />
                <AvatarFallback>{(user.name ?? "?")[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">{user.name ?? "Unnamed"}</p>
                <div className="mt-1 flex gap-1.5">
                  <AccountStatusPill status={user.status} />
                  <VerificationStatusPill status={user.verificationStatus} />
                </div>
              </div>
            </div>

            {user.status !== "active" && user.statusReason && (
              <div className="rounded-md border border-status-pending/30 bg-status-pending/5 p-3 text-xs">
                <p className="font-medium text-status-pending">
                  {user.status}
                  {user.suspendedUntil && ` until ${formatDate(user.suspendedUntil)}`}
                </p>
                <p className="mt-1 text-muted-foreground">{user.statusReason}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Phone" value={user.phoneNumber} mono />
              <Field label="Email" value={user.email ?? "—"} />
              <Field label="Gender" value={user.gender ?? "—"} />
              <Field
                label="Date of birth"
                value={user.dateOfBirth ? formatDate(user.dateOfBirth) : "—"}
                mono
              />
              <Field label="Designation" value={user.designation ?? "—"} />
              <Field label="Joined" value={formatDate(user.createdAt)} mono />
            </div>

            {user.bio && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Bio</p>
                <p className="mt-1 text-sm">{user.bio}</p>
              </div>
            )}

            <Separator />

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Photos ({user.photos.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {user.photos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => deletePhotoMutation.mutate(photo.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Remove photo"
                    >
                      <Trash2 className="size-4 text-white" />
                    </button>
                  </div>
                ))}
                {user.photos.length === 0 && (
                  <p className="col-span-4 text-xs text-muted-foreground">No photos.</p>
                )}
              </div>
            </div>

            {user.interests.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Interests
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {user.interests.map((i) => (
                    <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Counts
              </p>
              <StatRowGroup>
                <Stat label="Connections" value={user.counts.connections} />
                <Stat label="Reports filed" value={user.counts.reportsFiled} />
                <Stat
                  label="Reports against"
                  value={user.counts.reportsAgainst}
                  tone="danger"
                />
                <Stat label="Blocks made" value={user.counts.blocksMade} />
                <Stat label="Blocks received" value={user.counts.blocksReceived} />
              </StatRowGroup>
            </div>

            {user.currentSubscription && (
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Subscription
                </p>
                <div className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{user.currentSubscription.planName}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.currentSubscription.status} · {user.currentSubscription.paymentProvider} ·
                    expires{" "}
                    <span className="font-mono">
                      {formatDate(user.currentSubscription.expiryDate)}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-2">
              {(user.status === "suspended" || user.status === "banned") ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={reinstateMutation.isPending}
                  onClick={() => {
                    const reason = reasonPrompt("reinstating this account");
                    if (reason) reinstateMutation.mutate(reason);
                  }}
                >
                  <UserCheck className="size-4" />
                  Reinstate
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-status-pending/40 text-status-pending hover:bg-status-pending/10"
                    onClick={() => setDialogAction("suspend")}
                  >
                    <UserX className="size-4" />
                    Suspend
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDialogAction("ban")}
                  >
                    <Ban className="size-4" />
                    Ban
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={revokeSessionsMutation.isPending}
                onClick={() => {
                  const reason = reasonPrompt("revoking sessions");
                  if (reason) revokeSessionsMutation.mutate(reason);
                }}
              >
                <LogOut className="size-4" />
                Revoke sessions
              </Button>
              {user.verificationStatus === "verified" && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={resetVerificationMutation.isPending}
                  onClick={() => {
                    const reason = reasonPrompt("resetting verification");
                    if (reason) resetVerificationMutation.mutate(reason);
                  }}
                >
                  <ShieldCheck className="size-4" />
                  Reset verification
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>

      {user && (
        <SuspendBanDialog
          userId={user.id}
          userName={user.name}
          action={dialogAction}
          onOpenChange={(open) => !open && setDialogAction(null)}
          onDone={invalidate}
        />
      )}
    </Sheet>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono font-medium" : "font-medium"}>{value}</p>
    </div>
  );
}
