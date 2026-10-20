"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import type { AdminIapProduct, AdminPlan } from "@/lib/types";
import { CYCLE_LABELS, CYCLES } from "@/components/plans/cycles";

const schema = z.object({
  planId: z.string().min(1, "Pick a plan"),
  billingCycle: z.enum(["3_month", "6_month", "12_month"]),
  appleProductId: z
    .string()
    .min(3, "Required")
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "Letters, digits, dots, hyphens and underscores only"),
  price: z.number().int().min(0),
  currency: z.string().min(1).max(3),
  active: z.enum(["true", "false"]),
});
type FormValues = z.infer<typeof schema>;

function emptyForm(plans: AdminPlan[]): FormValues {
  return {
    planId: plans[0]?.id ?? "",
    billingCycle: "3_month",
    appleProductId: "",
    price: plans[0]?.price3Month ?? 19900,
    currency: plans[0]?.currency ?? "INR",
    active: "true",
  };
}

function toForm(row: AdminIapProduct): FormValues {
  return {
    planId: row.planId,
    billingCycle: row.billingCycle,
    appleProductId: row.appleProductId,
    price: row.price,
    currency: row.currency,
    active: row.active ? "true" : "false",
  };
}

/**
 * Create: plan + cycle + Apple product ID + display price. Edit: only the
 * display price/currency and active flag — the Apple product ID is what
 * renewals are matched on, so changing it in place would orphan subscribers;
 * deactivate and add a new product instead.
 */
export function IapProductSheet({
  row,
  plans,
  open,
  onOpenChange,
}: {
  row: AdminIapProduct | null;
  plans: AdminPlan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = !!row;
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(plans),
  });

  useEffect(() => {
    if (open) form.reset(row ? toForm(row) : emptyForm(plans));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (row) {
        return api.patch(`/admin/iap-products/${row.id}`, {
          price: values.price,
          currency: values.currency,
          active: values.active === "true",
        });
      }
      return api.post("/admin/iap-products", {
        planId: values.planId,
        billingCycle: values.billingCycle,
        appleProductId: values.appleProductId.trim(),
        price: values.price,
        currency: values.currency,
      });
    },
    onSuccess: () => {
      toast.success(row ? "IAP product updated" : "IAP product created");
      void queryClient.invalidateQueries({ queryKey: ["iap-products"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Save failed");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {row
              ? `${row.planName} · ${CYCLE_LABELS[row.billingCycle]}`
              : "New IAP product"}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4 px-4 pb-6"
        >
          {!row && (
            <>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Controller
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.planId && (
                  <p className="text-xs text-destructive">{form.formState.errors.planId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Cycle</Label>
                <Controller
                  control={form.control}
                  name="billingCycle"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CYCLES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CYCLE_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="apple-id">Apple product ID</Label>
            <Input
              id="apple-id"
              className="font-mono text-xs"
              placeholder="com.lungdi.basic.3month"
              disabled={isEdit}
              {...form.register("appleProductId")}
            />
            {form.formState.errors.appleProductId && (
              <p className="text-xs text-destructive">{form.formState.errors.appleProductId.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "Can't be changed — it's how renewals are matched. Deactivate and add a new product instead."
                : "Exactly as configured in App Store Connect."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="iap-price">Display price (paise)</Label>
              <Input id="iap-price" type="number" className="font-mono" {...form.register("price", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iap-currency">Currency</Label>
              <Input id="iap-currency" className="font-mono uppercase" {...form.register("currency")} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            What the app shows. Apple charges whatever price tier is set in App
            Store Connect.
          </p>

          {isEdit && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create IAP product"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
