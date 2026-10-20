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
import { Textarea } from "@/components/ui/textarea";
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
  // One bullet per line; split back into string[] on submit.
  features: z.string(),
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
    features: "",
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
    features: plan.features.join("\n"),
  };
}

function parseFeatures(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * The plan itself — name, display prices, marketing features, active.
 * Razorpay plans and Apple IAP products are managed in their own tabs.
 */
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
        features: parseFeatures(values.features),
        ...(isEdit ? { active: values.active === "true" } : {}),
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
          <p className="-mt-2 text-xs text-muted-foreground">
            Display prices shown in the app. What Razorpay and Apple actually
            charge is set per provider in the Razorpay and Apple IAP tabs.
          </p>

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

          <div className="space-y-1.5">
            <Label htmlFor="features">Features</Label>
            <Textarea
              id="features"
              rows={6}
              placeholder="One bullet per line"
              {...form.register("features")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create plan"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
