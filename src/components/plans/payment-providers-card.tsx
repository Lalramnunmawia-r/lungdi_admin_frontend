"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { AdminPaymentProviderSetting } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LABELS: Record<AdminPaymentProviderSetting["provider"], string> = {
  razorpay: "Razorpay (Android / Web)",
  apple: "Apple IAP (iOS)",
};

const CONFIRM_WORD = "CONFIRM";

/**
 * Global maintenance kill-switch, not a per-plan setting — sits above the
 * Plans table on purpose. Toggling a provider off only blocks NEW
 * subscriptions (POST /subscriptions/subscribe or /subscriptions/apple/sync);
 * existing subscribers keep renewing through the provider's webhook either way.
 *
 * Turning OFF is gated behind a type-to-confirm dialog — it's the direction
 * that immediately blocks real payments. Turning back ON is a plain click:
 * that direction is low-risk and shouldn't need friction.
 */
export function PaymentProvidersCard() {
  const queryClient = useQueryClient();
  const [pendingDisable, setPendingDisable] =
    useState<AdminPaymentProviderSetting["provider"] | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: () =>
      api.get<AdminPaymentProviderSetting[]>("/admin/payment-settings"),
  });

  const mutation = useMutation({
    mutationFn: ({
      provider,
      enabled,
    }: {
      provider: AdminPaymentProviderSetting["provider"];
      enabled: boolean;
    }) => api.patch(`/admin/payment-settings/${provider}`, { enabled }),
    onSuccess: () => {
      toast.success("Payment provider updated");
      void queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
      setPendingDisable(null);
      setConfirmText("");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    },
  });

  function handleToggle(
    provider: AdminPaymentProviderSetting["provider"],
    enabled: boolean,
  ) {
    if (enabled) {
      mutation.mutate({ provider, enabled: true });
    } else {
      setConfirmText("");
      setPendingDisable(provider);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Payment providers
        </p>
        <p className="text-xs text-muted-foreground">
          Turning a provider off only blocks new subscriptions — existing
          subscribers keep renewing normally.
        </p>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {settings?.map((setting) => {
          // Scoped to THIS provider — toggling Razorpay must not disable or
          // spin the Apple switch, since the two mutations are independent.
          const isPending =
            mutation.isPending &&
            mutation.variables?.provider === setting.provider;
          return (
            <label
              key={setting.provider}
              className="flex items-center gap-2.5 text-sm"
            >
              <Switch
                checked={setting.enabled}
                onCheckedChange={(enabled: boolean) =>
                  handleToggle(setting.provider, enabled)
                }
                disabled={isPending}
              />
              {LABELS[setting.provider]}
              {isPending && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
            </label>
          );
        })}
      </div>

      <Dialog
        open={pendingDisable !== null}
        onOpenChange={(open) => !open && setPendingDisable(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Turn off {pendingDisable ? LABELS[pendingDisable] : ""}?
            </DialogTitle>
            <DialogDescription>
              New subscriptions through this provider will be rejected
              immediately. Existing subscribers keep renewing normally — this
              does not cancel or pause anyone already subscribed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-disable">
              Type {CONFIRM_WORD} to proceed
            </Label>
            <Input
              id="confirm-disable"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder={CONFIRM_WORD}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDisable(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== CONFIRM_WORD || mutation.isPending}
              onClick={() =>
                pendingDisable &&
                mutation.mutate({ provider: pendingDisable, enabled: false })
              }
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Turn off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
