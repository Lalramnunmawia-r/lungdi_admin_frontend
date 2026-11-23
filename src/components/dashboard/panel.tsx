import { cn } from "@/lib/utils";

/**
 * A titled, bordered card for one dashboard section, with an optional control
 * (a select, a button) on the right of the title. Shared by the analysis
 * pages (Video Calls, Leaving Reasons) so they read as one system.
 */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * Horizontal bar list: shares of a whole, one hue (--chart-1), the count and
 * percentage labelled at the end of each row. `detail` is an optional second
 * line under a label (e.g. "12 deactivated · 3 deleted").
 */
export function ShareBars({
  rows,
  emptyText = "No data in this range yet.",
}: {
  rows: { label: string; value: number; detail?: string }[];
  emptyText?: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const share = (100 * row.value) / total;
        return (
          <div key={row.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="text-foreground">{row.label}</span>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {row.value.toLocaleString()} · {Math.round(share)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${share}%`, background: "var(--chart-1)" }}
              />
            </div>
            {row.detail && (
              <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
