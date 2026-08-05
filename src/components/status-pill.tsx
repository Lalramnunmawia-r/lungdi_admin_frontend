import { cn } from "@/lib/utils";
import type { AccountStatus, ReportStatus, VerificationStatus } from "@/lib/types";

// Same status → color mapping as before; only the rendering changed (a
// colored-background pill read as another "AI template" tell). A small dot
// plus a muted-text label is the same information with far less visual
// weight — closer to how Linear/GitHub render inline state.
const ACCOUNT_STATUS_DOT: Record<AccountStatus, string> = {
  active: "bg-status-active",
  deactivated: "bg-status-neutral",
  suspended: "bg-status-pending",
  banned: "bg-status-danger",
  deleted: "bg-status-neutral",
};

const VERIFICATION_STATUS_DOT: Record<VerificationStatus, string> = {
  verified: "bg-status-active",
  processing: "bg-status-info",
  failed: "bg-status-danger",
  not_started: "bg-status-neutral",
};

const REPORT_STATUS_DOT: Record<ReportStatus, string> = {
  pending: "bg-status-pending",
  reviewed: "bg-status-info",
  action_taken: "bg-status-danger",
  dismissed: "bg-status-neutral",
};

export function StatusDot({ dotClassName, label }: { dotClassName: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground capitalize">
      <span className={cn("size-2 shrink-0 rounded-full", dotClassName)} />
      {label.replace(/_/g, " ")}
    </span>
  );
}

export function AccountStatusPill({ status }: { status: AccountStatus }) {
  return <StatusDot dotClassName={ACCOUNT_STATUS_DOT[status]} label={status} />;
}

export function VerificationStatusPill({ status }: { status: VerificationStatus }) {
  return <StatusDot dotClassName={VERIFICATION_STATUS_DOT[status]} label={status} />;
}

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  return <StatusDot dotClassName={REPORT_STATUS_DOT[status]} label={status} />;
}
