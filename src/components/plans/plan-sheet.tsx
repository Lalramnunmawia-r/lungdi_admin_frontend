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
import type { AdminPlan } from "@/lib/types";

const planSchema = z.object({
  name: z.string().min(1).max(50),
  // valueAsNumber on the <Input>s below converts the field before validation
  // runs, so this stays a plain z.number() rather than z.coerce.number() —
  // z.coerce's input/output type split doesn't line up with useForm<PlanForm>'s
  // single generic, which is what upset the zodResolver types here.
  price3Month: z.number().int().min(0),
  price6Month: z.number().int().min(0),
  price12Month: z.number().int().min(0),
  currency: z.string().max(3).min(1),
  active: z.enum(["true", "false"]),
  appleProductId3Month: z.string(),
  appleProductId6Month: z.string(),
  appleProductId12Month: z.string(),
});
type PlanForm = z.infer<typeof planSchema>;

function emptyForm(): PlanForm {
  return {
    name: "",
    price3Month: 19900,
    price6Month: 29900,
    price12Month: 39900,
    currency: "INR",
    active: "true",
    appleProductId3Month: "",
    appleProductId6Month: "",
    appleProductId12Month: "",
  };
}

function toForm(plan: AdminPlan): PlanForm {
  return {
    name: plan.name,
    price3Month: plan.price3Month,
    price6Month: plan.price6Month,
    price12Month: plan.price12Month,
    currency: plan.currency,
    active: plan.active ? "true" : "false",
    appleProductId3Month: plan.appleProductId3Month ?? "",
    appleProductId6Month: plan.appleProductId6Month ?? "",
    appleProductId12Month: plan.appleProductId12Month ?? "",
  };
}

/** undefined clears an optional string field server-side rather than sending "". */
function orUndefined(value: string): string | undefined {
  return value.trim() === "" ? undefined : value.trim();
}

export function PlanSheet({
  plan,
  open,
  onOpenChange,
}: {
  plan: AdminPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = !!plan;
  const queryClient = useQueryClient();

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: emptyForm(),
  });

  useEffect(() => {
    if (open) form.reset(plan ? toForm(plan) : emptyForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan]);

  const mutation = useMutation({
    mutationFn: (values: PlanForm) => {
      const payload = {
        name: values.name,
        price3Month: values.price3Month,
        price6Month: values.price6Month,
        price12Month: values.price12Month,
        currency: values.currency,
        ...(isEdit ? { active: values.active === "true" } : {}),
        // Razorpay ids are never submitted from here — omitting the key is
        // exactly what tells the backend to auto-create (on create) or leave
        // an already-provisioned cycle alone (on update). See the read-only
        // display below.
        appleProductId3Month: orUndefined(values.appleProductId3Month),
        appleProductId6Month: orUndefined(values.appleProductId6Month),
        appleProductId12Month: orUndefined(values.appleProductId12Month),
      };
      return isEdit
        ? api.patch(`/admin/plans/${plan.id}`, payload)
        : api.post("/admin/plans", payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Plan updated" : "Plan created");
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
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
          <SheetTitle>{isEdit ? `Edit ${plan.name}` : "New plan"}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4 px-4 pb-6"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price3Month">3-month (paise)</Label>
              <Input id="price3Month" type="number" className="font-mono" {...form.register("price3Month", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price6Month">6-month (paise)</Label>
              <Input id="price6Month" type="number" className="font-mono" {...form.register("price6Month", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price12Month">12-month (paise)</Label>
              <Input id="price12Month" type="number" className="font-mono" {...form.register("price12Month", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" className="font-mono uppercase" {...form.register("currency")} />
            </div>
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
          </div>

          {isEdit && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Razorpay plan IDs
              </p>
              <p className="text-xs text-muted-foreground">
                Created automatically on Razorpay — read-only.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-1.5">
                {[
                  plan.razorpayPlanId3Month,
                  plan.razorpayPlanId6Month,
                  plan.razorpayPlanId12Month,
                ].map((id, i) => (
                  <div
                    key={i}
                    className="truncate rounded-lg border border-border bg-muted/40 px-2.5 py-2 font-mono text-xs text-muted-foreground"
                    title={id ?? undefined}
                  >
                    {id ?? "Not yet created"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEdit && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Apple product IDs
              </p>
              <p className="text-xs text-muted-foreground">
                Not auto-created — set these after creating the matching
                subscription product in App Store Connect.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-1.5">
                <Input placeholder="3-month" className="font-mono text-xs" {...form.register("appleProductId3Month")} />
                <Input placeholder="6-month" className="font-mono text-xs" {...form.register("appleProductId6Month")} />
                <Input placeholder="12-month" className="font-mono text-xs" {...form.register("appleProductId12Month")} />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create plan"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
