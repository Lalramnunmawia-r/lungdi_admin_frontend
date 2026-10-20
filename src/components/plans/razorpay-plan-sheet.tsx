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
import { formatPaise } from "@/lib/format";
import type { AdminPlan, AdminRazorpayPlan } from "@/lib/types";
import { CYCLE_LABELS, CYCLES } from "@/components/plans/cycles";

const schema = z.object({
  planId: z.string().min(1, "Pick a plan"),
  billingCycle: z.enum(["3_month", "6_month", "12_month"]),
  price: z.number().int().min(1),
  currency: z.string().min(1).max(3),
  razorpayPlanId: z.string(),
});
type FormValues = z.infer<typeof schema>;

function emptyForm(plans: AdminPlan[]): FormValues {
  return {
    planId: plans[0]?.id ?? "",
    billingCycle: "3_month",
    price: plans[0]?.price3Month ?? 19900,
    currency: plans[0]?.currency ?? "INR",
    razorpayPlanId: "",
  };
}

/**
 * Create: pick a plan + cycle + price; leave the id blank to have it created on
 * Razorpay. Edit: Razorpay plans are immutable, so the only action is
 * activate/deactivate — to re-price, deactivate and create a new one.
 */
export function RazorpayPlanSheet({
  row,
  plans,
  open,
  onOpenChange,
}: {
  row: AdminRazorpayPlan | null;
  plans: AdminPlan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(plans),
  });

  useEffect(() => {
    if (open && !row) form.reset(emptyForm(plans));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (row) {
        return api.patch(`/admin/razorpay-plans/${row.id}`, {
          active: !row.active,
        });
      }
      return api.post("/admin/razorpay-plans", {
        planId: values.planId,
        billingCycle: values.billingCycle,
        price: values.price,
        currency: values.currency,
        razorpayPlanId: values.razorpayPlanId.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(
        row
          ? row.active
            ? "Razorpay plan deactivated"
            : "Razorpay plan activated"
          : "Razorpay plan created",
      );
      void queryClient.invalidateQueries({ queryKey: ["razorpay-plans"] });
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
              : "New Razorpay plan"}
          </SheetTitle>
        </SheetHeader>

        {row ? (
          <div className="space-y-4 px-4 pb-6">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Razorpay plan ID</dt>
                <dd className="font-mono">{row.razorpayPlanId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Price</dt>
                <dd className="font-mono tabular-nums">
                  {formatPaise(row.price, row.currency)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Razorpay plans can&apos;t be edited. To change the price,
              deactivate this one and create a new Razorpay plan. Existing
              subscribers keep renewing on their current plan either way.
            </p>
            <Button
              className="w-full"
              variant={row.active ? "destructive" : "default"}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(form.getValues())}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {row.active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4 px-4 pb-6"
          >
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

            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label htmlFor="rzp-currency">Currency</Label>
                <Input id="rzp-currency" className="font-mono uppercase" {...form.register("currency")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rzp-price">Price for the whole cycle (paise)</Label>
              <Input id="rzp-price" type="number" className="font-mono" {...form.register("price", { valueAsNumber: true })} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rzp-id">Razorpay plan ID (optional)</Label>
              <Input id="rzp-id" className="font-mono text-xs" placeholder="plan_…" {...form.register("razorpayPlanId")} />
              <p className="text-xs text-muted-foreground">
                Leave blank to create the plan on Razorpay automatically.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create Razorpay plan
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
