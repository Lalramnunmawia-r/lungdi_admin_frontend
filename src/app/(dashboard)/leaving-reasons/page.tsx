"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AdminExitBreakdown,
  AdminExitFeedback,
  AdminExitFeedbackListResponse,
  AdminExitReason,
  CreateExitReasonInput,
  ExitAction,
  TenureBucket,
  UpdateExitReasonInput,
} from "@/lib/types";
import { Stat, StatRowGroup } from "@/components/stat-row";
import { TimeseriesChart } from "@/components/dashboard/timeseries-chart";
import { Panel, ShareBars } from "@/components/dashboard/panel";
import { UserDrawer } from "@/components/users/user-drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

const TENURE_LABEL: Record<TenureBucket, string> = {
  same_day: "Left the same day",
  days_1_7: "1–7 days",
  days_8_30: "8–30 days",
  days_31_90: "31–90 days",
  over_90: "Over 90 days",
  unknown: "Unknown",
};

const pct = (part: number, whole: number) =>
  whole === 0 ? "—" : `${Math.round((100 * part) / whole)}%`;

/** Create and edit share one form; `reason` is null for "new". */
interface ReasonForm {
  labelEn: string;
  labelMz: string;
  forDeactivate: boolean;
  forDelete: boolean;
  allowsText: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ReasonForm = {
  labelEn: "",
  labelMz: "",
  forDeactivate: true,
  forDelete: true,
  allowsText: false,
  sortOrder: "",
};

function formFromReason(reason: AdminExitReason): ReasonForm {
  return {
    labelEn: reason.labelEn,
    labelMz: reason.labelMz ?? "",
    forDeactivate: reason.forDeactivate,
    forDelete: reason.forDelete,
    allowsText: reason.allowsText,
    sortOrder: String(reason.sortOrder),
  };
}

function ReasonDialog({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  reason: AdminExitReason | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  // Reset the form each time the dialog opens for a different reason. Keyed on
  // the reason id by the parent (`key=`), so plain initial state is enough.
  const [form, setForm] = useState<ReasonForm>(
    reason ? formFromReason(reason) : EMPTY_FORM,
  );
  const set = <K extends keyof ReasonForm>(key: K, value: ReasonForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const sortOrder = form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder);
      if (reason) {
        const payload: UpdateExitReasonInput = {
          labelEn: form.labelEn.trim(),
          labelMz: form.labelMz.trim() === "" ? null : form.labelMz.trim(),
          forDeactivate: form.forDeactivate,
          forDelete: form.forDelete,
          allowsText: form.allowsText,
          sortOrder,
        };
        return api.patch(`/admin/exit-reasons/${reason.id}`, payload);
      }
      const payload: CreateExitReasonInput = {
        labelEn: form.labelEn.trim(),
        labelMz: form.labelMz.trim() || undefined,
        forDeactivate: form.forDeactivate,
        forDelete: form.forDelete,
        allowsText: form.allowsText,
        sortOrder,
      };
      return api.post("/admin/exit-reasons", payload);
    },
    onSuccess: () => {
      toast.success(reason ? "Reason updated" : "Reason added");
      void queryClient.invalidateQueries({ queryKey: ["exit-reasons"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not save");
    },
  });

  const shownSomewhere = form.forDeactivate || form.forDelete;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reason ? "Edit reason" : "New reason"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="reason-en">Reason (English)</Label>
            <Input
              id="reason-en"
              value={form.labelEn}
              onChange={(e) => set("labelEn", e.target.value)}
              placeholder="I don't see people I'm looking for"
              maxLength={120}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason-mz">Reason (Mizo) — optional</Label>
            <Input
              id="reason-mz"
              value={form.labelMz}
              onChange={(e) => set("labelMz", e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Show this reason when the user…
            </p>
            <label className="flex items-center justify-between text-sm">
              <span>Deactivates their account</span>
              <Switch
                checked={form.forDeactivate}
                onCheckedChange={(v) => set("forDeactivate", !!v)}
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Deletes their account</span>
              <Switch
                checked={form.forDelete}
                onCheckedChange={(v) => set("forDelete", !!v)}
              />
            </label>
            {!shownSomewhere && (
              <p className="text-xs text-status-danger">
                Turn on at least one, or hide the reason from the list instead.
              </p>
            )}
          </div>

          <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
            <span>
              <span className="font-medium">&ldquo;Other&rdquo; option</span>
              <span className="block text-xs text-muted-foreground">
                The app shows a text box so the user can type their own reason.
              </span>
            </span>
            <Switch
              checked={form.allowsText}
              onCheckedChange={(v) => set("allowsText", !!v)}
            />
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="reason-order">Position in the list — optional</Label>
            <Input
              id="reason-order"
              type="number"
              min={0}
              max={10000}
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
              placeholder="Blank = at the end. Lower numbers show first."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.labelEn.trim() || !shownSomewhere || mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {reason ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function LeavingReasonsPage() {
  const queryClient = useQueryClient();
  const [rangeDays, setRangeDays] = useState("30");
  const [action, setAction] = useState<"all" | ExitAction>("all");
  const [textOnly, setTextOnly] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  // `undefined` = dialog closed, `null` = creating, a reason = editing.
  const [dialog, setDialog] = useState<AdminExitReason | null | undefined>(undefined);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const range = Number(rangeDays);
  const actionParam = action === "all" ? undefined : action;

  const { data: reasons, isLoading: reasonsLoading } = useQuery({
    queryKey: ["exit-reasons"],
    queryFn: () => api.get<AdminExitReason[]>("/admin/exit-reasons"),
  });
  const { data: breakdown } = useQuery({
    queryKey: ["exit-reasons", "breakdown", range, action],
    queryFn: () =>
      api.get<AdminExitBreakdown>("/admin/exit-reasons/breakdown", {
        range,
        action: actionParam,
      }),
  });
  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ["exit-reasons", "feedback", { action, textOnly, cursor }],
    queryFn: () =>
      api.get<AdminExitFeedbackListResponse>("/admin/exit-reasons/feedback", {
        action: actionParam,
        withTextOnly: textOnly ? "true" : undefined,
        cursor,
      }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/admin/exit-reasons/${id}`, { active } satisfies UpdateExitReasonInput),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exit-reasons"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    },
  });

  function resetPaging() {
    setCursor(undefined);
    setCursorStack([]);
  }

  const totals = breakdown?.totals;
  // "Left early" = within the first week: the figure that points at onboarding
  // and first-matches problems rather than long-term churn.
  const earlyLeavers = breakdown
    ? breakdown.byTenure
        .filter((b) => b.bucket === "same_day" || b.bucket === "days_1_7")
        .reduce((sum, b) => sum + b.total, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Leaving Reasons</h1>
          <p className="text-sm text-muted-foreground">
            Why people deactivate or delete their account — for understanding the
            in-app experience. Manage the options users pick from, and see what they chose.
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={action}
            onValueChange={(v) => {
              if (!v) return;
              setAction(v as "all" | ExitAction);
              resetPaging();
            }}
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Both</SelectItem>
              <SelectItem value="deactivate">Deactivated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rangeDays} onValueChange={(v) => v && setRangeDays(v)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StatRowGroup>
        <Stat label="Exits" value={totals?.exits} />
        <Stat label="Deactivated" value={totals?.deactivated} />
        <Stat label="Deleted" value={totals?.deleted} tone="danger" />
        <Stat
          label="Left in week one"
          value={totals ? pct(earlyLeavers, totals.exits) : undefined}
          hint="Points at onboarding / first matches"
        />
        <Stat
          label="Had no connections"
          value={totals ? pct(totals.noConnections, totals.exits) : undefined}
          hint="Never matched with anyone"
        />
        <Stat
          label="Were subscribed"
          value={totals ? pct(totals.hadActiveSubscription, totals.exits) : undefined}
        />
        <Stat
          label="Wrote their own"
          value={totals ? pct(totals.withTypedText, totals.exits) : undefined}
          hint='"Other" text'
        />
      </StatRowGroup>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Why people leave" className="lg:col-span-2">
          <ShareBars
            rows={(breakdown?.byReason ?? []).map((r) => ({
              label: r.reasonLabel,
              value: r.total,
              detail:
                action === "all"
                  ? `${r.deactivate} deactivated · ${r.delete} deleted`
                  : undefined,
            }))}
            emptyText="Nobody has left in this range yet."
          />
        </Panel>
        <Panel title="How long they stayed">
          <ShareBars
            rows={(breakdown?.byTenure ?? [])
              .filter((b) => b.total > 0)
              .map((b) => ({ label: TENURE_LABEL[b.bucket], value: b.total }))}
            emptyText="Nobody has left in this range yet."
          />
        </Panel>
      </div>

      <Panel title="Exits per day">
        {breakdown ? (
          <TimeseriesChart
            data={breakdown.series.map((p) => ({ date: p.date, count: p.value }))}
          />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
      </Panel>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Options users can pick
            </h2>
            <p className="text-xs text-muted-foreground">
              Hiding a reason keeps its history. Past answers keep the wording they were given.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialog(null)}>
            New reason
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Order</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Shown when</TableHead>
                <TableHead>Text box</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead className="text-right">Chosen</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reasonsLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!reasonsLoading && reasons?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No reasons yet. Add one — until you do, the app has nothing to offer.
                  </TableCell>
                </TableRow>
              )}
              {reasons?.map((reason) => (
                <TableRow key={reason.id} className={reason.active ? undefined : "opacity-60"}>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">
                    {reason.sortOrder}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{reason.labelEn}</div>
                    {reason.labelMz && (
                      <div className="text-xs text-muted-foreground">{reason.labelMz}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[reason.forDeactivate && "Deactivate", reason.forDelete && "Delete"]
                      .filter(Boolean)
                      .join(" · ")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {reason.allowsText ? "“Other”" : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={reason.active}
                      disabled={toggleActive.isPending}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: reason.id, active: !!checked })
                      }
                      aria-label={`Show or hide ${reason.labelEn}`}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {reason.usageCount}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Edit"
                      onClick={() => setDialog(reason)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Individual answers
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={textOnly}
              onCheckedChange={(v) => {
                setTextOnly(!!v);
                resetPaging();
              }}
            />
            Only ones where they wrote their own
          </label>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>In their own words</TableHead>
                <TableHead>Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedbackLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!feedbackLoading && feedback?.feedback.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Nothing yet.
                  </TableCell>
                </TableRow>
              )}
              {feedback?.feedback.map((entry: AdminExitFeedback) => (
                <TableRow
                  key={entry.id}
                  className={entry.userId ? "cursor-pointer" : undefined}
                  onClick={() => entry.userId && setDrawerUserId(entry.userId)}
                >
                  <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.userName ?? (
                      <span className="text-muted-foreground">Erased</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{entry.action}</TableCell>
                  <TableCell className="text-sm">{entry.reasonLabel}</TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {entry.otherText ? (
                      <span className="whitespace-pre-wrap">{entry.otherText}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.accountAgeDays === null
                      ? "—"
                      : `${entry.accountAgeDays}d old`}
                    {entry.hadActiveSubscription ? " · subscribed" : ""}
                    {entry.connectionCount === 0 ? " · no connections" : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          What a user typed is erased automatically when their name, email and phone
          are erased after account deletion (&ldquo;Erased&rdquo; above). The reason and the
          account details are kept for analysis.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cursorStack.length === 0}
            onClick={() => {
              const prev = cursorStack[cursorStack.length - 1];
              setCursorStack((s) => s.slice(0, -1));
              setCursor(prev);
            }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!feedback?.nextCursor}
            onClick={() => {
              if (!feedback?.nextCursor) return;
              setCursorStack((s) => [...s, cursor]);
              setCursor(feedback.nextCursor);
            }}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Keyed so the form re-initialises for each reason it opens on. */}
      {dialog !== undefined && (
        <ReasonDialog
          key={dialog?.id ?? "new"}
          open
          reason={dialog}
          onClose={() => setDialog(undefined)}
        />
      )}
      <UserDrawer
        userId={drawerUserId}
        onOpenChange={(open) => {
          if (!open) setDrawerUserId(null);
        }}
      />
    </div>
  );
}
