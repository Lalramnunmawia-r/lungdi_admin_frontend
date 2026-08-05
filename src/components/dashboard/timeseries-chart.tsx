"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminTimeseriesPoint } from "@/lib/types";

// Single series → one hue, no legend box (a legend restates the title when
// there's only one color to key). --chart-1 is the one hue validated by the
// dataviz skill's checks (lightness/chroma/contrast) for this dark surface —
// see globals.css's own note on why 2-5 are set equal to it rather than left
// as an unvalidated multi-hue set.
const SERIES_COLOR = "var(--chart-1)";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">
        {label ? new Date(label).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums text-foreground">
        {payload[0].value.toLocaleString()}
      </div>
    </div>
  );
}

export function TimeseriesChart({ data }: { data: AdminTimeseriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ts-fill" x1="0" y1="0" x2="0" y2="1">
            {/* ~10% opacity wash per the mark spec — a fill, never a saturated block */}
            <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* Hairline, recessive, solid — never dashed */}
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) =>
            new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          }
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)" }} />
        <Area
          type="monotone"
          dataKey="count"
          stroke={SERIES_COLOR}
          strokeWidth={2}
          fill="url(#ts-fill)"
          dot={false}
          activeDot={{ r: 4, fill: SERIES_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
