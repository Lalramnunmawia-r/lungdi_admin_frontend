import type { ProviderBillingCycle } from "@/lib/types";

export const CYCLES: ProviderBillingCycle[] = ["3_month", "6_month", "12_month"];

export const CYCLE_LABELS: Record<ProviderBillingCycle, string> = {
  "3_month": "3-month",
  "6_month": "6-month",
  "12_month": "12-month",
};
