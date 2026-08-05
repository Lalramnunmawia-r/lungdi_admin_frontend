import type { AdminFunnel } from "@/lib/types";

// Funnel stages are ORDINAL (registered → complete → verified → subscribed —
// swapping the order would change the meaning), and bar WIDTH already encodes
// the magnitude accurately on its own. A monotone-lightness color ramp across
// four steps would add a second, redundant encoding of the same ordinal
// position for no reader benefit — so this uses a single validated hue
// (--chart-1) throughout and lets width carry the story, direct-labeled with
// the value and conversion rate at each stage's end (the "label the endpoint"
// rule from the dataviz skill, not a number on every point).
export function FunnelBars({ funnel }: { funnel: AdminFunnel }) {
  const stages = [
    { label: "Registered", value: funnel.registered },
    { label: "Profile complete", value: funnel.profileComplete },
    { label: "Verified", value: funnel.verified },
    { label: "Subscribed", value: funnel.subscribed },
  ];
  const max = stages[0]?.value || 1;

  return (
    <div className="space-y-4">
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.value / max) * 100, 2);
        const pctOfPrevious =
          i === 0 ? null : stages[i - 1].value === 0
            ? 0
            : Math.round((stage.value / stages[i - 1].value) * 100);
        return (
          <div key={stage.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-foreground">{stage.label}</span>
              <span className="font-mono text-muted-foreground">
                <span className="tabular-nums text-foreground">
                  {stage.value.toLocaleString()}
                </span>
                {pctOfPrevious !== null && (
                  <span className="ml-1.5 tabular-nums">({pctOfPrevious}%)</span>
                )}
              </span>
            </div>
            {/* Bar: ≤24px thick, 4px rounded data-end, square at the baseline (left) */}
            <div className="h-5 w-full overflow-hidden rounded-r-none bg-transparent">
              <div
                className="h-5 rounded-r-[4px] bg-[var(--chart-1)] transition-[width] duration-300"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
