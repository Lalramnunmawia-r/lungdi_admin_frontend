import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface StatProps {
  label: string;
  value: string | number | undefined;
  tone?: "default" | "danger";
  hint?: string;
}

/**
 * A single label/value pair, meant to sit inside <StatRowGroup>. Deliberately
 * no border, background, or icon of its own — those were the "icon in the
 * corner of a bordered card, repeated eight times" pattern that read as a
 * generic AI-generated admin template. The parent supplies the hairline
 * divider between segments; this component is just the two lines of text.
 */
export function Stat({ label, value, tone = "default", hint }: StatProps) {
  return (
    <div className="min-w-[130px]">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {value === undefined ? (
        <Skeleton className="mt-1 h-6 w-14" />
      ) : (
        <p
          className={cn(
            "font-mono text-lg tabular-nums",
            tone === "danger" && Number(value) > 0
              ? "text-status-danger"
              : "text-foreground",
          )}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Wraps a row of <Stat> segments with a hairline left-border divider between
 * them instead of `divide-x`, which was tried first and rejected — it doesn't
 * degrade cleanly once the row wraps onto a second line at narrower widths,
 * while a plain `border-l` on every non-first item does.
 */
export function StatRowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-4 [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-border [&>*:not(:first-child)]:pl-6">
      {children}
    </div>
  );
}
